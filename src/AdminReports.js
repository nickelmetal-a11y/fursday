import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

const ORANGE = '#FF6B35';
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
  const [bookings, setBookings] = useState([]);
  const [founding, setFounding] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: sp }] = await Promise.all([
        supabase.from('bookings').select('*, cities(name)').order('created_at', { ascending: false }),
        supabase.from('sitter_profiles').select('id, is_founding_sitter'),
      ]);
      setBookings(b || []);
      setFounding(Object.fromEntries((sp || []).map(s => [s.id, !!s.is_founding_sitter])));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ color: '#888', fontSize: 14 }}>Loading reports...</div>;

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
  const weekRows = Object.entries(weeks).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 12);
  const maxGmv = Math.max(1, ...weekRows.map(([, w]) => w.gmv));

  const download = () => {
    const blob = new Blob([toCsv(bookings)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fursday-bookings-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
  };

  const tile = (label, value, color) => (
    <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        {tile('Completed bookings', completed.length, '#6A1B9A')}
        {tile('GMV (completed)', inr(gmv), ORANGE)}
        {tile('Fursday revenue', inr(take), '#2E7D32')}
        {tile('Refunded', inr(refunds), '#C62828')}
        {tile('Cancellation rate', cancelRate + '%', '#E65100')}
      </div>

      <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>By week (last 12)</div>
          <button onClick={download} style={{ minHeight: 38, padding: '0 14px', borderRadius: 8, border: 'none', background: ORANGE, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>⬇ Download all bookings (CSV)</button>
        </div>
        {weekRows.length === 0 && <div style={{ fontSize: 13, color: '#888' }}>No bookings yet.</div>}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            <thead><tr style={{ textAlign: 'left', color: '#888', fontSize: 11, textTransform: 'uppercase' }}>
              <th style={{ padding: '6px 8px' }}>Week of</th><th style={{ padding: '6px 8px' }}>Bookings</th><th style={{ padding: '6px 8px' }}>Completed</th><th style={{ padding: '6px 8px', minWidth: 160 }}>GMV</th><th style={{ padding: '6px 8px' }}>Revenue</th>
            </tr></thead>
            <tbody>
              {weekRows.map(([wk, w]) => (
                <tr key={wk} style={{ borderTop: '1px solid #F2F2F2' }}>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{new Date(wk).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td style={{ padding: 8 }}>{w.bookings}</td>
                  <td style={{ padding: 8 }}>{w.completed}</td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ height: 8, borderRadius: 4, background: ORANGE, width: Math.max(2, (w.gmv / maxGmv) * 100) + 'px' }} />
                      {inr(w.gmv)}
                    </div>
                  </td>
                  <td style={{ padding: 8 }}>{inr(w.take)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
