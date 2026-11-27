import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui, navPadding } from './theme';
import Icon from './ui/Icon';
import { payoutBucket } from './adminInsights';

const DAY = 24 * 60 * 60 * 1000;
const money = { fontVariantNumeric: 'tabular-nums' };

// Indian financial year: April to March. 2026 means FY 2026-27.
export const fyStartOf = (d) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);
const fyShort = (start) => start + '-' + String(start + 1).slice(2);

export function fyStatement(rows, start) {
  const list = rows.filter(r => r.completed && fyStartOf(r.when) === start).sort((a, b) => a.when - b.when);
  const gross = list.reduce((a, r) => a + r.bookingRs, 0);
  const net = list.reduce((a, r) => a + r.earnedRs, 0);
  const months = [];
  list.forEach(r => {
    const key = r.when.getFullYear() * 12 + r.when.getMonth();
    const m = months.find(x => x.key === key);
    if (m) { m.count++; m.net += r.earnedRs; } else months.push({ key, date: new Date(r.when.getFullYear(), r.when.getMonth(), 1), count: 1, net: r.earnedRs });
  });
  return { start, list, gross, net, commission: gross - net, bookings: list.length, months };
}

const csvCell = (v) => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
export function statementCsv(st) {
  const lines = [['Date', 'Booking ref', 'Service', 'Booking value (Rs)', 'Fursday fee (Rs)', 'You earned (Rs)']];
  st.list.forEach(r => {
    const d = r.when;
    lines.push([d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
      r.ref || '', r.service || '', r.bookingRs.toFixed(2), (r.bookingRs - r.earnedRs).toFixed(2), r.earnedRs.toFixed(2)]);
  });
  lines.push([]);
  lines.push(['Total FY ' + fyShort(st.start), '', '', st.gross.toFixed(2), st.commission.toFixed(2), st.net.toFixed(2)]);
  lines.push(['Keep this for your income tax return.']);
  return lines.map(l => l.map(csvCell).join(',')).join('\n');
}

export default function SitterEarningsDashboard({ city, onBack }) {
  const { t: tr, lang } = useLanguage();
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const [rows, setRows] = useState([]);
  const [isFoundingSitter, setIsFoundingSitter] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [timeFilter, setTimeFilter] = useState('all');
  const [sitterName, setSitterName] = useState('');
  const [fy, setFy] = useState(fyStartOf(new Date()));
  const [showStatement, setShowStatement] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: sitterProfile } = await supabase.from('sitter_profiles').select('id, is_founding_sitter, users(name)').eq('user_id', user.id).single();
        if (!sitterProfile) return;
        // Flat 15% commission, or 0% for a Founding Sitter (migration 025).
        const keepRate = sitterProfile.is_founding_sitter ? 1 : 0.85;
        setIsFoundingSitter(!!sitterProfile.is_founding_sitter);
        setSitterName(sitterProfile.users?.name || '');
        const { data: bookings, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('sitter_id', sitterProfile.id)
          .in('status', ['confirmed', 'active', 'completed'])
          .order('created_at', { ascending: false });
        if (error) throw error;
        // Earnings come from the sitter's own price, never reduced by a parent's promo code.
        setRows((bookings || []).map(b => {
          const basePaise = b.sitter_payout_paise || b.gross_amount_paise || 0;
          return {
            id: b.id,
            ref: b.booking_ref,
            service: b.service_type,
            completed: b.status === 'completed',
            when: new Date(b.completed_at || b.booking_date || b.created_at),
            releaseAt: b.payout_release_at ? new Date(b.payout_release_at) : null,
            bookingRs: basePaise / 100,
            earnedRs: Math.floor(basePaise * keepRate) / 100,
            bucket: payoutBucket(b),
          };
        }).filter(r => r.completed || r.bucket));
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
  const done = rows.filter(r => r.completed);
  const waiting = rows.filter(r => ['on_hold', 'disputed'].includes(r.bucket)).sort((a, b) => (a.releaseAt || 0) - (b.releaseAt || 0));
  const filtered = done.filter(r => timeFilter === 'all' || (now - r.when) <= (timeFilter === 'month' ? 30 : 7) * DAY);
  const sum = (list) => list.reduce((a, r) => a + r.earnedRs, 0);
  const total = sum(done);
  const upcoming = sum(waiting);
  const ready = sum(rows.filter(r => r.bucket === 'ready'));
  const paidOut = sum(rows.filter(r => r.bucket === 'paid'));
  const BADGE = { paid: ['success', 'earn_statusPaidOut'], ready: ['warning', 'earn_statusReady'], on_hold: ['info', 'earn_statusOnHold'], disputed: ['danger', 'earn_statusDisputed'] };
  const monthly = Object.entries(done.reduce((m, r) => {
    const k = r.when.toLocaleString(locale, { month: 'short', year: 'numeric' });
    m[k] = (m[k] || 0) + r.earnedRs; return m;
  }, {}));
  const rs = (n) => 'Rs. ' + n.toFixed(2);
  const fyOptions = [...new Set([fyStartOf(new Date()), ...done.map(r => fyStartOf(r.when))])].sort((a, b) => b - a);
  const st = fyStatement(rows, fy);
  const fyLabel = tr('fy_label', { from: fy, to: String(fy + 1).slice(2) });
  const isNative = Capacitor.isNativePlatform();
  const monthName = (d) => d.toLocaleString(locale, { month: 'long', year: 'numeric' });
  const downloadCsv = () => {
    const url = URL.createObjectURL(new Blob([statementCsv(st)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fursday-statement-FY' + fyShort(fy) + '.csv';
    a.click();
  };
  const shareStatement = () => Share.share({
    title: tr('fy_docTitle') + ' ' + fyLabel,
    text: [tr('fy_docTitle') + ', ' + fyLabel, tr('fy_gross') + ': ' + rs(st.gross), tr('fy_commission') + ': ' + rs(st.commission),
      tr('fy_net') + ': ' + rs(st.net), tr('fy_bookings') + ': ' + st.bookings, tr('fy_taxNote')].join('\n'),
  }).catch(() => {});
  const totals = [
    ['fy_gross', rs(st.gross)], ['fy_commission', rs(st.commission)], ['fy_net', rs(st.net)],
    ['fy_bookings', String(st.bookings)], ['fy_months', String(st.months.length)],
  ];
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
          <div style={{ fontSize: font.sm, color: color.success, fontWeight: 600, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="check" size={14} /> {tr('earn_walksCount', { n: done.length })}</div>
        </div>

        <h2 style={{ ...heading, marginTop: 4 }}>{tr('earn_payoutStatus')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, marginBottom: 8 }}>
          {[
            { label: tr('earn_upcoming'), val: upcoming, tone: 'info', icon: 'lock' },
            { label: tr('earn_ready'), val: ready, tone: 'warning', icon: 'clock' },
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
        <div style={{ fontSize: font.sm, color: color.muted, lineHeight: 1.6, margin: '0 2px 16px' }}>{tr('earn_holdExplain')}</div>

        {waiting.length > 0 && (
          <div style={card}>
            <h2 style={heading}><Icon name="lock" size={17} color={color.navy} />{tr('earn_upcomingTitle')}</h2>
            {waiting.map((r, idx) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: idx ? `1px solid ${color.line}` : 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...money, fontSize: font.md, fontWeight: 600, color: color.ink }}>{r.when.toLocaleDateString(locale)}</div>
                  <div style={{ fontSize: font.sm, color: r.bucket === 'disputed' ? color.danger : color.muted, marginTop: 2 }}>
                    {r.bucket === 'disputed' ? tr('earn_underReview') : r.releaseAt ? tr('earn_releasesOn', { date: r.releaseAt.toLocaleString(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }) : tr('earn_statusOnHold')}
                  </div>
                </div>
                <div style={{ ...money, fontSize: font.md, fontWeight: 700, color: color.ink, flexShrink: 0 }}>{rs(r.earnedRs)}</div>
              </div>
            ))}
          </div>
        )}

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
                  <span style={{ ...ui.badge((BADGE[r.bucket] || BADGE.ready)[0]), marginTop: 4 }}>{tr((BADGE[r.bucket] || BADGE.ready)[1])}</span>
                </div>
              </div>
            ))}
        </div>

        <section aria-labelledby="fy-title" style={card}>
          <h2 id="fy-title" style={heading}><Icon name="fileText" size={17} color={color.navy} />{tr('fy_title')}</h2>
          <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 10, lineHeight: 1.5 }}>{tr('fy_hint')}</div>
          <div role="group" aria-label={tr('fy_pick')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {fyOptions.map(y => (
              <button key={y} type="button" aria-pressed={fy === y} onClick={() => setFy(y)} style={{ ...ui.chip(fy === y), minHeight: 44 }}>
                {tr('fy_label', { from: y, to: String(y + 1).slice(2) })}
              </button>
            ))}
          </div>
          <div style={{ fontSize: font.xs, color: color.muted, marginBottom: 6 }}>{tr('fy_range', { from: fy, to: fy + 1 })}</div>
          <dl aria-label={fyLabel} style={{ margin: 0 }}>
            {totals.map(([k, v], idx) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 40, borderTop: idx ? `1px solid ${color.line}` : 'none' }}>
                <dt style={{ fontSize: font.md, color: color.muted }}>{tr(k)}</dt>
                <dd style={{ ...money, margin: 0, fontSize: font.md, fontWeight: k === 'fy_net' ? 700 : 600, color: color.ink }}>{v}</dd>
              </div>
            ))}
          </dl>
          {st.bookings === 0 && <div style={{ ...emptyLine, padding: '8px 0' }}>{tr('fy_none')}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: font.sm, color: color.info, fontWeight: 600, margin: '10px 0 12px' }}><Icon name="info" size={15} />{tr('fy_taxNote')}</div>
          {isNative ? (
            <button type="button" onClick={shareStatement} style={{ ...ui.secondaryButton, width: '100%' }}><Icon name="share" size={18} />{tr('fy_share')}</button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={downloadCsv} style={{ ...ui.secondaryButton, flex: 1, padding: '0 8px' }}><Icon name="download" size={18} />{tr('fy_csv')}</button>
              <button type="button" onClick={() => setShowStatement(true)} style={{ ...ui.secondaryButton, flex: 1, padding: '0 8px' }}><Icon name="printer" size={18} />{tr('fy_print')}</button>
            </div>
          )}
        </section>

        <div style={card}>
          <h2 style={heading}><Icon name="star" size={17} color={color.saffron} />{tr('earn_tipsTitle')}</h2>
          <ul style={{ fontSize: font.sm, color: color.text, lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
            {['earn_tip1', 'earn_tip2', 'earn_tip3', 'earn_tip4'].map(k => <li key={k}>{tr(k)}</li>)}
          </ul>
        </div>
      </div>

      {showStatement && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(21,25,42,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}>
          <div role="dialog" aria-modal="true" aria-label={tr('fy_docTitle')} style={{ background: color.surface, borderRadius: '20px 20px 0 0', maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${color.line}` }}>
              <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink }}>{tr('fy_title')}</div>
              <button type="button" onClick={() => setShowStatement(false)} aria-label={tr('fy_close')}
                style={{ width: 44, height: 44, borderRadius: radius.pill, border: 'none', background: color.tile, color: color.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                <Icon name="plus" size={20} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>
            <div id="fy-statement" style={{ padding: '20px', fontSize: 13, lineHeight: 1.6, color: color.text, ...money }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: font.xl, fontWeight: 700, color: color.navy }}><Icon name="paw" size={22} />Fursday</div>
              <div style={{ fontSize: font.md, fontWeight: 700, color: color.ink, marginTop: 8 }}>{tr('fy_docTitle')}</div>
              <div>{fyLabel} · {tr('fy_range', { from: fy, to: fy + 1 })}</div>
              {sitterName && <div>{tr('fy_for', { name: sitterName })}</div>}
              <table style={{ width: '100%', borderCollapse: 'collapse', margin: '14px 0' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: color.muted, fontSize: font.xs }}>
                    <th style={{ padding: '6px 0', fontWeight: 600 }}>{tr('fy_monthCol')}</th>
                    <th style={{ padding: '6px 0', fontWeight: 600, textAlign: 'right' }}>{tr('fy_bookingsCol')}</th>
                    <th style={{ padding: '6px 0', fontWeight: 600, textAlign: 'right' }}>{tr('fy_netCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {st.months.map(m => (
                    <tr key={m.key} style={{ borderTop: `1px solid ${color.line}` }}>
                      <td style={{ padding: '6px 0' }}>{monthName(m.date)}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>{m.count}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>{rs(m.net)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: `2px solid ${color.ink}`, fontWeight: 700, color: color.ink }}>
                    <td style={{ padding: '6px 0' }}>{tr('fy_total')}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right' }}>{st.bookings}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right' }}>{rs(st.net)}</td>
                  </tr>
                </tbody>
              </table>
              {totals.slice(0, 3).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{tr(k)}</span><span style={{ fontWeight: 600, color: color.ink }}>{v}</span></div>
              ))}
              <div style={{ marginTop: 12, fontWeight: 600, color: color.ink }}>{tr('fy_taxNote')}</div>
              <div style={{ fontSize: font.xs, color: color.muted, marginTop: 4 }}>{tr('fy_generated', { date: new Date().toLocaleDateString(locale) })}</div>
            </div>
            <div style={{ padding: '0 20px calc(20px + env(safe-area-inset-bottom))' }}>
              <button type="button" onClick={() => window.print()} style={{ ...ui.primaryButton, width: '100%' }}><Icon name="printer" size={18} />{tr('fy_printNow')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
