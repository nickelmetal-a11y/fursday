import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { color, font, ui } from './theme';
import Icon from './ui/Icon';
import {
  A, Badge, StatusBadge, EmptyState, DataTable, SearchBox, Toolbar, usePaged, LoadMore, Drawer, Facts, Notice,
  SectionHeader, ConfirmDialog, TONE, rsPaise, fmtDateTime, serviceLabel, humanize,
} from './AdminUI';
import { cancelBooking as cancelOnServer, moneyInHand, serverUnavailable } from './paymentsClient';

const rs = rsPaise;
const STATUSES = ['all', 'pending', 'confirmed', 'active', 'completed', 'cancelled'];

const notify = async (userId, type, title, body) => {
  if (!userId) return;
  try { const { createNotification } = await import('./notificationService'); await createNotification(userId, type, title, body); }
  catch (e) { console.error('Notification failed:', e); }
};
const audit = async (action, bookingId, reason, newValue) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('admin_audit_logs').insert({ admin_id: user.id, action, resource_type: 'bookings', resource_id: bookingId, new_value: newValue || null, reason, status: 'success' });
};

const dayOf = (b) => b.booking_date || (b.created_at || '').slice(0, 10);

// Operations view of every booking: find one fast, then act on it the way a
// marketplace ops team would: cancel with refund, reassign the sitter, keep notes.
export default function AdminBookings({ bookings, sitters, focusId, onChanged }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [city, setCity] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openId, setOpenId] = useState(focusId || null);
  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [msg, setMsg] = useState(null);
  const [dialog, setDialog] = useState(null); // 'cancel' | 'reassign' | 'refund'
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (focusId) setOpenId(focusId); }, [focusId]);
  const sitterById = useMemo(() => Object.fromEntries(sitters.map(s => [s.id, s])), [sitters]);
  const cities = useMemo(() => {
    const m = {};
    bookings.forEach(b => { if (b.city_id || b.cities?.name) m[b.city_id || b.cities.name] = b.cities?.name || b.city_id; });
    return Object.entries(m).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  }, [bookings]);
  const open = bookings.find(b => b.id === openId) || null;

  useEffect(() => {
    if (!openId) return;
    setReassignTo(''); setNote('');
    supabase.from('admin_audit_logs').select('*').eq('resource_id', openId).order('created_at', { ascending: false })
      .then(({ data }) => setNotes((data || []).filter(r => r.resource_type === 'bookings')));
  }, [openId]);

  const q = query.trim().toLowerCase();
  const filtered = bookings.filter(b => {
    if (status !== 'all' && b.status !== status) return false;
    if (city !== 'all' && (b.city_id || b.cities?.name) !== city) return false;
    if (from && dayOf(b) < from) return false;
    if (to && dayOf(b) > to) return false;
    if (!q) return true;
    return [b.booking_ref, b.users?.name, sitterById[b.sitter_id]?.users?.name, b.cities?.name].filter(Boolean).some(v => v.toLowerCase().includes(q));
  });
  const filterKey = [q, status, city, from, to].join('|');
  const paged = usePaged(filtered, 25, filterKey);
  const anyFilter = q || status !== 'all' || city !== 'all' || from || to;

  const sitterUserId = (b) => sitterById[b.sitter_id]?.user_id;
  const done = (text) => { setMsg({ tone: 'success', text }); onChanged(text); };

  const cancelWithRefund = async (b) => {
    const why = reason.trim();
    if (!why) return;
    setBusy(true);
    const paid = moneyInHand(b);
    // The server refunds held money through Razorpay. If it can't be reached the
    // cancellation is still recorded, and the refund must be sent by hand.
    let error = null, manual = false;
    if (paid) {
      try { manual = (await cancelOnServer(b.id, 'Fursday: ' + why)).outcome === 'refund_manual'; }
      catch (e) { if (serverUnavailable(e)) manual = null; else error = e; }
    }
    if (!paid || manual === null) {
      ({ error } = await supabase.from('bookings').update({
        status: 'cancelled', cancellation_reason: 'Fursday: ' + why, cancelled_at: new Date().toISOString(),
        refund_percentage: paid ? 100 : 0, refund_amount_paise: paid ? (b.gross_amount_paise || 0) : 0,
      }).eq('id', b.id));
      manual = paid;
    }
    setBusy(false); setDialog(null); setReason('');
    if (error) { setMsg({ tone: 'danger', text: 'Could not cancel: ' + error.message }); return; }
    await notify(b.pet_parent_id, 'booking_cancelled', 'Fursday cancelled booking ' + b.booking_ref, why + (paid ? ' You will get a full refund.' : ''));
    await notify(sitterUserId(b), 'booking_cancelled', 'Fursday cancelled booking ' + b.booking_ref, why);
    await audit('admin_cancel_booking', b.id, why, { refund_paise: paid ? b.gross_amount_paise : 0 });
    done('Cancelled' + (paid ? ' with a full refund of ' + rs(b.gross_amount_paise) + (manual ? '. Send the refund by hand: the payment could not be refunded automatically' : '') : ''));
  };

  // A refund the server could not send through Razorpay is sent by hand, then recorded here.
  const refundOwed = (b) => b.status === 'cancelled' && ['held', 'paid'].includes(b.payment_status) && (b.refund_amount_paise || 0) > (b.refunded_amount_paise || 0);
  const markRefundSent = async (b) => {
    setBusy(true);
    const owed = (b.refund_amount_paise || 0) - (b.refunded_amount_paise || 0);
    const { error } = await supabase.from('bookings').update({
      refunded_amount_paise: b.refund_amount_paise, payment_status: b.refund_amount_paise >= (b.gross_amount_paise || 0) ? 'refunded' : 'partially_refunded',
    }).eq('id', b.id);
    setBusy(false); setDialog(null);
    if (error) { setMsg({ tone: 'danger', text: 'Could not record the refund: ' + error.message }); return; }
    await supabase.from('payment_events').insert({ booking_id: b.id, kind: 'refunded', amount_paise: owed, note: 'Refunded by hand by Fursday' });
    await notify(b.pet_parent_id, 'payment_refunded', 'Refund sent for ' + b.booking_ref, rs(owed) + ' has been sent back to you. Your bank may take a few days to show it.');
    await audit('admin_refund_sent', b.id, 'Refund of ' + rs(owed) + ' sent by hand', { refund_paise: owed });
    done('Refund of ' + rs(owed) + ' recorded as sent');
  };

  const reassign = async (b) => {
    const target = sitterById[reassignTo];
    if (!target) return;
    setBusy(true);
    const { error } = await supabase.from('bookings').update({ sitter_id: target.id, status: 'pending' }).eq('id', b.id);
    setBusy(false); setDialog(null);
    if (error) { setMsg({ tone: 'danger', text: 'Could not reassign: ' + error.message }); return; }
    await notify(target.user_id, 'booking_request', 'New booking request ' + b.booking_ref, 'Fursday assigned you a ' + b.service_type + ' on ' + (b.booking_date || '') + ' ' + (b.time_slot || '') + '. Please accept or decline.');
    await notify(b.pet_parent_id, 'booking_reassigned', 'Your booking has a new sitter', (target.users?.name || 'A new sitter') + ' will take ' + b.booking_ref + '.');
    await notify(sitterUserId(b), 'booking_reassigned', 'Booking ' + b.booking_ref + ' moved to another sitter', 'Fursday reassigned this booking.');
    await audit('admin_reassign_booking', b.id, 'From ' + (sitterById[b.sitter_id]?.users?.name || b.sitter_id) + ' to ' + (target.users?.name || target.id), { sitter_id: target.id });
    setReassignTo('');
    done('Reassigned to ' + (target.users?.name || 'new sitter'));
  };

  const addNote = async (b) => {
    if (!note.trim()) return;
    await audit('booking_note', b.id, note.trim());
    setNotes(n => [{ id: 'local-' + Date.now(), action: 'booking_note', reason: note.trim(), created_at: new Date().toISOString() }, ...n]);
    setNote('');
  };

  const candidates = open ? sitters.filter(s => s.status === 'active' && s.id !== open.sitter_id && (!open.city_id || s.city_id === open.city_id)) : [];

  const columns = [
    { key: 'ref', label: 'Ref', nowrap: true, render: b => (
      <button onClick={e => { e.stopPropagation(); setOpenId(b.id); setMsg(null); }} style={{ background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: font.md, fontWeight: 600, color: color.navy, cursor: 'pointer' }}>{b.booking_ref}</button>
    ) },
    { key: 'when', label: 'Date', nowrap: true, render: b => <><div>{b.booking_date || '—'}</div><div style={{ ...A.muted, fontSize: font.xs }}>{b.time_slot || ''}</div></> },
    { key: 'service', label: 'Service', nowrap: true, render: b => serviceLabel(b.service_type) },
    { key: 'people', label: 'Parent → sitter', render: b => <span>{b.users?.name || 'Parent'} → {sitterById[b.sitter_id]?.users?.name || 'Sitter'}</span> },
    { key: 'city', label: 'City', nowrap: true, render: b => b.cities?.name || '—' },
    { key: 'amount', label: 'Amount', align: 'right', render: b => rs(b.gross_amount_paise) },
    { key: 'payment', label: 'Payment', render: b => <Badge tone={TONE[b.payment_status || 'unpaid'] || 'neutral'}>{humanize(b.payment_status || 'unpaid')}</Badge> },
    { key: 'status', label: 'Status', render: b => <StatusBadge status={b.status} /> },
  ];

  return (
    <div>
      {msg && !open && <div style={{ marginBottom: 12 }}><Notice tone={msg.tone} icon={msg.tone === 'danger' ? 'alert' : 'check'}>{msg.text}</Notice></div>}
      <Toolbar>
        <SearchBox label="Search bookings" value={query} onChange={setQuery} placeholder="Search ref, parent, sitter or city" />
        <select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)} style={A.select}>
          {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : humanize(s)}</option>)}
        </select>
        <select aria-label="Filter by city" value={city} onChange={e => setCity(e.target.value)} style={A.select}>
          <option value="all">All cities</option>
          {cities.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <label style={{ ...A.row(6), flexWrap: 'nowrap', ...A.muted }}>From
          <input type="date" aria-label="From date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} style={{ ...A.select, padding: '8px 10px' }} />
        </label>
        <label style={{ ...A.row(6), flexWrap: 'nowrap', ...A.muted }}>To
          <input type="date" aria-label="To date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} style={{ ...A.select, padding: '8px 10px' }} />
        </label>
        {anyFilter && <button onClick={() => { setQuery(''); setStatus('all'); setCity('all'); setFrom(''); setTo(''); }} style={A.small}>Clear filters</button>}
      </Toolbar>
      <div style={{ ...A.muted, marginBottom: 8 }}>{filtered.length} of {bookings.length} bookings</div>

      {filtered.length === 0
        ? <EmptyState icon="calendar" title="No bookings match" text={anyFilter ? 'Try clearing a filter.' : 'Bookings will appear here.'} />
        : <>
          <DataTable label="Bookings" columns={columns} rows={paged.visible} onRowClick={b => { setOpenId(b.id); setMsg(null); }} />
          <LoadMore paged={paged} total={filtered.length} />
        </>}

      {open && (
        <Drawer title={open.booking_ref} subtitle={serviceLabel(open.service_type) + ' · ' + (open.booking_date || '—') + ' ' + (open.time_slot || '')} onClose={() => { setOpenId(null); setMsg(null); }}>
          {msg && <Notice tone={msg.tone} icon={msg.tone === 'danger' ? 'alert' : 'check'}>{msg.text}</Notice>}
          <div style={A.row(6)}>
            <StatusBadge status={open.status} />
            <Badge tone={TONE[open.payment_status || 'unpaid'] || 'neutral'}>{'Payment ' + (open.payment_status || 'unpaid')}</Badge>
            <Badge tone={open.payout_status === 'paid' ? 'success' : open.payout_status === 'disputed' ? 'warning' : 'neutral'}>{'Payout ' + humanize(open.payout_status || 'pending').toLowerCase()}</Badge>
          </div>
          <section style={ui.card}>
            <Facts items={[
              ['Parent', open.users?.name || '—'], ['Sitter', sitterById[open.sitter_id]?.users?.name || '—'], ['City', open.cities?.name || '—'],
              ['Parent paid', rs(open.gross_amount_paise)], ['Sitter price', rs(open.sitter_payout_paise || open.gross_amount_paise)],
              ['Refund', open.refund_amount_paise ? rs(open.refund_amount_paise) + (open.refunded_amount_paise ? ' (' + rs(open.refunded_amount_paise) + ' sent)' : '') : '—'],
              open.payout_release_at && ['Payout release', fmtDateTime(open.payout_release_at)],
              ['Started', open.start_verified_at ? new Date(open.start_verified_at).toLocaleString('en-IN') : '—'],
              ['Completed', open.completed_at ? new Date(open.completed_at).toLocaleString('en-IN') : '—'],
              (open.address_area || open.address_pincode) && ['Area', [open.address_area, open.address_pincode].filter(Boolean).join(' ')],
              ['Reason', open.cancellation_reason || '—'],
            ]} />
          </section>

          {['pending', 'confirmed', 'active'].includes(open.status) && (
            <section style={ui.card}>
              <SectionHeader title="Actions" />
              <div style={A.stack(12)}>
                {['pending', 'confirmed'].includes(open.status) && (
                  <div style={A.row(8)}>
                    <select aria-label="Reassign to" value={reassignTo} onChange={e => setReassignTo(e.target.value)} style={{ ...A.select, flex: 1, minWidth: 180 }}>
                      <option value="">Reassign to another sitter…</option>
                      {candidates.map(s => <option key={s.id} value={s.id}>{s.users?.name || s.id}</option>)}
                    </select>
                    <button onClick={() => setDialog('reassign')} disabled={!reassignTo} style={{ ...A.secondary, ...(reassignTo ? null : A.disabled) }}>Reassign</button>
                  </div>
                )}
                <button onClick={() => { setReason(''); setDialog('cancel'); }} style={{ ...A.danger, alignSelf: 'flex-start' }}>Cancel with full refund</button>
              </div>
            </section>
          )}

          {refundOwed(open) && (
            <section style={ui.card}>
              <Notice tone="warning" icon="alert">{'Refund of ' + rs(open.refund_amount_paise - (open.refunded_amount_paise || 0)) + " has not gone back to the parent: it could not be sent automatically. Send it by hand to the parent's original payment method, then record it."}</Notice>
              <button onClick={() => setDialog('refund')} style={{ ...A.primary, alignSelf: 'flex-start', marginTop: 12 }}>Mark refund sent</button>
            </section>
          )}

          <section style={ui.card}>
            <SectionHeader title="Admin notes and history" />
            <div style={A.row(8)}>
              <input aria-label="Add a note" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote(open)} placeholder="e.g. Called parent, sitter running 10 min late"
                style={{ ...A.input, flex: 1, minWidth: 180 }} />
              <button onClick={() => addNote(open)} style={A.primary}>Add</button>
            </div>
            {notes.length === 0 && <div style={{ ...A.muted, marginTop: 8 }}>No notes yet.</div>}
            {notes.map((n, i) => (
              <div key={n.id} style={{ padding: '10px 0', borderTop: i ? `1px solid ${color.line}` : 'none', marginTop: i ? 0 : 8 }}>
                <div style={{ ...A.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name={n.action === 'booking_note' ? 'edit' : 'history'} size={14} />
                  {fmtDateTime(n.created_at)} · {n.action === 'booking_note' ? 'Note' : n.action.replace(/_/g, ' ')}
                </div>
                <div style={{ fontSize: font.md, marginTop: 2 }}>{n.reason}</div>
              </div>
            ))}
          </section>
        </Drawer>
      )}

      {open && dialog === 'cancel' && (
        <ConfirmDialog title={'Cancel ' + open.booking_ref + '?'} tone="danger" confirmLabel="Cancel booking" cancelLabel="Keep booking" busy={busy} disabled={!reason.trim()}
          onCancel={() => setDialog(null)} onConfirm={() => cancelWithRefund(open)}>
          <div style={A.stack(8)}>
            <div>{moneyInHand(open) ? 'The parent gets a full refund of ' + rs(open.gross_amount_paise) + '.' : 'The parent has not paid, so there is nothing to refund.'} Both sides will see your reason.</div>
            <textarea aria-label="Reason for cancelling" value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="e.g. Sitter unwell, no replacement available" style={A.textarea} />
          </div>
        </ConfirmDialog>
      )}
      {open && dialog === 'refund' && (
        <ConfirmDialog title={'Record the refund for ' + open.booking_ref + '?'} confirmLabel="Yes, it was sent" busy={busy} onCancel={() => setDialog(null)} onConfirm={() => markRefundSent(open)}>
          {'Only do this after ' + rs(open.refund_amount_paise - (open.refunded_amount_paise || 0)) + ' has gone back to ' + (open.users?.name || 'the parent') + '. They will be told it was sent.'}
        </ConfirmDialog>
      )}
      {open && dialog === 'reassign' && sitterById[reassignTo] && (
        <ConfirmDialog title="Reassign this booking?" confirmLabel="Yes, reassign" busy={busy} onCancel={() => setDialog(null)} onConfirm={() => reassign(open)}>
          {'Move ' + open.booking_ref + ' to ' + (sitterById[reassignTo].users?.name || 'this sitter') + '? It goes back to pending until they accept, and all three people are notified.'}
        </ConfirmDialog>
      )}
    </div>
  );
}
