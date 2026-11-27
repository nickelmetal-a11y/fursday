import React, { useState } from 'react';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import { startTip, verifyTip, simulateTip, TIP_MIN_RUPEES, TIP_MAX_RUPEES } from './paymentsClient';

const QUICK = [50, 100, 200];

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

// A tip on a completed booking. onDone(result) after a tip, onDone(null) when closed.
export default function TipSheet({ booking, onDone }) {
  const { t: tr } = useLanguage();
  const [rupees, setRupees] = useState(100);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [done, setDone] = useState(null);
  const [simulated, setSimulated] = useState(false);

  const name = booking?.sitterName || booking?.sitter_profiles?.users?.name || tr('tip_sitterFallback');
  const amount = custom ? Math.round(Number(custom)) : rupees;
  const valid = Number.isFinite(amount) && amount >= TIP_MIN_RUPEES && amount <= TIP_MAX_RUPEES;

  const finish = (result) => { setBusy(false); setDone({ ...result, rupees: amount }); };
  const fail = (key) => { setBusy(false); setMessage(key); };

  const pay = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setMessage(null);
    let order;
    try { order = await startTip(booking.id, amount * 100); } catch (e) {
      fail(e.code === 'needs_migration' || !e.status || e.status >= 500 ? 'tip_unavailable' : 'tip_failed');
      return;
    }
    if (order.mode === 'unavailable') { fail('tip_unavailable'); return; }
    if (order.mode === 'simulated') {
      setSimulated(true);
      try { finish(await simulateTip(booking.id, amount * 100)); } catch { fail('tip_failed'); }
      return;
    }
    try { await loadCheckout(); } catch { fail('tip_failed'); return; }
    const rzp = new window.Razorpay({
      key: order.key_id, order_id: order.order_id, amount: order.amount, currency: order.currency || 'INR',
      name: 'Fursday', description: tr('tip_title', { name }), theme: { color: color.navy },
      handler: async (response) => {
        try { finish(await verifyTip(booking.id, response)); } catch { fail('tip_failed'); }
      },
      modal: { ondismiss: () => setBusy(false) },
    });
    rzp.on('payment.failed', () => fail('tip_failed'));
    rzp.open();
  };

  const backdrop = { position: 'fixed', inset: 0, background: 'rgba(21,25,42,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000, fontFamily: font.family };
  const sheet = { width: '100%', maxWidth: 480, background: color.surface, borderRadius: '24px 24px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', boxSizing: 'border-box', color: color.ink };

  if (done) return (
    <div style={backdrop}>
      <div role="dialog" aria-modal="true" aria-labelledby="tip-title" style={{ ...sheet, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: radius.pill, background: color.successSoft, color: color.success, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px auto 12px' }}>
          <Icon name="heartFilled" size={26} />
        </div>
        <h2 id="tip-title" style={{ fontSize: font.xl, fontWeight: 700, margin: '0 0 8px' }}>{tr('tip_thanks')}</h2>
        <p role="status" style={{ fontSize: font.md, color: color.text, lineHeight: 1.6, margin: '0 0 20px' }}>{tr('tip_thanksBody', { amount: done.rupees, name })}</p>
        <button type="button" onClick={() => onDone && onDone(done)} style={{ ...ui.primaryButton, width: '100%' }}>{tr('common_done')}</button>
      </div>
    </div>
  );

  return (
    <div style={backdrop}>
      <div role="dialog" aria-modal="true" aria-labelledby="tip-title" style={sheet}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
          <h2 id="tip-title" style={{ fontSize: font.lg + 2, fontWeight: 700, margin: 0 }}>{tr('tip_title', { name })}</h2>
          <button type="button" onClick={() => onDone && onDone(null)} aria-label={tr('common_close')}
            style={{ width: 40, height: 40, borderRadius: radius.pill, border: 'none', background: color.tile, color: color.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <p style={{ fontSize: font.sm, color: color.muted, margin: '0 0 16px', lineHeight: 1.5 }}>{tr('tip_sub')}</p>

        <div role="group" aria-label={tr('tip_title', { name })} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {QUICK.map(v => {
            const on = !custom && rupees === v;
            return (
              <button key={v} type="button" aria-pressed={on} onClick={() => { setRupees(v); setCustom(''); }}
                style={{ ...ui.chip(on), flex: 1, minHeight: 48, fontSize: font.md }}>Rs.{v}</button>
            );
          })}
        </div>

        <label htmlFor="tip-custom" style={ui.label}>{tr('tip_custom')}</label>
        <input id="tip-custom" type="number" inputMode="numeric" min={TIP_MIN_RUPEES} max={TIP_MAX_RUPEES} value={custom}
          onChange={e => setCustom(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder={String(rupees)}
          aria-describedby="tip-range" style={{ ...ui.input, borderColor: custom && !valid ? color.danger : color.line }} />
        <div id="tip-range" style={{ fontSize: font.sm, color: custom && !valid ? color.danger : color.muted, margin: '6px 0 14px' }}>
          {tr('tip_range', { min: TIP_MIN_RUPEES, max: TIP_MAX_RUPEES })}
        </div>

        {simulated && <div role="note" style={{ background: color.warningSoft, color: color.warning, borderRadius: radius.md, padding: '10px 12px', fontSize: font.sm, fontWeight: 600, marginBottom: 12 }}>{tr('tip_simulated')}</div>}
        {message && <div role="alert" style={{ background: message === 'tip_unavailable' ? color.infoSoft : color.dangerSoft, color: message === 'tip_unavailable' ? color.info : color.danger, borderRadius: radius.md, padding: '10px 12px', fontSize: font.sm, marginBottom: 12, lineHeight: 1.5 }}>{tr(message)}</div>}

        <button type="button" onClick={pay} disabled={!valid || busy}
          style={{ ...ui.primaryButton, width: '100%', ...(valid && !busy ? null : { background: color.line, color: color.faint, cursor: 'not-allowed' }) }}>
          <Icon name="heart" size={18} />{busy ? tr('tip_paying') : tr('tip_pay', { amount: valid ? amount : '—' })}
        </button>
      </div>
    </div>
  );
}
