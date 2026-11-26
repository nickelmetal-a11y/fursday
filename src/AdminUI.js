import React, { useEffect, useId, useRef, useState } from 'react';
import { color, font, radius, shadow, ui } from './theme';
import Icon from './ui/Icon';

// Shared building blocks for the admin console (Design A tokens only), so
// every tab has the same headers, tables, badges, empty states and dialogs.

export const rs = (rupees) => 'Rs.' + Math.round(rupees || 0).toLocaleString('en-IN');
export const rsPaise = (paise) => rs((paise || 0) / 100);
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
export const humanize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—');

const SERVICES = { walk30: '30-min walk', walk60: '60-min walk', walk: 'Walk', boarding: 'Boarding', daycare: 'Daycare', drop_in: 'Drop-in visit', dropin: 'Drop-in visit', sitting: 'House sitting', grooming: 'Grooming' };
export const serviceLabel = (s) => SERVICES[s] || humanize(s);

// Sitter / booking / payment statuses → badge tone.
export const TONE = {
  draft: 'neutral', pending: 'warning', needs_changes: 'warning', active: 'success', rejected: 'danger', suspended: 'danger',
  confirmed: 'info', completed: 'success', cancelled: 'danger',
  paid: 'success', unpaid: 'warning', refunded: 'info', failed: 'danger',
  open: 'warning', in_review: 'info', resolved: 'success', applied: 'success', withdrawn: 'neutral',
  success: 'success', error: 'danger',
};

export const A = {
  root: { fontFamily: font.family, color: color.ink },
  muted: { fontSize: font.sm, color: color.muted },
  input: { ...ui.input, padding: '10px 12px', fontSize: font.md, minHeight: 44 },
  select: { ...ui.input, width: 'auto', padding: '10px 12px', fontSize: font.md, minHeight: 44, cursor: 'pointer' },
  textarea: { ...ui.input, padding: '10px 12px', fontSize: font.md, minHeight: 80, resize: 'vertical' },
  primary: { ...ui.primaryButton, minHeight: 44, fontSize: font.md },
  secondary: { ...ui.secondaryButton, minHeight: 44, fontSize: font.md },
  danger: { ...ui.dangerButton, border: `1px solid ${color.danger}`, minHeight: 44 },
  dangerSolid: { ...ui.primaryButton, minHeight: 44, fontSize: font.md, background: color.danger },
  small: { ...ui.secondaryButton, minHeight: 36, padding: '0 12px', fontSize: font.sm, borderRadius: radius.sm, gap: 6, whiteSpace: 'nowrap' },
  smallPrimary: { ...ui.primaryButton, minHeight: 36, padding: '0 12px', fontSize: font.sm, borderRadius: radius.sm, gap: 6, whiteSpace: 'nowrap' },
  smallDanger: { ...ui.dangerButton, minHeight: 36, padding: '0 12px', fontSize: font.sm, borderRadius: radius.sm, whiteSpace: 'nowrap' },
  card: { ...ui.card },
  stack: (gap = 16) => ({ display: 'flex', flexDirection: 'column', gap }),
  row: (gap = 8) => ({ display: 'flex', gap, alignItems: 'center', flexWrap: 'wrap' }),
  grid: (min = 180) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 12 }),
  th: (align) => ({ position: 'sticky', top: 0, zIndex: 1, background: color.tile, textAlign: align || 'left', padding: '10px 12px', fontSize: font.xs, fontWeight: 600, color: color.muted, textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${color.line}`, whiteSpace: 'nowrap' }),
  td: (align) => ({ padding: '10px 12px', borderBottom: `1px solid ${color.line}`, textAlign: align || 'left', verticalAlign: 'middle', fontSize: font.md, fontVariantNumeric: align === 'right' ? 'tabular-nums' : undefined }),
  num: { fontVariantNumeric: 'tabular-nums' },
  disabled: { opacity: 0.45, cursor: 'not-allowed' },
};

const CSS = `
.adm-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.adm-row:hover>td,.adm-item:hover{background:${color.navySoft}!important}
.adm-nav:hover{background:rgba(255,255,255,0.08)}
.adm-root button:focus-visible,.adm-root input:focus-visible,.adm-root select:focus-visible,.adm-root textarea:focus-visible,.adm-root a:focus-visible{outline:2px solid ${color.saffron};outline-offset:2px}
@keyframes adm-pulse{0%,100%{opacity:1}50%{opacity:.5}}
.adm-skel{animation:adm-pulse 1.4s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.adm-skel{animation:none}}
`;
export const AdminStyles = () => <style>{CSS}</style>;

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
      <div style={{ minWidth: 0 }}>
        <h2 style={{ ...ui.sectionTitle, margin: 0, fontSize: font.lg }}>{title}</h2>
        {subtitle && <div style={{ ...A.muted, marginTop: 2, lineHeight: 1.5 }}>{subtitle}</div>}
      </div>
      {action && <div style={A.row(8)}>{action}</div>}
    </div>
  );
}

export function Badge({ tone = 'info', children, icon }) {
  const style = tone === 'neutral' ? { ...ui.badge('info'), background: color.tile, color: color.muted } : ui.badge(tone);
  return <span style={{ ...style, whiteSpace: 'nowrap' }}>{icon && <Icon name={icon} size={12} />}{children}</span>;
}

export const StatusBadge = ({ status }) => <Badge tone={TONE[status] || 'neutral'}>{humanize(status)}</Badge>;

export function EmptyState({ icon = 'inbox', title, text, action }) {
  return (
    <div style={{ ...ui.card, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, padding: '32px 16px' }}>
      <div style={ui.iconTile}><Icon name={icon} /></div>
      {title && <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink }}>{title}</div>}
      {text && <div style={{ ...A.muted, fontSize: font.md, maxWidth: 420, lineHeight: 1.5 }}>{text}</div>}
      {action}
    </div>
  );
}

// Skeleton blocks. The label stays in the DOM (visually hidden) for screen
// readers and for tests that wait for loading to finish.
export function Skeleton({ rows = 4, label = 'Loading...' }) {
  return (
    <div role="status" aria-live="polite">
      <span className="adm-sr">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="adm-skel" style={{ height: i === 0 ? 24 : 48, width: i === 0 ? '35%' : '100%', borderRadius: radius.md, background: color.tile, marginBottom: 10 }} />
      ))}
    </div>
  );
}

export function KpiTile({ label, value, sub, tone }) {
  return (
    <div style={{ ...ui.card, padding: 16, minWidth: 0 }}>
      <div style={{ fontSize: font.sm, fontWeight: 600, color: color.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: font.xxl, fontWeight: 700, color: tone ? color[tone] : color.ink, ...A.num, overflowWrap: 'anywhere' }}>{value}</div>
      {sub && <div style={{ marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// "+3 vs previous 7 days", green when the change is good.
export function Delta({ current, previous, format = (n) => String(n), higherIsBetter = true, suffix = 'vs previous 7 days' }) {
  const diff = current - previous;
  if (!previous && !current) return <span style={A.muted}>No change {suffix}</span>;
  const good = diff === 0 ? null : (diff > 0) === higherIsBetter;
  const pct = previous ? Math.round((diff / previous) * 100) : null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: font.sm, fontWeight: 600, color: good == null ? color.muted : good ? color.success : color.danger }}>
      {diff !== 0 && <Icon name={diff > 0 ? 'trendUp' : 'trendDown'} size={14} />}
      {(diff > 0 ? '+' : diff < 0 ? '−' : '') + format(Math.abs(diff))}{pct != null && diff !== 0 ? ' (' + (diff > 0 ? '+' : '−') + Math.abs(pct) + '%)' : ''}
      <span style={{ fontWeight: 400, color: color.muted }}>{suffix}</span>
    </span>
  );
}

export function SearchBox({ label, value, onChange, placeholder, style }) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 200, ...style }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: color.faint, display: 'flex' }}><Icon name="search" size={16} /></span>
      <input aria-label={label} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...A.input, paddingLeft: 36 }} />
    </div>
  );
}

export function ChipGroup({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} style={A.row(6)}>
      {options.map(o => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)} style={ui.chip(value === o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Toolbar({ children }) {
  return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>{children}</div>;
}

export function DataTable({ columns, rows, rowKey = (r) => r.id, onRowClick, label, maxHeight = '70vh' }) {
  return (
    <div style={{ background: color.surface, border: `1px solid ${color.line}`, borderRadius: radius.lg, overflow: 'auto', maxHeight }}>
      <table aria-label={label} style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>{columns.map(c => <th key={c.key} scope="col" style={{ ...A.th(c.align), width: c.width }}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey(r)} className="adm-row" onClick={onRowClick ? () => onRowClick(r) : undefined}
              style={{ background: i % 2 ? color.bg : color.surface, cursor: onRowClick ? 'pointer' : undefined }}>
              {columns.map(c => <td key={c.key} style={{ ...A.td(c.align), ...(c.nowrap ? { whiteSpace: 'nowrap' } : null) }}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Client-side "load more" paging; resets when `resetKey` (e.g. the filters) changes.
export function usePaged(items, size = 25, resetKey = '') {
  const [n, setN] = useState(size);
  useEffect(() => { setN(size); }, [resetKey, size]);
  return { visible: items.slice(0, n), hasMore: items.length > n, remaining: Math.max(0, items.length - n), more: () => setN(x => x + size), size };
}

export function LoadMore({ paged, total }) {
  return (
    <div style={{ ...A.row(12), justifyContent: 'space-between', marginTop: 10 }}>
      <span style={A.muted}>Showing {total - paged.remaining} of {total}</span>
      {paged.hasMore && <button type="button" onClick={paged.more} style={A.small}>Show {Math.min(paged.size, paged.remaining)} more</button>}
    </div>
  );
}

export function Toast({ message, tone = 'success' }) {
  if (!message) return null;
  return (
    <div role="status" style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1200, display: 'flex', alignItems: 'center', gap: 8, maxWidth: 'calc(100% - 32px)', background: tone === 'error' ? color.danger : color.ink, color: color.surface, borderRadius: radius.md, padding: '10px 16px', fontSize: font.md, fontWeight: 600, boxShadow: shadow.raised }}>
      <Icon name={tone === 'error' ? 'alert' : 'check'} size={16} />
      <span>{message}</span>
    </div>
  );
}

export function Notice({ tone = 'info', children, icon = 'info' }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: color[tone + 'Soft'], color: color[tone], borderRadius: radius.md, padding: '10px 12px', fontSize: font.md, lineHeight: 1.5 }}>
      <Icon name={icon} size={18} style={{ marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

// Keeps the latest handler without re-running effects on every render.
function useLatest(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return ref;
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(21,25,42,0.45)', zIndex: 1100, display: 'flex' };

// In-page confirm dialog, replacing window.confirm/prompt.
export function ConfirmDialog({ title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary', busy, disabled, onConfirm, onCancel }) {
  const id = useId();
  const box = useRef(null);
  const cancel = useLatest(onCancel);
  useEffect(() => {
    box.current?.focus();
    // Capture phase + stop, so Escape closes only this dialog, not a drawer under it.
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); cancel.current(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [cancel]);
  return (
    <div style={{ ...overlay, alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onCancel}>
      <div ref={box} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby={id} onClick={e => e.stopPropagation()}
        style={{ background: color.surface, borderRadius: radius.xl, padding: 20, width: '100%', maxWidth: 440, boxShadow: shadow.raised, outline: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 id={id} style={{ margin: 0, fontSize: font.lg, fontWeight: 700 }}>{title}</h2>
        {children && <div style={{ fontSize: font.md, color: color.text, lineHeight: 1.5 }}>{children}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={onCancel} style={A.secondary}>{cancelLabel}</button>
          <button type="button" onClick={onConfirm} disabled={busy || disabled}
            style={{ ...(tone === 'danger' ? A.dangerSolid : A.primary), ...(busy || disabled ? A.disabled : null) }}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// Right-hand detail panel; full width on a phone.
export function Drawer({ title, subtitle, onClose, children, width = 560 }) {
  const id = useId();
  const box = useRef(null);
  const close = useLatest(onClose);
  useEffect(() => {
    box.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') close.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  return (
    <div style={{ ...overlay, justifyContent: 'flex-end' }} onClick={onClose}>
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} onClick={e => e.stopPropagation()}
        style={{ background: color.bg, width: '100%', maxWidth: width, height: '100%', overflowY: 'auto', boxShadow: shadow.raised, outline: 'none', display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: color.surface, borderBottom: `1px solid ${color.line}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={id} style={{ margin: 0, fontSize: font.lg, fontWeight: 700, overflowWrap: 'anywhere' }}>{title}</h2>
            {subtitle && <div style={A.muted}>{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={ui.backButton}><Icon name="close" size={20} /></button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
      </div>
    </div>
  );
}

// Label/value grid used in detail panels.
export function Facts({ items }) {
  return (
    <dl style={{ ...A.grid(150), margin: 0 }}>
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k} style={{ minWidth: 0 }}>
          <dt style={{ fontSize: font.xs, fontWeight: 600, color: color.muted, marginBottom: 2 }}>{k}</dt>
          <dd style={{ margin: 0, fontSize: font.md, fontWeight: 600, color: color.ink, overflowWrap: 'anywhere' }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Field({ label, htmlFor, help, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} style={ui.label}>{label}</label>
      {children}
      {help && <div style={{ ...A.muted, marginTop: 4 }}>{help}</div>}
    </div>
  );
}
