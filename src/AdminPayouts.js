import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { color, font, ui } from './theme';
import Icon from './ui/Icon';
import { payoutGroups, payoutBucket, sitterNetPaise } from './adminInsights';
import { logPayoutMarkedPaid } from './auditService';
import { A, Badge, EmptyState, KpiTile, SearchBox, Toolbar, ConfirmDialog, Notice, SectionHeader, rs, rsPaise, serviceLabel, fmtDateTime } from './AdminUI';
import { runReleaseCheck, releasePayout } from './paymentsClient';

// Marks completed jobs as paid out, logs each one, then tells the sitter once
// with the total. `items` is [{ id, amount }] with amount in rupees (net).
export async function markPayoutsPaid(items) {
  const { data: { user } } = await supabase.auth.getUser();
  for (const it of items) {
    const { error } = await supabase.from('bookings').update({ payout_status: 'paid' }).eq('id', it.id);
    if (error) return { error: error.message };
    const { error: logError } = await supabase.from('payment_events').insert({ booking_id: it.id, kind: 'paid_out', amount_paise: it.amount * 100, note: "Paid to the sitter's UPI" });
    if (logError) console.error('payment_events paid_out insert failed:', logError.message);
    if (user) await logPayoutMarkedPaid(user.id, it.id, it.amount);
  }
  const total = items.reduce((a, it) => a + it.amount, 0);

  // sitterData is read again below (referral bonus check), so it lives at function scope.
  let sitterData;
  try {
    const { data: bookingData } = await supabase.from('bookings').select('sitter_id').eq('id', items[0].id).single();
    if (bookingData) {
      ({ data: sitterData } = await supabase.from('sitter_profiles').select('user_id, users(name)').eq('id', bookingData.sitter_id).single());
      if (sitterData?.users) {
        const { data: contact } = await supabase.rpc('get_user_contact', { target_id: sitterData.user_id });
        const { notifyPayoutMarked } = await import('./notificationService');
        // notifications.user_id is a real users.id FK, not sitter_profiles.id
        await notifyPayoutMarked(sitterData.user_id, contact?.[0]?.email, contact?.[0]?.phone, total * 100, items.length, new Date().toLocaleDateString('en-IN'));
      }
    }
  } catch (notifErr) { console.error('Payout notification failed:', notifErr); }
  // Referral credits are applied from the Referrals tab, after the friend's first completed booking.
  return { total };
}

// Payouts that are not payable yet: still inside the 24h-after-service hold,
// or paused because the parent reported a problem.
function WaitingList({ title, subtitle, rows, sitterById, action }) {
  if (!rows.length) return null;
  return (
    <section aria-label={title} style={{ ...ui.card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: 16, borderBottom: `1px solid ${color.line}` }}><SectionHeader title={title + ' (' + rows.length + ')'} subtitle={subtitle} /></div>
      {rows.map((b, i) => {
        const sitter = sitterById[b.sitter_id];
        return (
          <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderTop: i ? `1px solid ${color.line}` : 'none', background: i % 2 ? color.bg : color.surface }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: font.md, fontWeight: 600 }}>{b.booking_ref} · {sitter?.users?.name || 'Unknown sitter'}</div>
              <div style={A.muted}>{serviceLabel(b.service_type)} · {b.booking_date || '—'} · {b.payout_status === 'on_hold' ? 'releases ' + fmtDateTime(b.payout_release_at) : 'parent reported a problem'}</div>
            </div>
            <div style={{ ...A.row(12), flexWrap: 'nowrap' }}>
              <span style={{ fontSize: font.md, fontWeight: 600, ...A.num }}>{rsPaise(sitterNetPaise(b, sitter))}</span>
              {action && action(b)}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export default function AdminPayouts({ bookings, sitters, showMsg, onChanged }) {
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState(null);
  const sitterById = Object.fromEntries(sitters.map(s => [s.id, s]));
  const onHold = bookings.filter(b => payoutBucket(b) === 'on_hold').sort((a, b) => String(a.payout_release_at).localeCompare(String(b.payout_release_at)));
  const disputed = bookings.filter(b => payoutBucket(b) === 'disputed');

  const releaseCheck = async () => {
    setBusy(true);
    try {
      const r = await runReleaseCheck();
      setCheck({ tone: r.errors?.length ? 'warning' : 'success', text: 'Release check done: ' + r.released + ' ready to pay, ' + r.disputed + ' paused for a dispute, ' + r.voided + ' unanswered holds released' + (r.captured ? ', ' + r.captured + ' captured' : '') + '.' + (r.errors?.length ? ' Problems: ' + r.errors.join('; ') : '') + (r.note ? ' ' + r.note : '') });
      onChanged();
    } catch (e) { setCheck({ tone: 'danger', text: 'Release check failed: ' + e.message }); }
    setBusy(false);
  };

  // The admin decides a disputed payout after looking into it (Disputes tab),
  // or releases a finished job before its 24h hold ends.
  const release = async (b, reason) => {
    setBusy(true);
    try {
      await releasePayout(b.id, reason);
      showMsg('Payout moved to Ready ✓');
      onChanged();
    } catch (e) { showMsg('Could not release: ' + e.message, 'error'); }
    setBusy(false);
  };

  // Tips that arrived after the job's payout was already paid are owed separately.
  const [tips, setTips] = useState([]);
  const loadTips = useCallback(async () => {
    const { data } = await supabase.from('payment_events').select('*').in('kind', ['tip_unpaid', 'tip_paid']);
    const paid = new Set((data || []).filter(e => e.kind === 'tip_paid').map(e => e.gateway_ref));
    setTips((data || []).filter(e => e.kind === 'tip_unpaid' && !paid.has(e.gateway_ref)));
  }, []);
  useEffect(() => { loadTips(); }, [loadTips]);
  const bookingById = Object.fromEntries(bookings.map(b => [b.id, b]));
  const payTip = async (tip) => {
    setBusy(true);
    const { error } = await supabase.from('payment_events').insert({ booking_id: tip.booking_id, kind: 'tip_paid', amount_paise: tip.amount_paise, gateway_ref: tip.gateway_ref, note: "Tip paid to the sitter's UPI" });
    setBusy(false);
    if (error) { showMsg('Could not mark the tip paid: ' + error.message, 'error'); return; }
    const sitter = sitterById[bookingById[tip.booking_id]?.sitter_id];
    try {
      const { createNotification } = await import('./notificationService');
      await createNotification(sitter?.user_id, 'payout_marked', 'Tip paid!', rsPaise(tip.amount_paise) + ' tip sent to your UPI');
    } catch (e) { console.error('Tip notification failed:', e); }
    showMsg('Tip marked as paid ✓');
    loadTips();
  };

  const groups = payoutGroups(bookings, sitters);
  const jobs = groups.reduce((a, g) => a + g.items.length, 0);
  const totalDue = groups.reduce((a, g) => a + g.total, 0);
  const q = query.trim().toLowerCase();
  const shown = groups.filter(g => !q || (g.sitter?.users?.name || '').toLowerCase().includes(q) || (g.sitter?.upi_id || '').toLowerCase().includes(q));

  const pay = async (items) => {
    setBusy(true);
    const res = await markPayoutsPaid(items);
    setBusy(false);
    setConfirm(null);
    if (res.error) { showMsg('Could not mark paid: ' + res.error, 'error'); return; }
    showMsg(items.length > 1 ? items.length + ' payouts marked paid (' + rs(res.total) + ') ✓' : 'Payout marked as paid ✓');
    onChanged();
  };

  return (
    <div style={A.stack(16)}>
      <div style={A.grid(170)}>
        <KpiTile label="Payouts pending" value={jobs} />
        <KpiTile label="Total due to sitters" value={rs(totalDue)} tone={totalDue ? 'warning' : undefined} />
        <KpiTile label="Sitters to pay" value={groups.length} />
        <KpiTile label="On hold (not due yet)" value={onHold.length} />
        <KpiTile label="Disputed" value={disputed.length} tone={disputed.length ? 'danger' : undefined} />
      </div>
      <div style={A.row(12)}>
        <button onClick={releaseCheck} disabled={busy} style={A.secondary}><Icon name="refresh" size={16} />Run release check</button>
        <span style={A.muted}>Runs daily on its own. Moves payouts to Ready 24h after a completed service, unless the parent reported a problem.</span>
      </div>
      {check && <Notice tone={check.tone} icon={check.tone === 'success' ? 'check' : 'alert'}>{check.text}</Notice>}
      <SectionHeader title="Ready to pay" subtitle="Pay the sitter's UPI, then mark paid. Only Ready payouts can be marked paid." />
      {groups.length > 0 && (
        <Toolbar>
          <SearchBox label="Search payouts by sitter" value={query} onChange={setQuery} placeholder="Search sitter name or UPI" />
        </Toolbar>
      )}
      {groups.length === 0 && <EmptyState icon="check" title="All payouts up to date" text="Completed jobs that still need paying will appear here, grouped by sitter." />}
      {groups.length > 0 && shown.length === 0 && <EmptyState icon="search" title="No sitter matches" />}

      {shown.map(g => {
        const name = g.sitter?.users?.name || 'Unknown sitter';
        const founding = !!g.sitter?.is_founding_sitter;
        return (
          <section key={g.sitterId || 'unknown'} aria-label={'Payouts for ' + name} style={{ ...ui.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: 16, borderBottom: `1px solid ${color.line}`, background: color.surface }}>
              <div style={{ minWidth: 0 }}>
                <div style={A.row(6)}>
                  <span style={{ fontSize: font.lg, fontWeight: 700 }}>{name}</span>
                  {founding && <Badge tone="navy" icon="award">Founding</Badge>}
                </div>
                <div style={A.muted}>{g.sitter?.upi_id ? 'UPI ' + g.sitter.upi_id : 'No UPI on file'} · {g.items.length} {g.items.length === 1 ? 'job' : 'jobs'}</div>
              </div>
              <div style={{ ...A.row(12), flexWrap: 'nowrap' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: font.xs, color: color.muted, fontWeight: 600 }}>Due</div>
                  <div style={{ fontSize: font.xl, fontWeight: 700, ...A.num }}>{rs(g.total)}</div>
                </div>
                {g.items.length > 1 && (
                  <button onClick={() => setConfirm(g)} disabled={busy} style={A.smallPrimary}><Icon name="check" size={14} />Mark all paid ({g.items.length})</button>
                )}
              </div>
            </div>
            {g.items.map(({ booking: b, net }, i) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderTop: i ? `1px solid ${color.line}` : 'none', background: i % 2 ? color.bg : color.surface }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: font.md, fontWeight: 600 }}>{b.booking_ref}</div>
                  <div style={A.muted}>{serviceLabel(b.service_type)} · {b.booking_date || new Date(b.created_at).toLocaleDateString('en-IN')} · parent paid {rsPaise(b.gross_amount_paise)}</div>
                </div>
                <div style={{ ...A.row(12), flexWrap: 'nowrap' }}>
                  <span style={{ fontSize: font.md, fontWeight: 600, color: color.success, ...A.num }}>{'Sitter gets: Rs.' + net + (founding ? ' (Founding — 0% commission)' : '')}</span>
                  <button onClick={() => pay([{ id: b.id, amount: net }])} disabled={busy} style={A.small}>Mark paid</button>
                </div>
              </div>
            ))}
          </section>
        );
      })}

      {confirm && (
        <ConfirmDialog title={'Mark ' + confirm.items.length + ' payouts paid?'} confirmLabel={'Yes, mark ' + rs(confirm.total) + ' paid'} busy={busy}
          onCancel={() => setConfirm(null)} onConfirm={() => pay(confirm.items.map(it => ({ id: it.booking.id, amount: it.net })))}>
          Only do this after you have sent {rs(confirm.total)} to {confirm.sitter?.users?.name || 'this sitter'}{confirm.sitter?.upi_id ? ' (UPI ' + confirm.sitter.upi_id + ')' : ''}. They get one notification for the total.
        </ConfirmDialog>
      )}

      {tips.length > 0 && (
        <section aria-label="Tips to pay" style={{ ...ui.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: `1px solid ${color.line}` }}><SectionHeader title={'Tips to pay (' + tips.length + ')'} subtitle="Tipped after the job's payout was paid. Send the tip to the sitter's UPI, then mark it paid." /></div>
          {tips.map((tip, i) => {
            const b = bookingById[tip.booking_id];
            const sitter = sitterById[b?.sitter_id];
            return (
              <div key={tip.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: font.md, fontWeight: 600 }}>{(b?.booking_ref || 'Booking') + ' · ' + (sitter?.users?.name || 'Unknown sitter')}</div>
                  <div style={A.muted}>{sitter?.upi_id ? 'UPI ' + sitter.upi_id : 'No UPI on file'}</div>
                </div>
                <div style={{ ...A.row(12), flexWrap: 'nowrap' }}>
                  <span style={{ fontSize: font.md, fontWeight: 600, color: color.success, ...A.num }}>{'Tip: ' + rsPaise(tip.amount_paise)}</span>
                  <button onClick={() => payTip(tip)} disabled={busy} style={A.small}>Mark tip paid</button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <WaitingList title="Disputed" subtitle="Paused because the parent reported a problem. Release once the Disputes tab is settled." rows={disputed} sitterById={sitterById}
        action={(b) => <button onClick={() => release(b, 'Dispute settled: released by Fursday')} disabled={busy} style={A.small}>Release to Ready</button>} />
      <WaitingList title="On hold" subtitle="Held until 24 hours after the service. Not payable yet." rows={onHold} sitterById={sitterById}
        action={(b) => ['completed', 'cancelled'].includes(b.status) && <button onClick={() => release(b, 'Released early by Fursday')} disabled={busy} style={A.small}>Release now</button>} />    </div>
  );
}
