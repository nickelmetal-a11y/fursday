import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import AdminAttention from './AdminAttention';
import { weekOverWeek, unpaidPayouts, sitterNetPaise } from './adminInsights';
import { A, KpiTile, Delta, DataTable, SectionHeader, StatusBadge, EmptyState, rs, rsPaise, serviceLabel } from './AdminUI';

export default function AdminOverview({ bookings, sitters, onOpenBooking, onGoTab }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data } = await supabase.from('users').select('id, created_at');
        if (live) setUsers(Array.isArray(data) ? data : []);
      } catch (e) { console.error('Could not load users for overview:', e); }
    })();
    return () => { live = false; };
  }, []);

  const { current: cur, previous: prev } = weekOverWeek({ bookings, sitters, users });
  const sitterById = Object.fromEntries(sitters.map(s => [s.id, s]));
  const completed = bookings.filter(b => b.status === 'completed');
  const totalGmv = completed.reduce((sum, b) => sum + (b.gross_amount_paise || 0) / 100, 0);
  const payoutsDue = unpaidPayouts(bookings).reduce((sum, b) => sum + sitterNetPaise(b, sitterById[b.sitter_id]) / 100, 0);
  const pendingCount = sitters.filter(s => s.status === 'pending').length;

  const recentColumns = [
    { key: 'ref', label: 'Ref', nowrap: true, render: b => <span style={{ fontWeight: 600 }}>{b.booking_ref}</span> },
    { key: 'parent', label: 'Parent', render: b => b.users?.name || '—' },
    { key: 'sitter', label: 'Sitter', render: b => sitterById[b.sitter_id]?.users?.name || '—' },
    { key: 'service', label: 'Service', nowrap: true, render: b => serviceLabel(b.service_type) },
    { key: 'date', label: 'Date', nowrap: true, render: b => b.booking_date || '—' },
    { key: 'amount', label: 'Amount', align: 'right', render: b => rsPaise(b.gross_amount_paise) },
    { key: 'status', label: 'Status', render: b => <StatusBadge status={b.status} /> },
  ];

  return (
    <div style={A.stack(20)}>
      <section>
        <SectionHeader title="Last 7 days" subtitle="Compared with the 7 days before." />
        <div style={A.grid(180)}>
          <KpiTile label="New bookings" value={cur.bookings} sub={<Delta current={cur.bookings} previous={prev.bookings} />} />
          <KpiTile label="GMV completed" value={rs(cur.gmv)} sub={<Delta current={cur.gmv} previous={prev.gmv} format={rs} />} />
          <KpiTile label="New parents" value={cur.newParents} sub={<Delta current={cur.newParents} previous={prev.newParents} />} />
          <KpiTile label="New sitters" value={cur.newSitters} sub={<Delta current={cur.newSitters} previous={prev.newSitters} />} />
          <KpiTile label="Cancellation rate" value={cur.cancelRate + '%'} sub={<Delta current={cur.cancelRate} previous={prev.cancelRate} format={n => n + ' pts'} higherIsBetter={false} />} />
        </div>
      </section>

      <AdminAttention bookings={bookings} sitters={sitters} onOpenBooking={onOpenBooking} onGoTab={onGoTab} />

      <section>
        <SectionHeader title="All time" />
        <div style={A.grid(150)}>
          <KpiTile label="Pending" value={pendingCount} tone={pendingCount ? 'warning' : undefined} />
          <KpiTile label="Active sitters" value={sitters.filter(s => s.status === 'active').length} />
          <KpiTile label="Bookings" value={bookings.length} />
          <KpiTile label="Completed" value={completed.length} />
          <KpiTile label="GMV" value={rs(totalGmv)} />
          <KpiTile label="Payouts due" value={rs(payoutsDue)} tone={payoutsDue ? 'danger' : undefined} />
        </div>
      </section>

      <section>
        <SectionHeader title="Recent bookings" action={<button onClick={() => onGoTab('bookings')} style={A.small}>All bookings</button>} />
        {bookings.length === 0
          ? <EmptyState icon="calendar" title="No bookings yet" />
          : <DataTable label="Recent bookings" columns={recentColumns} rows={bookings.slice(0, 8)} onRowClick={b => onOpenBooking(b.id)} />}
      </section>
    </div>
  );
}
