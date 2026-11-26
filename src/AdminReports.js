import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { color, radius } from './theme';
import Icon from './ui/Icon';
import { A, ChipGroup, DataTable, EmptyState, KpiTile, SectionHeader, Skeleton } from './AdminUI';

const rupees = (paise) => Math.round((paise || 0) / 100);
const inr = (n) => 'Rs.' + Math.round(n).toLocaleString('en-IN');

// Monday of the booking's week, as YYYY-MM-DD, so weeks sort as strings.
export const weekStart = (iso) => {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
};

// Fursday keeps commission on the sitter's price; promo discounts come out of that.
export const platformTake = (b, rate) => (b.gross_amount_paise || 0) - Math.round((b.sitter_payout_paise || b.gross_amount_paise || 0) * (1 - rate));

export const toCsv = (rows) => {
  const cols = ['booking_ref', 'booking_date', 'time_slot', 'service_type', 'status', 'payment_status', 'payout_status', 'city', 'parent_paid_rs', 'sitter_price_rs', 'refund_rs'];
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [cols.join(','), ...rows.map(b => [b.booking_ref, b.booking_date, b.time_slot, b.service_type, b.status, b.payment_status, b.payout_status, b.cities?.name,
    rupees(b.gross_amount_paise), rupees(b.sitter_payout_paise || b.gross_amount_paise), rupees(b.refund_amount_paise)].map(esc).join(','))].join('\n');
};

export default function AdminReports() {
  const [all, setAll] = useState([]);
  const [founding, setFounding] = useState({});
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState('all');

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: sp }] = await Promise.all([
        supabase.from('bookings').select('*, cities(name)').order('created_at', { ascending: false }),
        supabase.from('sitter_profiles').select('id, is_founding_sitter'),
      ]);
      setAll(b || []);
      setFounding(Object.fromEntries((sp || []).map(s => [s.id, !!s.is_founding_sitter])));
      setLoading(false);
    })();
  }, []);

  if (loading) return <Skeleton rows={5} label="Loading reports..." />;

  const cities = [...new Set(all.map(b => b.cities?.name).filter(Boolean))].sort();
  const bookings = city === 'all' ? all : all.filter(b => b.cities?.name === city);
  const rate = (b) => (founding[b.sitter_id] ? 0 : 0.15);
  const completed = bookings.filter(b => b.status === 'completed');
  const cancelled = bookings.filter(b => b.status === 'cancelled');
  const gmv = completed.reduce((a, b) => a + rupees(b.gross_amount_paise), 0);
  const take = completed.reduce((a, b) => a + platformTake(b, rate(b)) / 100, 0);
  const refunds = cancelled.reduce((a, b) => a + rupees(b.refund_amount_paise), 0);
  const cancelRate = bookings.length ? Math.round((cancelled.length / bookings.length) * 100) : 0;

  const weeks = {};
  bookings.forEach(b => {
    const k = weekStart(b.booking_date || b.created_at);
    weeks[k] = weeks[k] || { bookings: 0, completed: 0, gmv: 0, take: 0 };
    weeks[k].bookings += 1;
    if (b.status === 'completed') { weeks[k].completed += 1; weeks[k].gmv += rupees(b.gross_amount_paise); weeks[k].take += platformTake(b, rate(b)) / 100; }
  });
  const weekRows = Object.entries(weeks).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 12).map(([wk, w]) => ({ id: wk, ...w }));
  const maxGmv = Math.max(1, ...weekRows.map(w => w.gmv));

  const download = () => {
    const blob = new Blob([toCsv(bookings)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fursday-bookings-' + (city === 'all' ? '' : city.toLowerCase() + '-') + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
  };

  const columns = [
    { key: 'week', label: 'Week of', nowrap: true, render: w => new Date(w.id).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
    { key: 'bookings', label: 'Bookings', align: 'right' },
    { key: 'completed', label: 'Completed', align: 'right' },
    { key: 'gmv', label: 'GMV', align: 'right', render: w => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 160 }}>
        <div aria-hidden="true" style={{ height: 8, borderRadius: radius.sm, background: color.navy, width: Math.max(2, (w.gmv / maxGmv) * 90) + 'px' }} />
        <span>{inr(w.gmv)}</span>
      </div>
    ) },
    { key: 'take', label: 'Revenue', align: 'right', render: w => inr(w.take) },
  ];

  return (
    <div style={A.stack(16)}>
      {cities.length > 1 && (
        <ChipGroup label="Filter reports by city" value={city} onChange={setCity} options={[{ id: 'all', label: 'All cities' }, ...cities.map(c => ({ id: c, label: c }))]} />
      )}
      <div style={A.grid(170)}>
        <KpiTile label="Completed bookings" value={completed.length} />
        <KpiTile label="GMV (completed)" value={inr(gmv)} />
        <KpiTile label="Fursday revenue" value={inr(take)} tone={take < 0 ? 'danger' : 'success'} />
        <KpiTile label="Refunded" value={inr(refunds)} />
        <KpiTile label="Cancellation rate" value={cancelRate + '%'} tone={cancelRate >= 20 ? 'danger' : undefined} />
      </div>

      <section>
        <SectionHeader title="By week (last 12)" subtitle="Revenue is Fursday's commission after Founding Sitter and promo costs."
          action={<button onClick={download} style={A.primary}><Icon name="download" size={18} />Download bookings (CSV)</button>} />
        {weekRows.length === 0
          ? <EmptyState icon="chart" title="No bookings yet." />
          : <DataTable label="Bookings by week" columns={columns} rows={weekRows} />}
      </section>
    </div>
  );
}
