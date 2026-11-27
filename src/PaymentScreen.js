import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import { createOrder, verifyPayment, simulatePayment, serverUnavailable, CHECKOUT_MODES } from './paymentsClient';

const eyebrow = { fontSize: font.xs, color: color.muted, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 };
const centred = { ...ui.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'calc(40px + env(safe-area-inset-top)) 16px calc(32px + env(safe-area-inset-bottom))', textAlign: 'center', boxSizing: 'border-box' };

// Checkout for one booking, or a repeat plan paid at once (booking.ids). The price always comes from the server's order,
// and the money is only authorized here; the sitter's acceptance captures it.
// `order` may be passed in when the caller already created it (BookingFlow).
export default function PaymentScreen({ onBack, onSuccess, onUnavailable, city, booking, order: givenOrder }) {
  const { t: tr } = useLanguage();
  const [order, setOrder] = useState(givenOrder || null);
  const [blocked, setBlocked] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(null);
  const [failed, setFailed] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [method, setMethod] = useState('upi');
  const [retryCount, setRetryCount] = useState(0);

  const amount = order?.amount ?? booking?.amount ?? 0;
  const serviceName = booking?.service || tr('payment_serviceFallback');
  const bookingRef = booking?.ref || order?.booking_ref || '';
  const sitterName = booking?.sitterName || tr('pay_sitterFallback');
  const gateway = order && order.mode !== 'simulated';

  useEffect(() => {
    if (givenOrder || !booking?.id) return;
    let cancelled = false;
    createOrder(booking.ids || booking.id).then((o) => {
      if (cancelled) return;
      if (CHECKOUT_MODES.includes(o.mode)) setOrder(o);
      else if (o.mode === 'free') setBlocked('free');
      else if (onUnavailable) onUnavailable(o.mode);
      else setBlocked('unavailable');
    }).catch((e) => {
      if (cancelled) return;
      if (e.code === 'already_paid') setBlocked('already_paid');
      else if (onUnavailable && serverUnavailable(e)) onUnavailable('error');
      else setBlocked('unavailable');
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, givenOrder]);

  useEffect(() => {
    if (!gateway) return;
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { try { document.body.removeChild(script); } catch(e) {} };
  }, [gateway]);

  const notifyConfirmed = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: bookingData } = await supabase
        .from('bookings')
        .select('*, sitter_profiles(id, users(name, id)), users(id, name)')
        .eq('id', booking.id)
        .single();
      if (!bookingData || !user) return;
      const sitterUserId = bookingData.sitter_profiles?.users?.id;
      const { data: sitterContact } = sitterUserId
        ? await supabase.rpc('get_user_contact', { target_id: sitterUserId })
        : { data: null };
      const { data: parentContact } = await supabase.rpc('get_user_contact', { target_id: user.id });
      const { notifyBookingConfirmed } = await import('./notificationService');
      await notifyBookingConfirmed({
        sitterId: sitterUserId, // notifications.user_id is a real users.id FK, not sitter_profiles.id
        sitterEmail: sitterContact?.[0]?.email,
        sitterPhone: sitterContact?.[0]?.phone,
        petParentId: user.id,
        petParentEmail: parentContact?.[0]?.email || user.email,
        petParentPhone: parentContact?.[0]?.phone,
        petName: bookingData.pet_name,
        sitterName: bookingData.sitter_profiles?.users?.name,
        serviceType: bookingData.service_type,
        dateTime: `${bookingData.booking_date} ${bookingData.time_slot}`,
        amount: bookingData.gross_amount_paise,
        bookingRef: bookingData.booking_ref,
      });
    } catch(notifErr) { console.error('Booking notification failed:', notifErr); }
  };

  const succeed = async (result, paymentId) => {
    // Only a captured payment means the sitter has accepted; an authorized one is still waiting.
    if (result.payment_status === 'held') await notifyConfirmed();
    setLoading(false);
    setPaid(result);
    if (onSuccess) onSuccess(paymentId, result);
  };

  const fail = (reason) => { setLoading(false); setFailed(true); setFailReason(reason); };

  const payWithRazorpay = () => {
    const options = {
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'Fursday',
      description: serviceName + (bookingRef ? ' - ' + bookingRef : ''),
      image: 'https://fursday.vercel.app/favicon.ico',
      handler: async (response) => {
        try {
          const result = await verifyPayment(booking.id, response);
          await succeed(result, response.razorpay_payment_id);
        } catch (e) {
          console.error('Payment verification failed:', e);
          fail(tr('pay_verifyFailedMsg'));
        }
      },
      notes: { booking_id: booking.id },
      theme: { color: color.navy },
      modal: { ondismiss: () => fail(tr('payment_cancelledMsg')) },
    };
    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', async (response) => {
        // retryCount only increments on "Try again" (below), not here — it
        // and setFailed(true) would otherwise land in the same render batch,
        // so "failed again" would show even on the very first failure.
        fail(response.error?.description || tr('payment_failedFallbackMsg'));
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { notifyPaymentFailed } = await import('./notificationService');
            await notifyPaymentFailed(user.id, user.email, user.phone, response.error?.description || 'Payment could not be processed');
          }
        } catch(notifErr) { console.error('Payment failed notification error:', notifErr); }
      });
      rzp.open();
    } catch(e) {
      fail(tr('payment_couldNotOpenMsg'));
    }
  };

  const handlePay = async () => {
    if (!order) return;
    setLoading(true);
    setFailed(false);
    setFailReason('');
    if (gateway) { payWithRazorpay(); return; }
    try {
      const result = await simulatePayment(booking.ids || booking.id);
      await succeed(result, result.payment_id || 'simulated');
    } catch (e) {
      fail(e.message || tr('payment_failedFallbackMsg'));
    }
  };

  const backButton = (
    <button type="button" onClick={onBack} style={{ ...ui.primaryButton, width: '100%' }}>
      {tr('payment_backToHomeButton')}
    </button>
  );

  if (blocked) return (
    <div style={centred}>
      <div style={{ ...ui.iconTile, width: 64, height: 64, borderRadius: radius.pill, marginBottom: 16 }}>
        <Icon name={blocked === 'unavailable' ? 'info' : 'check'} size={30} />
      </div>
      <div style={{ fontSize: font.xl, fontWeight: 700, color: color.ink, marginBottom: 8 }}>{tr({ already_paid: 'pay_alreadyPaidTitle', free: 'pay_freeTitle' }[blocked] || 'pay_unavailableTitle')}</div>
      <div style={{ fontSize: font.md, color: color.muted, marginBottom: 24, lineHeight: 1.6, maxWidth: 340 }}>{tr({ already_paid: 'pay_alreadyPaidBody', free: 'pay_freeBody' }[blocked] || 'pay_unavailableBody')}</div>
      {backButton}
    </div>
  );

  if (paid) {
    const captured = paid.payment_status === 'held';
    return (
      <div style={{ ...centred, background: color.surface }}>
        <div style={{ width: 64, height: 64, borderRadius: radius.pill, background: color.successSoft, color: color.success, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Icon name={captured ? 'check' : 'lock'} size={32} strokeWidth={2.4} />
        </div>
        <div style={{ fontSize: font.xxl, fontWeight: 700, color: color.ink, marginBottom: 8, letterSpacing: -0.3 }}>{tr('payment_successTitle')}</div>
        <div style={{ fontSize: font.md, color: color.muted, marginBottom: 24, lineHeight: 1.6, maxWidth: 360 }}>
          {tr(captured ? 'pay_heldUntilRelease' : 'pay_heldUntilAccept', { amount: Math.round(amount / 100), name: sitterName })}
        </div>
        <div style={{ ...ui.card, width: '100%', marginBottom: 12, padding: '6px 16px', textAlign: 'left', boxSizing: 'border-box' }}>
          {[
            { label: tr('payment_labelBookingRef'), val: bookingRef },
            { label: tr('payment_labelService'), val: serviceName },
            { label: tr('payment_amountPaidLabel'), val: 'Rs.' + Math.round(amount / 100) },
            { label: tr('payment_statusLabel'), val: tr(captured ? 'pay_statusHeld' : 'pay_statusAwaitingSitter'), badge: captured ? 'success' : 'info' },
          ].filter(x => x.val).map((x, i) => (
            <div key={x.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
              <span style={{ fontSize: 13, color: color.muted }}>{x.label}</span>
              {x.badge
                ? <span style={ui.badge(x.badge)}>{x.val}</span>
                : <span style={{ fontSize: 13, color: color.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{x.val}</span>}
            </div>
          ))}
        </div>
        {captured && (
          <div style={{ ...ui.card, width: '100%', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', boxSizing: 'border-box' }}>
            <span style={{ ...ui.iconTile, width: 40, height: 40 }}><Icon name="mail" size={20} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: color.ink, fontSize: 13, fontWeight: 600 }}>{tr('payment_emailSentTitle')}</div>
              <div style={{ color: color.muted, fontSize: font.sm }}>{tr('payment_emailSentSub')}</div>
            </div>
            <Icon name="check" size={18} color={color.success} strokeWidth={2.4} />
          </div>
        )}
        <div style={{ height: 12 }} />
        {backButton}
      </div>
    );
  }

  if (failed) return (
    <div style={centred}>
      <div style={{ width: 64, height: 64, borderRadius: radius.pill, background: color.dangerSoft, color: color.danger, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon name="alert" size={30} />
      </div>
      <div style={{ fontSize: font.xl + 2, fontWeight: 700, color: color.ink, marginBottom: 8 }}>{tr('payment_title')} {retryCount > 0 ? tr('payment_failedAgain') : tr('payment_unsuccessful')}</div>
      <div style={{ fontSize: font.md, color: color.muted, marginBottom: 24, lineHeight: 1.6, maxWidth: 320 }}>{failReason}</div>
      <div style={{ ...ui.card, width: '100%', marginBottom: 20, textAlign: 'left', boxSizing: 'border-box' }}>
        <div style={ui.sectionTitle}>{tr('payment_bookingSafeTitle')}</div>
        {[
          tr('payment_safetyNoDeduction'),
          tr('payment_safetyBookingSaved', { ref: bookingRef }),
          tr('payment_safetyRetryAnytime'),
        ].map((text, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
            <span style={{ width: 22, height: 22, borderRadius: radius.pill, background: color.successSoft, color: color.success, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="check" size={13} strokeWidth={2.6} />
            </span>
            <span style={{ fontSize: 13, color: color.text }}>{text}</span>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => { setFailed(false); setRetryCount(c => c + 1); handlePay(); }}
        style={{ ...ui.primaryButton, width: '100%', marginBottom: 10 }}>
        <Icon name="repeat" size={18} /> {tr('common_tryAgain')}
      </button>
      {gateway && (
        <button type="button" onClick={() => { setFailed(false); setMethod(method === 'upi' ? 'card' : 'upi'); }}
          style={{ ...ui.secondaryButton, width: '100%', marginBottom: 8 }}>
          {tr('payment_tryDifferentMethodButton')}
        </button>
      )}
      <button type="button" onClick={onBack}
        style={{ minHeight: 44, background: 'none', border: 'none', color: color.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '0 8px', fontFamily: font.family }}>
        {tr('payment_payLaterButton')}
      </button>
    </div>
  );

  const busy = loading || !order;
  return (
    <div style={{ ...ui.page, paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
      <div style={ui.header}>
        <button type="button" onClick={onBack} aria-label={tr('common_back')} style={ui.backButton}>
          <Icon name="arrowLeft" size={20} />
        </button>
        <div style={{ minWidth: 0 }}>
          <h1 style={ui.headerTitle}>{tr('payment_headerTitle')}</h1>
          <div style={{ color: color.muted, fontSize: font.sm }}>{tr('payment_headerSub')}</div>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ ...ui.card, marginBottom: 12 }}>
          <div style={eyebrow}>{tr('payment_orderSummaryLabel')}</div>
          {[
            { label: tr('payment_labelService'), val: serviceName },
            { label: tr('payment_labelBookingRef'), val: bookingRef },
            { label: tr('payment_labelPlatformFee'), val: 'Rs.0' },
          ].filter(x => x.val).map((x, i) => (
            <div key={x.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
              <span style={{ fontSize: 13, color: color.muted }}>{x.label}</span>
              <span style={{ fontSize: 13, color: color.ink, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{x.val}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 0 0', marginTop: 4, borderTop: `1px solid ${color.line}` }}>
            <span style={{ fontSize: font.lg, fontWeight: 700, color: color.ink }}>{tr('payment_totalLabel')}</span>
            <span style={{ fontSize: font.xl, fontWeight: 700, color: color.ink, fontVariantNumeric: 'tabular-nums' }}>Rs.{Math.round(amount/100)}</span>
          </div>
        </div>
        <div style={{ background: color.navySoft, borderRadius: radius.md, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
          <Icon name="shield" size={18} color={color.navy} style={{ marginTop: 1, flexShrink: 0 }} />
          <div style={{ fontSize: font.sm, color: color.text, lineHeight: 1.55 }}>{tr('pay_holdExplain', { name: sitterName })}</div>
        </div>
        {order?.mode === 'simulated' && (
          <div role="note" style={{ background: color.warningSoft, borderRadius: radius.md, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <Icon name="info" size={18} color={color.warning} />
            <div style={{ fontSize: font.sm, color: color.warning, lineHeight: 1.55, fontWeight: 600 }}>{tr('pay_simulatedNotice')}</div>
          </div>
        )}
        {gateway && (
          <div style={{ ...ui.card, padding: '14px 16px 4px', marginBottom: 12 }}>
            <div style={eyebrow}>{tr('payment_payWithLabel')}</div>
            {[
              { id: 'upi', label: tr('payment_methodUpiLabel'), sub: tr('payment_methodUpiSub'), icon: 'smartphone' },
              { id: 'card', label: tr('payment_methodCardLabel'), sub: tr('payment_methodCardSub'), icon: 'card' },
              { id: 'netbanking', label: tr('payment_methodNetbankingLabel'), sub: tr('payment_methodNetbankingSub'), icon: 'boarding' },
            ].map((m, i) => {
              const on = method === m.id;
              return (
                <button type="button" key={m.id} onClick={() => setMethod(m.id)} aria-pressed={on}
                  style={{ width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', border: 'none', borderTop: i ? `1px solid ${color.line}` : 'none', background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ ...ui.iconTile, width: 40, height: 40, background: on ? color.navySoft : color.tile }}><Icon name={m.icon} size={20} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{m.label}</div>
                    <div style={{ fontSize: font.sm, color: color.muted }}>{m.sub}</div>
                  </div>
                  <span style={{ width: 20, height: 20, borderRadius: radius.pill, border: `1.5px solid ${on ? color.navy : color.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxSizing: 'border-box' }}>
                    {on && <span style={{ width: 10, height: 10, borderRadius: radius.pill, background: color.navy }} />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {gateway && (
          <div style={{ background: color.successSoft, borderRadius: radius.md, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <Icon name="lock" size={18} color={color.success} />
            <div style={{ fontSize: font.sm, color: color.success, lineHeight: 1.55 }}>{tr('payment_secureNotice')}</div>
          </div>
        )}
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: color.surface, borderTop: `1px solid ${color.line}`, zIndex: 100 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
          <button type="button" onClick={handlePay} disabled={busy}
            style={{ ...ui.primaryButton, width: '100%', background: busy ? color.line : color.navy, color: busy ? color.faint : 'white', cursor: busy ? 'not-allowed' : 'pointer' }}>
            {!order ? tr('pay_preparing') : loading ? tr('payment_openingPayment') : tr(gateway ? 'payment_payButtonLabel' : 'pay_simulateButton', { amount: Math.round(amount/100) })}
          </button>
          {gateway && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8, fontSize: font.xs, color: color.faint }}>
              <Icon name="lock" size={12} />{tr('payment_poweredByFooter')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
