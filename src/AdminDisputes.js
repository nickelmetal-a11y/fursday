import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { color, font, ui } from './theme';
import Icon from './ui/Icon';
import { A, ChipGroup, Drawer, EmptyState, Facts, Notice, SearchBox, SectionHeader, Skeleton, StatusBadge, Toolbar, usePaged, LoadMore, fmtDate, rsPaise } from './AdminUI';

const DISPUTE_TYPES = {
  refund_request: { label: 'Refund request', icon: 'wallet' },
  quality_complaint: { label: 'Quality issue', icon: 'star' },
  payment_issue: { label: 'Payment problem', icon: 'card' },
  no_show: { label: 'No show', icon: 'clock' },
  safety_concern: { label: 'Safety concern', icon: 'alert' },
};
const typeOf = (d) => DISPUTE_TYPES[d.dispute_type] || { label: d.dispute_type || 'Dispute', icon: 'scale' };
const RESOLUTIONS = [
  { id: 'refund_full', label: '100% Refund' },
  { id: 'refund_partial', label: 'Partial Refund' },
  { id: 'no_refund', label: 'No Refund' },
  { id: 'other', label: 'Other' },
];
const ageDays = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('open');
  const [query, setQuery] = useState('');
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [resolution, setResolution] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState('');

  // All disputes are loaded once and filtered here, so every status count is right.
  const loadDisputes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('disputes')
      .select('*, bookings(booking_ref, gross_amount_paise)')
      .order('created_at', { ascending: false });
    setDisputes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  const closeDetail = () => { setSelectedDispute(null); setResolution(''); setRefundAmount(''); setAdminNotes(''); setFormError(''); };

  const resolveDispute = async (disputeId) => {
    if (!resolution) { setFormError('Please select a resolution'); return; }
    setFormError('');
    setResolving(true);
    try {
      const { error: updateError } = await supabase
        .from('disputes')
        .update({
          status: 'resolved',
          resolution,
          refund_amount: refundAmount ? parseFloat(refundAmount) : null,
          admin_notes: adminNotes,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', disputeId);
      if (updateError) throw updateError;

      try {
        const { data: disputeData } = await supabase
          .from('disputes')
          .select('reported_by, reported_user_id')
          .eq('id', disputeId)
          .single();
        const { notifyDisputeResolved } = await import('./notificationService');
        // Both sides hear the outcome: the person who raised it and the person it was about.
        for (const uid of [disputeData?.reported_by, disputeData?.reported_user_id].filter(Boolean)) {
          const { data: contact } = await supabase.rpc('get_user_contact', { target_id: uid });
          await notifyDisputeResolved(uid, contact?.[0]?.email, contact?.[0]?.phone, 'Fursday', resolution,
            uid === disputeData.reported_by && refundAmount ? parseFloat(refundAmount) * 100 : 0);
        }
      } catch (notifErr) { console.error('Dispute resolution notification failed:', notifErr); }

      closeDetail();
      setMsg('Dispute resolved!');
      loadDisputes();
    } catch (error) {
      setFormError('Error resolving dispute: ' + error.message);
    }
    setResolving(false);
  };

  const count = (s) => (s === 'all' ? disputes.length : disputes.filter(d => d.status === s).length);
  const q = query.trim().toLowerCase();
  const shown = disputes.filter(d => (filterStatus === 'all' || d.status === filterStatus)
    && (!q || [d.title, d.description, d.bookings?.booking_ref, typeOf(d).label].filter(Boolean).some(v => v.toLowerCase().includes(q))));
  const paged = usePaged(shown, 25, filterStatus + '|' + q);
  const d = selectedDispute;

  return (
    <div>
      {msg && <div style={{ marginBottom: 12 }}><Notice tone="success" icon="check">{msg}</Notice></div>}
      <Toolbar>
        <ChipGroup label="Filter disputes by status" value={filterStatus} onChange={setFilterStatus}
          options={['open', 'in_review', 'resolved', 'all'].map(s => ({ id: s, label: (s === 'all' ? 'All' : s === 'in_review' ? 'In review' : s.charAt(0).toUpperCase() + s.slice(1)) + ' (' + count(s) + ')' }))} />
        <SearchBox label="Search disputes" value={query} onChange={setQuery} placeholder="Search title, booking ref or type" />
      </Toolbar>

      {loading && <Skeleton rows={4} label="Loading disputes..." />}

      {!loading && shown.length === 0 && (
        <EmptyState icon="scale" title="No disputes" text={filterStatus === 'open' ? 'No open complaints right now.' : 'Nothing matches this filter.'} />
      )}

      {!loading && shown.length > 0 && (
        <div style={{ ...ui.card, padding: 0, overflow: 'hidden' }}>
          {paged.visible.map((dispute, i) => {
            const t = typeOf(dispute);
            const age = ageDays(dispute.created_at);
            return (
              <button key={dispute.id} onClick={() => { setSelectedDispute(dispute); setMsg(''); }} className="adm-item"
                style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', border: 'none', borderTop: i ? `1px solid ${color.line}` : 'none', background: i % 2 ? color.bg : color.surface, cursor: 'pointer', fontFamily: 'inherit', color: color.ink }}>
                <span style={{ ...ui.iconTile, width: 40, height: 40 }}><Icon name={t.icon} size={20} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: font.md, fontWeight: 600 }}>{t.label}</span>
                  <span style={{ display: 'block', fontSize: font.sm, color: color.muted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{dispute.title} · {dispute.bookings?.booking_ref}</span>
                </span>
                <span style={{ ...A.stack(4), alignItems: 'flex-end', flexShrink: 0 }}>
                  <StatusBadge status={dispute.status} />
                  <span style={{ fontSize: font.xs, color: dispute.status === 'open' && age >= 2 ? color.danger : color.faint }}>{fmtDate(dispute.created_at)}{dispute.status === 'open' ? ' · ' + age + 'd open' : ''}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {!loading && shown.length > 0 && <LoadMore paged={paged} total={shown.length} />}

      {d && (
        <Drawer title={typeOf(d).label} subtitle={'Booking: ' + (d.bookings?.booking_ref || '—')} onClose={closeDetail}>
          <div style={A.row(6)}><StatusBadge status={d.status} /></div>
          <section style={ui.card}>
            <div style={{ fontSize: font.md, fontWeight: 600, marginBottom: 6 }}>{d.title}</div>
            <div style={{ fontSize: font.md, color: color.text, lineHeight: 1.6 }}>{d.description}</div>
            <div style={{ marginTop: 12 }}>
              <Facts items={[
                ['Raised', fmtDate(d.created_at)],
                ['Booking value', d.bookings?.gross_amount_paise ? rsPaise(d.bookings.gross_amount_paise) : '—'],
                d.resolution && ['Resolution', d.resolution.replace(/_/g, ' ')],
                d.refund_amount && ['Refund', 'Rs.' + d.refund_amount],
                d.admin_notes && ['Admin notes', d.admin_notes],
              ]} />
            </div>
          </section>

          {d.status !== 'resolved' && (
            <section style={ui.card}>
              <SectionHeader title="Resolution" />
              <div role="radiogroup" aria-label="Resolution" style={{ ...A.stack(8), marginBottom: 12 }}>
                {RESOLUTIONS.map(opt => (
                  <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36, cursor: 'pointer', fontSize: font.md }}>
                    <input type="radio" name="resolution" value={opt.id} checked={resolution === opt.id} onChange={(e) => setResolution(e.target.value)} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              <div style={A.stack(10)}>
                {resolution.includes('refund') && (
                  <input type="number" aria-label="Refund amount (Rs.)" placeholder="Refund amount (Rs.)" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} style={A.input} />
                )}
                <textarea aria-label="Admin notes" placeholder="Admin notes..." value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} style={A.textarea} />
                {formError && <Notice tone="danger" icon="alert">{formError}</Notice>}
                <button onClick={() => resolveDispute(d.id)} disabled={resolving} style={{ ...A.primary, width: '100%', ...(resolving ? { opacity: 0.7 } : null) }}>
                  {resolving ? 'Resolving...' : 'Resolve Dispute'}
                </button>
              </div>
            </section>
          )}
        </Drawer>
      )}
    </div>
  );
}
