import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { attentionItems } from './adminInsights';

const LEVEL = {
  critical: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Urgent' },
  warning: { bg: '#FFF3E0', fg: '#E65100', label: 'Today' },
  info: { bg: '#E3F2FD', fg: '#1565C0', label: 'Soon' },
};

export default function AdminAttention({ bookings, sitters, onOpenBooking, onGoTab }) {
  const [disputes, setDisputes] = useState([]);
  const [deletions, setDeletions] = useState([]);

  useEffect(() => {
    (async () => {
      const [{ data: d }, { data: del }] = await Promise.all([
        supabase.from('disputes').select('id, title, status, created_at'),
        supabase.from('account_deletion_requests').select('id, status, requested_at'),
      ]);
      setDisputes(d || []);
      setDeletions(del || []);
    })();
  }, []);

  const items = attentionItems({ bookings, sitters, disputes, deletions });
  const open = (it) => {
    if (it.bookingId) onOpenBooking(it.bookingId);
    else if (it.disputeId) onGoTab('disputes');
    else if (it.sitterId) onGoTab('pending');
    else if (it.kind === 'deletion_due') onGoTab('users');
  };

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Needs attention</div>
        <div style={{ fontSize: 12, color: '#888' }}>{items.length ? items.length + ' item' + (items.length > 1 ? 's' : '') : ''}</div>
      </div>
      {items.length === 0 && <div style={{ fontSize: 13, color: '#2E7D32' }}>✓ Nothing needs you right now.</div>}
      {items.map((it, i) => (
        <button key={i} onClick={() => open(it)}
          style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', border: 'none', borderTop: i ? '1px solid #F2F2F2' : 'none', background: 'none', cursor: 'pointer' }}>
          <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 10, background: LEVEL[it.level].bg, color: LEVEL[it.level].fg, flexShrink: 0, marginTop: 1 }}>{LEVEL[it.level].label}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{it.title}</span>
            <span style={{ display: 'block', fontSize: 12, color: '#666' }}>{it.detail}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
