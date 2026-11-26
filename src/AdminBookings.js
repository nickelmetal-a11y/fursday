import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const ORANGE = '#FF6B35';
const STATUS = {
  pending: { bg: '#FFF3E0', fg: '#E65100' }, confirmed: { bg: '#E3F2FD', fg: '#1565C0' },
  active: { bg: '#E8F5E9', fg: '#2E7D32' }, completed: { bg: '#F3E5F5', fg: '#6A1B9A' }, cancelled: { bg: '#FCEBEB', fg: '#A32D2D' },
};
const rs = (paise) => 'Rs.' + Math.round((paise || 0) / 100);

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

// Operations view of every booking: find one fast, then act on it the way a
// marketplace ops team would: cancel with refund, reassign the sitter, keep notes.
export default function AdminBookings({ bookings, sitters, focusId, onChanged }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState(focusId || null);
  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState('');
  const [reassignTo, setReassignTo] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { if (focusId) setOpenId(focusId); }, [focusId]);
  const sitterById = useMemo(() => Object.fromEntries(sitters.map(s => [s.id, s])), [sitters]);
  const open = bookings.find(b => b.id === openId) || null;

  useEffect(() => {
    if (!openId) return;
    supabase.from('admin_audit_logs').select('*').eq('resource_id', openId).order('created_at', { ascending: false })
      .then(({ data }) => setNotes((data || []).filter(r => r.resource_type === 'bookings')));
  }, [openId]);

  const filtered = bookings.filter(b => {
    if (status !== 'all' && b.status !== status) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [b.booking_ref, b.users?.name, sitterById[b.sitter_id]?.users?.name, b.cities?.name].filter(Boolean).some(v => v.toLowerCase().includes(q));
  });

  const sitterUserId = (b) => sitterById[b.sitter_id]?.user_id;

  const cancelWithRefund = async (b) => {
    const reason = window.prompt('Why is Fursday cancelling this booking? Both sides will see this.');
    if (!reason) return;
    const paid = b.payment_status === 'paid';
    const { error } = await supabase.from('bookings').update({
      status: 'cancelled', cancellation_reason: 'Fursday: ' + reason, cancelled_at: new Date().toISOString(),
      refund_percentage: paid ? 100 : 0, refund_amount_paise: paid ? (b.gross_amount_paise || 0) : 0,
    }).eq('id', b.id);
    if (error) { setMsg('Could not cancel: ' + error.message); return; }
    await notify(b.pet_parent_id, 'booking_cancelled', 'Fursday cancelled booking ' + b.booking_ref, reason + (paid ? ' You will get a full refund.' : ''));
    await notify(sitterUserId(b), 'booking_cancelled', 'Fursday cancelled booking ' + b.booking_ref, reason);
    await audit('admin_cancel_booking', b.id, reason, { refund_paise: paid ? b.gross_amount_paise : 0 });
    setMsg('Cancelled' + (paid ? ' with a full refund of ' + rs(b.gross_amount_paise) : ''));
    onChanged();
  };

  const reassign = async (b) => {
    const target = sitterById[reassignTo];
    if (!target) return;
    if (!window.confirm('Move ' + b.booking_ref + ' to ' + (target.users?.name || 'this sitter') + '?')) return;
    const { error } = await supabase.from('bookings').update({ sitter_id: target.id, status: 'pending' }).eq('id', b.id);
    if (error) { setMsg('Could not reassign: ' + error.message); return; }
    await notify(target.user_id, 'booking_request', 'New booking request ' + b.booking_ref, 'Fursday assigned you a ' + b.service_type + ' on ' + (b.booking_date || '') + ' ' + (b.time_slot || '') + '. Please accept or decline.');
    await notify(b.pet_parent_id, 'booking_reassigned', 'Your booking has a new sitter', (target.users?.name || 'A new sitter') + ' will take ' + b.booking_ref + '.');
    await notify(sitterUserId(b), 'booking_reassigned', 'Booking ' + b.booking_ref + ' moved to another sitter', 'Fursday reassigned this booking.');
    await audit('admin_reassign_booking', b.id, 'From ' + (sitterById[b.sitter_id]?.users?.name || b.sitter_id) + ' to ' + (target.users?.name || target.id), { sitter_id: target.id });
    setReassignTo('');
    setMsg('Reassigned to ' + (target.users?.name || 'new sitter'));
    onChanged();
  };

  const addNote = async (b) => {
    if (!note.trim()) return;
    await audit('booking_note', b.id, note.trim());
    setNotes(n => [{ id: 'local-' + Date.now(), action: 'booking_note', reason: note.trim(), created_at: new Date().toISOString() }, ...n]);
    setNote('');
  };

  const candidates = open ? sitters.filter(s => s.status === 'active' && s.id !== open.sitter_id && (!open.city_id || s.city_id === open.city_id)) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {msg && <div role="status" style={{ background: '#E8F5E9', color: '#2E7D32', borderRadius: 10, padding: '8px 12px', fontSize: 13 }}>{msg}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input aria-label="Search bookings" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search ref, parent, sitter or city"
          style={{ flex: 1, minWidth: 200, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0E0E0', fontSize: 14 }} />
        <select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0E0E0', fontSize: 14 }}>
          {['all', 'pending', 'confirmed', 'active', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 12, color: '#888' }}>{filtered.length} of {bookings.length} bookings</div>

      {filtered.map(b => {
        const isOpen = b.id === openId;
        const sc = STATUS[b.status] || STATUS.pending;
        return (
          <div key={b.id} style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: isOpen ? '1.5px solid ' + ORANGE : '1.5px solid transparent' }}>
            <button onClick={() => { setOpenId(isOpen ? null : b.id); setMsg(''); }} aria-expanded={isOpen}
              style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{b.booking_ref} · {b.service_type}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#666' }}>{b.users?.name || 'Parent'} → {sitterById[b.sitter_id]?.users?.name || 'Sitter'} · {b.booking_date || '—'} {b.time_slot || ''} · {b.cities?.name || ''}</span>
              </span>
              <span style={{ textAlign: 'right', flexShrink: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{rs(b.gross_amount_paise)}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: sc.bg, color: sc.fg }}>{b.status}</span>
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 14px 14px', borderTop: '1px solid #F2F2F2', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, fontSize: 12, paddingTop: 12 }}>
                  {[['Payment', b.payment_status || 'unpaid'], ['Payout', b.payout_status || 'pending'], ['Sitter price', rs(b.sitter_payout_paise || b.gross_amount_paise)], ['Refund', b.refund_amount_paise ? rs(b.refund_amount_paise) : '—'], ['Started', b.start_verified_at ? new Date(b.start_verified_at).toLocaleString('en-IN') : '—'], ['Reason', b.cancellation_reason || '—']].map(([k, v]) => (
                    <div key={k}><div style={{ color: '#888' }}>{k}</div><div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{v}</div></div>
                  ))}
                </div>
                {['pending', 'confirmed'].includes(b.status) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select aria-label="Reassign to" value={reassignTo} onChange={e => setReassignTo(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E0E0E0', fontSize: 13, minWidth: 180 }}>
                      <option value="">Reassign to another sitter…</option>
                      {candidates.map(s => <option key={s.id} value={s.id}>{s.users?.name || s.id}</option>)}
                    </select>
                    <button onClick={() => reassign(b)} disabled={!reassignTo} style={{ minHeight: 36, padding: '0 12px', borderRadius: 8, border: 'none', background: '#E3F2FD', color: '#1565C0', fontSize: 13, fontWeight: 700, cursor: reassignTo ? 'pointer' : 'not-allowed', opacity: reassignTo ? 1 : 0.5 }}>Reassign</button>
                  </div>
                )}
                {['pending', 'confirmed', 'active'].includes(b.status) && (
                  <button onClick={() => cancelWithRefund(b)} style={{ alignSelf: 'flex-start', minHeight: 36, padding: '0 14px', borderRadius: 8, border: 'none', background: '#FCEBEB', color: '#A32D2D', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Cancel with full refund
                  </button>
                )}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>Admin notes and history</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input aria-label="Add a note" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote(b)} placeholder="e.g. Called parent, sitter running 10 min late"
                      style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E0E0E0', fontSize: 13 }} />
                    <button onClick={() => addNote(b)} style={{ minHeight: 36, padding: '0 12px', borderRadius: 8, border: 'none', background: ORANGE, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add</button>
                  </div>
                  {notes.length === 0 && <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>No notes yet.</div>}
                  {notes.map(n => (
                    <div key={n.id} style={{ fontSize: 12, color: '#444', padding: '6px 0', borderBottom: '1px solid #F5F5F5' }}>
                      <span style={{ color: '#999' }}>{new Date(n.created_at).toLocaleString('en-IN')} · {n.action === 'booking_note' ? 'Note' : n.action.replace(/_/g, ' ')}</span><br />{n.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
