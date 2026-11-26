import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { color, font, ui } from './theme';
import Icon from './ui/Icon';
import { attentionItems } from './adminInsights';
import { Badge, SectionHeader } from './AdminUI';

const LEVEL = {
  critical: { tone: 'danger', label: 'Urgent', icon: 'alert' },
  warning: { tone: 'warning', label: 'Today', icon: 'clock' },
  info: { tone: 'info', label: 'Soon', icon: 'info' },
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
    <section style={ui.card}>
      <SectionHeader title="Needs attention" subtitle="Most urgent first. Open an item to act on it."
        action={items.length ? <Badge tone={items.some(i => i.level === 'critical') ? 'danger' : 'warning'}>{items.length + ' item' + (items.length > 1 ? 's' : '')}</Badge> : null} />
      {items.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: font.md, color: color.success }}>
          <Icon name="check" size={18} />Nothing needs you right now.
        </div>
      )}
      {items.map((it, i) => (
        <button key={i} onClick={() => open(it)}
          style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', border: 'none', borderTop: i ? `1px solid ${color.line}` : 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: color.ink }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}><Badge tone={LEVEL[it.level].tone} icon={LEVEL[it.level].icon}>{LEVEL[it.level].label}</Badge></span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: font.md, fontWeight: 600 }}>{it.title}</span>
            <span style={{ display: 'block', fontSize: font.sm, color: color.muted, lineHeight: 1.5 }}>{it.detail}</span>
          </span>
          <Icon name="chevronRight" size={18} color={color.faint} style={{ marginTop: 2 }} />
        </button>
      ))}
    </section>
  );
}
