import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, Wallet, DollarSign } from 'lucide-react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

const DAY = 24 * 60 * 60 * 1000;

export default function SitterEarningsDashboard({ city, onBack }) {
  const t = THEMES[city] || THEMES.Gurgaon;
  const { t: tr, lang } = useLanguage();
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const [rows, setRows] = useState([]);
  const [isFoundingSitter, setIsFoundingSitter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [timeFilter, setTimeFilter] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: sitterProfile } = await supabase.from('sitter_profiles').select('id, is_founding_sitter').eq('user_id', user.id).single();
        if (!sitterProfile) return;
        // Flat 15% commission, or 0% for a Founding Sitter (migration 025).
        const keepRate = sitterProfile.is_founding_sitter ? 1 : 0.85;
        setIsFoundingSitter(!!sitterProfile.is_founding_sitter);
        const { data: bookings, error } = await supabase
          .from('bookings')
          .select('id, gross_amount_paise, sitter_payout_paise, created_at, completed_at, booking_date, status, payout_status')
          .eq('sitter_id', sitterProfile.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false });
        if (error) throw error;
        // Earnings come from the sitter's own price, never reduced by a parent's promo code.
        setRows((bookings || []).map(b => {
          const basePaise = b.sitter_payout_paise || b.gross_amount_paise || 0;
          return {
            id: b.id,
            when: new Date(b.completed_at || b.booking_date || b.created_at),
            bookingRs: basePaise / 100,
            earnedRs: Math.floor(basePaise * keepRate) / 100,
            paidOut: b.payout_status === 'paid',
          };
        }));
      } catch (e) {
        console.error('Error loading earnings:', e);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>{tr('earn_loading')}</div>;

  const now = Date.now();
  const filtered = rows.filter(r => timeFilter === 'all' || (now - r.when) <= (timeFilter === 'month' ? 30 : 7) * DAY);
  const sum = (list) => list.reduce((a, r) => a + r.earnedRs, 0);
  const total = sum(rows);
  const pending = sum(rows.filter(r => !r.paidOut));
  const paidOut = sum(rows.filter(r => r.paidOut));
  const monthly = Object.entries(rows.reduce((m, r) => {
    const k = r.when.toLocaleString(locale, { month: 'short', year: 'numeric' });
    m[k] = (m[k] || 0) + r.earnedRs; return m;
  }, {}));
  const rs = (n) => 'Rs. ' + n.toFixed(2);
  const card = { padding: 20, background: 'white', margin: '0 16px 16px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };
  const heading = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 14, fontWeight: 600, color: '#1a1a1a' };

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', background: '#F8F8F8', minHeight: '100vh', paddingBottom: 100 }}>
      <div style={{ background: t.grad, padding: '48px 20px 20px', color: 'white', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} aria-label={tr('common_back')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', width: 44, height: 44, borderRadius: 12, color: 'white', cursor: 'pointer', fontSize: 18 }}>←</button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{tr('earn_title')}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{tr('earn_subtitle')}</div>
        </div>
      </div>

      {loadError && <div role="alert" style={{ margin: '16px 16px 0', background: '#FCEBEB', color: '#A32D2D', borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>{tr('earn_loadError')}</div>}

      {isFoundingSitter && (
        <div style={{ margin: '16px 16px 0', background: '#FFF0EB', border: '1.5px solid ' + t.primary, borderRadius: 14, padding: '10px 14px', fontSize: 12, fontWeight: 700, color: t.primary, textAlign: 'center' }}>
          {tr('earn_foundingBanner')}
        </div>
      )}

      <div style={{ ...card, margin: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, background: t.light, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>💰</div>
          <div>
            <div style={{ fontSize: 12, color: '#888' }}>{tr('earn_totalAllTime')}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: t.primary }}>{rs(total)}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#888' }}>✓ {tr('earn_walksCount', { n: rows.length })}</div>
      </div>

      <div style={card}>
        <div style={heading}><Wallet size={16} color={t.primary} />{tr('earn_payoutStatus')}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, background: '#FFF3E0', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#E65100' }}>{tr('earn_pendingPayout')}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#E65100' }}>{rs(pending)}</div>
          </div>
          <div style={{ flex: 1, background: '#E8F5E9', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#2E7D32' }}>{tr('earn_paidOut')}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#2E7D32' }}>{rs(paidOut)}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#777', lineHeight: 1.6, marginTop: 10 }}>{tr('earn_payoutExplain')}</div>
      </div>

      <div style={card}>
        <div style={heading}><Calendar size={16} color={t.primary} />{tr('earn_monthly')}</div>
        {monthly.length === 0
          ? <div style={{ color: '#AAA', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>{tr('earn_noneYet')}</div>
          : monthly.map(([month, amount], idx) => (
            <div key={month} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: idx < monthly.length - 1 ? '1px solid #F0F0F0' : 'none' }}>
              <span style={{ fontSize: 13, color: '#555' }}>{month}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.primary }}>{rs(amount)}</span>
            </div>
          ))}
      </div>

      <div style={card}>
        <div style={heading}><DollarSign size={16} color={t.primary} />{tr('earn_perWalk')}</div>
        <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['all', 'month', 'week'].map(f => (
            <button key={f} role="tab" aria-selected={timeFilter === f} onClick={() => setTimeFilter(f)}
              style={{ minHeight: 36, padding: '6px 12px', borderRadius: 8, border: 'none', background: timeFilter === f ? t.primary : '#F0F0F0', color: timeFilter === f ? 'white' : '#666', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {tr(f === 'all' ? 'earn_filterAll' : f === 'month' ? 'earn_filterMonth' : 'earn_filterWeek')}
            </button>
          ))}
        </div>
        {filtered.length > 0 && (
          <div style={{ background: t.light, padding: 12, borderRadius: 10, marginBottom: 12, textAlign: 'center', fontSize: 11, color: '#666' }}>
            {tr(filtered.length === 1 ? 'earn_periodSummaryOne' : 'earn_periodSummary', { n: filtered.length, amount: rs(sum(filtered)) })}
          </div>
        )}
        {filtered.length === 0
          ? <div style={{ color: '#AAA', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>{tr('earn_noneInPeriod')}</div>
          : filtered.map((r, idx) => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: idx < filtered.length - 1 ? '1px solid #F0F0F0' : 'none' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{r.when.toLocaleDateString(locale)}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{tr('earn_bookingAmount', { amount: rs(r.bookingRs) })}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.primary }}>{rs(r.earnedRs)}</div>
                <div style={{ fontSize: 10, color: r.paidOut ? '#2E7D32' : '#E65100', fontWeight: 600 }}>{tr(r.paidOut ? 'earn_statusPaidOut' : 'earn_statusPending')}</div>
              </div>
            </div>
          ))}
      </div>

      <div style={card}>
        <div style={heading}><TrendingUp size={16} color={t.primary} />{tr('earn_tipsTitle')}</div>
        <ul style={{ fontSize: 12, color: '#555', lineHeight: 1.8, paddingLeft: 16, margin: 0 }}>
          {['earn_tip1', 'earn_tip2', 'earn_tip3', 'earn_tip4'].map(k => <li key={k}>{tr(k)}</li>)}
        </ul>
      </div>
    </div>
  );
}
