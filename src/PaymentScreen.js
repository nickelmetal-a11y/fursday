import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

const RAZORPAY_KEY = 'rzp_test_T7V79a2d0jgcQW';

const eyebrow = { fontSize: font.xs, color: color.muted, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 };

export default function PaymentScreen({ onBack, onSuccess, city, booking }) {
  const { t: tr } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [method, setMethod] = useState('upi');
  const [retryCount, setRetryCount] = useState(0);

  const amount = booking?.amount || 29900;
  const serviceName = booking?.service || tr('payment_serviceFallback');
  const bookingRef = booking?.ref || 'FUR' + Math.random().toString(36).substring(2,8).toUpperCase();

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { try { document.body.removeChild(script); } catch(e) {} };
  }, []);

  const handleRazorpayPayment = () => {
    setLoading(true);
    setFailed(false);
    setFailReason('');
    const options = {
      key: RAZORPAY_KEY,
      amount: amount,
      currency: 'INR',
      name: 'Fursday',
      description: serviceName + ' - ' + bookingRef,
      image: 'https://fursday.vercel.app/favicon.ico',
      handler: async (response) => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          // booking.id is always set by the time this screen is reached (see
          // App.js's onPayNow) — a DB trigger overwrites booking_ref on
          // insert anyway, so a ref-based fallback lookup could never work.
          const { error: updateError } = await supabase
            .from('bookings')
            .update({ payment_id: response.razorpay_payment_id, payment_status: 'paid', status: 'confirmed' })
            .eq('id', booking.id);
          if (updateError) console.error('Could not update booking after payment:', updateError.message);

          // TIER 1: Send booking confirmation notifications
          try {
            const { data: bookingData } = await supabase
              .from('bookings')
              .select('*, sitter_profiles(id, users(name, id)), users(id, name)')
              .eq('id', booking.id)
              .single();

            if (bookingData && user) {
              const sitterUserId = bookingData.sitter_profiles?.users?.id;
              const { data: sitterContact } = sitterUserId
                ? await supabase.rpc('get_user_contact', { target_id: sitterUserId })
                : { data: null };
              const { data: parentContact } = await supabase.rpc('get_user_contact', { target_id: user.id });

              const { notifyBookingConfirmed } = await import('./notificationService');
              const cancellationDate = new Date(bookingData.booking_date);
              cancellationDate.setDate(cancellationDate.getDate() - 1);

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
            }
          } catch(notifErr) { console.error('Booking notification failed:', notifErr); }

        } catch(e) { console.log('Post-payment error:', e); }
        setLoading(false);
        setPaid(true);
        if (onSuccess) onSuccess(response.razorpay_payment_id);
      },
      prefill: { name: 'Pet Parent', contact: '', email: '' },
      notes: { booking_ref: bookingRef, service: serviceName },
      theme: { color: color.navy },
      modal: {
        ondismiss: () => {
          setLoading(false);
          setFailed(true);
          setFailReason(tr('payment_cancelledMsg'));
        }
      }
    };
    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', async (response) => {
        setLoading(false);
        setFailed(true);
        setFailReason(response.error?.description || tr('payment_failedFallbackMsg'));
        // retryCount only increments on "Try again" (below), not here — it
        // and setFailed(true) would otherwise land in the same render batch,
        // so "failed again" would show even on the very first failure.

        // TIER 3: Send payment failed notification
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { notifyPaymentFailed } = await import('./notificationService');
            await notifyPaymentFailed(
              user.id,
              user.email,
              user.phone,
              response.error?.description || 'Payment could not be processed'
            );
          }
        } catch(notifErr) { console.error('Payment failed notification error:', notifErr); }
      });
      rzp.open();
    } catch(e) {
      setLoading(false);
      setFailed(true);
      setFailReason(tr('payment_couldNotOpenMsg'));
    }
  };

  if (paid) return (
    <div style={{ ...ui.page, background: color.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'calc(40px + env(safe-area-inset-top)) 16px calc(32px + env(safe-area-inset-bottom))', textAlign: 'center', boxSizing: 'border-box' }}>
      <div style={{ width: 64, height: 64, borderRadius: radius.pill, background: color.successSoft, color: color.success, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon name="check" size={32} strokeWidth={2.4} />
      </div>
      <div style={{ fontSize: font.xxl, fontWeight: 700, color: color.ink, marginBottom: 8, letterSpacing: -0.3 }}>{tr('payment_successTitle')}</div>
      <div style={{ fontSize: font.md, color: color.muted, marginBottom: 24, lineHeight: 1.6 }}>
        {tr('payment_successSubLine1')}<br />{tr('payment_successSubLine2')}
      </div>
      <div style={{ ...ui.card, width: '100%', marginBottom: 12, padding: '6px 16px', textAlign: 'left', boxSizing: 'border-box' }}>
        {[
          { label: tr('payment_labelBookingRef'), val: bookingRef },
          { label: tr('payment_labelService'), val: serviceName },
          { label: tr('payment_amountPaidLabel'), val: 'Rs.' + Math.round(amount/100) },
          { label: tr('payment_statusLabel'), val: tr('payment_statusConfirmedValue') },
        ].map((x, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
            <span style={{ fontSize: 13, color: color.muted }}>{x.label}</span>
            {i === 3
              ? <span style={ui.badge('success')}>{x.val}</span>
              : <span style={{ fontSize: 13, color: color.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{x.val}</span>}
          </div>
        ))}
      </div>
      <div style={{ ...ui.card, width: '100%', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', boxSizing: 'border-box' }}>
        <span style={{ ...ui.iconTile, width: 40, height: 40 }}><Icon name="mail" size={20} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: color.ink, fontSize: 13, fontWeight: 600 }}>{tr('payment_emailSentTitle')}</div>
          <div style={{ color: color.muted, fontSize: font.sm }}>{tr('payment_emailSentSub')}</div>
        </div>
        <Icon name="check" size={18} color={color.success} strokeWidth={2.4} />
      </div>
      <button type="button" onClick={onBack} style={{ ...ui.primaryButton, width: '100%' }}>
        {tr('payment_backToHomeButton')}
      </button>
    </div>
  );

  if (failed) return (
    <div style={{ ...ui.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'calc(40px + env(safe-area-inset-top)) 16px calc(32px + env(safe-area-inset-bottom))', textAlign: 'center', boxSizing: 'border-box' }}>
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
      <button type="button" onClick={() => { setFailed(false); setRetryCount(c => c + 1); handleRazorpayPayment(); }}
        style={{ ...ui.primaryButton, width: '100%', marginBottom: 10 }}>
        <Icon name="repeat" size={18} /> {tr('common_tryAgain')}
      </button>
      <button type="button" onClick={() => { setFailed(false); setMethod(method === 'upi' ? 'card' : 'upi'); }}
        style={{ ...ui.secondaryButton, width: '100%', marginBottom: 8 }}>
        {tr('payment_tryDifferentMethodButton')}
      </button>
      <button type="button" onClick={onBack}
        style={{ minHeight: 44, background: 'none', border: 'none', color: color.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '0 8px', fontFamily: font.family }}>
        {tr('payment_payLaterButton')}
      </button>
    </div>
  );

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
          ].map((x, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
              <span style={{ fontSize: 13, color: color.muted }}>{x.label}</span>
              <span style={{ fontSize: 13, color: color.ink, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{x.val}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 0 0', marginTop: 4, borderTop: `1px solid ${color.line}` }}>
            <span style={{ fontSize: font.lg, fontWeight: 700, color: color.ink }}>{tr('payment_totalLabel')}</span>
            <span style={{ fontSize: font.xl, fontWeight: 700, color: color.ink, fontVariantNumeric: 'tabular-nums' }}>Rs.{Math.round(amount/100)}</span>
          </div>
        </div>
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
        <div style={{ background: color.successSoft, borderRadius: radius.md, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Icon name="lock" size={18} color={color.success} />
          <div style={{ fontSize: font.sm, color: color.success, lineHeight: 1.55 }}>{tr('payment_secureNotice')}</div>
        </div>
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: color.surface, borderTop: `1px solid ${color.line}`, zIndex: 100 }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
          <button type="button" onClick={handleRazorpayPayment} disabled={loading}
            style={{ ...ui.primaryButton, width: '100%', background: loading ? color.line : color.navy, color: loading ? color.faint : 'white', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? tr('payment_openingPayment') : tr('payment_payButtonLabel', { amount: Math.round(amount/100) })}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8, fontSize: font.xs, color: color.faint }}>
            <Icon name="lock" size={12} />{tr('payment_poweredByFooter')}
          </div>
        </div>
      </div>
    </div>
  );
}
