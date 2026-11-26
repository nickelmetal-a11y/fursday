import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui, navPadding } from './theme';
import Icon from './ui/Icon';

const DAY = 24 * 60 * 60 * 1000;
const money = { fontVariantNumeric: 'tabular-nums' };

export default function SitterEarningsDashboard({ city, onBack }) {
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

  const header = (
    <div style={ui.header}>
      <button onClick={onBack} aria-label={tr('common_back')} style={ui.backButton}><Icon name="arrowLeft" size={20} /></button>
      <div style={{ minWidth: 0 }}>
        <h1 style={ui.headerTitle}>{tr('earn_title')}</h1>
        <div style={{ fontSize: font.sm, color: color.muted, marginTop: 1 }}>{tr('earn_subtitle')}</div>
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      {header}
      <div role="status" style={{ padding: 16 }}>
        {[96, 120, 160].map((h, i) => <div key={i} style={{ height: h, borderRadius: radius.lg, background: color.tile, marginBottom: 12 }} />)}
        <div style={{ fontSize: font.sm, color: color.muted, textAlign: 'center' }}>{tr('earn_loading')}</div>
      </div>
    </div>
  );

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
  const card = { ...ui.card, marginBottom: 12 };
  const heading = { ...ui.sectionTitle, display: 'flex', alignItems: 'center', gap: 8 };
  const emptyLine = { color: color.muted, fontSize: font.sm, textAlign: 'center', padding: '16px 0' };

  return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      {header}

      <div style={{ padding: 16 }}>
        {loadError && <div role="alert" style={{ background: color.dangerSoft, color: color.danger, borderRadius: radius.md, padding: '10px 14px', fontSize: font.sm, marginBottom: 12 }}>{tr('earn_loadError')}</div>}

        {isFoundingSitter && (
          <div style={{ background: color.saffronSoft, borderRadius: radius.md, padding: '10px 14px', fontSize: font.sm, fontWeight: 600, color: color.warning, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="gift" size={18} />
            <span>{tr('earn_foundingBanner')}</span>
          </div>
        )}

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={ui.iconTile}><Icon name="wallet" /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: font.sm, color: color.muted }}>{tr('earn_totalAllTime')}</div>
              <div style={{ ...money, fontSize: font.xxl, fontWeight: 700, color: color.ink, letterSpacing: -0.3 }}>{rs(total)}</div>
            </div>
          </div>
          <div style={{ fontSize: font.sm, color: color.success, fontWeight: 600, marginTop: 10 }}>✓ {tr('earn_walksCount', { n: rows.length })}</div>
        </div>

        <h2 style={{ ...heading, marginTop: 4 }}>{tr('earn_payoutStatus')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
          {[
            { label: tr('earn_pendingPayout'), val: pending, tone: 'warning', icon: 'clock' },
            { label: tr('earn_paidOut'), val: paidOut, tone: 'success', icon: 'check' },
          ].map(tile => (
            <div key={tile.tone} style={{ ...ui.card, padding: 14, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: font.sm, fontWeight: 600, color: color[tile.tone], lineHeight: 1.3 }}>
                <Icon name={tile.icon} size={15} />
                <span>{tile.label}</span>
              </div>
              <div style={{ ...money, fontSize: font.lg, fontWeight: 700, color: color.ink, marginTop: 6 }}>{rs(tile.val)}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: font.sm, color: color.muted, lineHeight: 1.6, margin: '0 2px 16px' }}>{tr('earn_payoutExplain')}</div>

        <div style={card}>
          <h2 style={heading}><Icon name="calendar" size={17} color={color.navy} />{tr('earn_monthly')}</h2>
          {monthly.length === 0
            ? <div style={emptyLine}>{tr('earn_noneYet')}</div>
            : monthly.map(([month, amount], idx) => (
              <div key={month} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, borderTop: idx ? `1px solid ${color.line}` : 'none' }}>
                <span style={{ fontSize: font.md, color: color.text }}>{month}</span>
                <span style={{ ...money, fontSize: font.md, fontWeight: 600, color: color.ink }}>{rs(amount)}</span>
              </div>
            ))}
        </div>

        <div style={card}>
          <h2 style={heading}><Icon name="receipt" size={17} color={color.navy} />{tr('earn_perWalk')}</h2>
          <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {['all', 'month', 'week'].map(f => (
              <button key={f} role="tab" aria-selected={timeFilter === f} onClick={() => setTimeFilter(f)} style={ui.chip(timeFilter === f)}>
                {tr(f === 'all' ? 'earn_filterAll' : f === 'month' ? 'earn_filterMonth' : 'earn_filterWeek')}
              </button>
            ))}
          </div>
          {filtered.length > 0 && (
            <div style={{ ...money, background: color.bg, padding: '10px 12px', borderRadius: radius.md, marginBottom: 4, fontSize: font.sm, fontWeight: 600, color: color.text }}>
              {tr(filtered.length === 1 ? 'earn_periodSummaryOne' : 'earn_periodSummary', { n: filtered.length, amount: rs(sum(filtered)) })}
            </div>
          )}
          {filtered.length === 0
            ? <div style={emptyLine}>{tr('earn_noneInPeriod')}</div>
            : filtered.map((r, idx) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: idx ? `1px solid ${color.line}` : 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...money, fontSize: font.md, fontWeight: 600, color: color.ink }}>{r.when.toLocaleDateString(locale)}</div>
                  <div style={{ ...money, fontSize: font.sm, color: color.muted, marginTop: 2 }}>{tr('earn_bookingAmount', { amount: rs(r.bookingRs) })}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ ...money, fontSize: font.md, fontWeight: 700, color: color.ink }}>{rs(r.earnedRs)}</div>
                  <span style={{ ...ui.badge(r.paidOut ? 'success' : 'warning'), marginTop: 4 }}>{tr(r.paidOut ? 'earn_statusPaidOut' : 'earn_statusPending')}</span>
                </div>
              </div>
            ))}
        </div>

        <div style={card}>
          <h2 style={heading}><Icon name="star" size={17} color={color.saffron} />{tr('earn_tipsTitle')}</h2>
          <ul style={{ fontSize: font.sm, color: color.text, lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
            {['earn_tip1', 'earn_tip2', 'earn_tip3', 'earn_tip4'].map(k => <li key={k}>{tr(k)}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
