import React, { useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import { cancelBooking as cancelOnServer, moneyInHand, serverUnavailable } from './paymentsClient';

// booking_date is a plain 'YYYY-MM-DD' and time_slot e.g. '7:00 AM'. Parsing the
// date alone gives UTC midnight, which ignored the time and could push a parent
// into a lower refund tier, so combine both in IST.
export const serviceStartTime = (booking) => {
  const d = booking.booking_date || '';
  if (d.includes('T')) return new Date(d);
  const m = String(booking.time_slot || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  let h = m ? parseInt(m[1], 10) : 0;
  const min = m ? m[2] : '00';
  if (m && m[3]) { const pm = m[3].toUpperCase() === 'PM'; if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
  return new Date(d + 'T' + String(h).padStart(2, '0') + ':' + min + ':00+05:30');
};

const calculateRefund = (booking) => {
  // Nothing has been charged until the sitter accepts, so cancelling a hold returns all of it.
  if (booking.payment_status === 'authorized') return { percentage: 100, labelKey: 'cancelPolicy_holdReleased' };
  const hoursUntil = (serviceStartTime(booking) - new Date()) / (1000 * 60 * 60);

  if (hoursUntil >= 72) return { percentage: 100, labelKey: 'cancelPolicy_refundFull100' };
  if (hoursUntil >= 24) return { percentage: 75, labelKey: 'cancelPolicy_tier2472Refund' };
  return { percentage: 0, labelKey: 'cancelPolicy_tier024Refund' };
};

const CANCEL_REASONS = [
  { value: 'Emergency or urgent conflict', labelKey: 'cancelPolicy_reasonEmergency' },
  { value: 'Sitter cancellation', labelKey: 'cancelPolicy_reasonSitterCancellation' },
  { value: 'Pet is sick', labelKey: 'cancelPolicy_reasonPetSick' },
  { value: 'Weather concern', labelKey: 'cancelPolicy_reasonWeather' },
  { value: 'Change of plans', labelKey: 'cancelPolicy_reasonChangeOfPlans' },
  { value: 'Other', labelKey: 'cancelPolicy_reasonOther' },
];

export default function CancellationPolicyModal({ booking, onClose, onCancelled }) {
  const { t: tr } = useLanguage();
  const [step, setStep] = useState('policy'); // policy, reason, confirming
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const refund = calculateRefund(booking);
  // Only money actually paid can be refunded.
  const paidRupees = moneyInHand(booking) ? (booking.gross_amount_paise || 0) / 100 : 0;
  const isHold = booking.payment_status === 'authorized';
  const refundAmount = paidRupees * refund.percentage / 100;

  const cancelBooking = async () => {
    if (!reason) return;
    setCancelling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // TIER 3: Calculate hours until refund deadline before cancelling
      const hoursUntilBooking = (serviceStartTime(booking) - new Date()) / (1000 * 60 * 60);

      // Money held for this booking is refunded by the server, which recomputes
      // the policy itself. If it can't be reached, the cancellation is still
      // recorded and Fursday refunds the held money by hand.
      let refundPaise = Math.round(refundAmount * 100);
      let handled = false;
      if (moneyInHand(booking)) {
        try {
          const res = await cancelOnServer(booking.id, reason);
          refundPaise = res.refund_amount_paise ?? refundPaise;
          handled = true;
        } catch (e) {
          if (!serverUnavailable(e)) {
            alert(tr('cancelPolicy_cancelFailedAlert') + e.message);
            setCancelling(false);
            return;
          }
        }
      }
      if (!handled) {
        const { error } = await supabase.from('bookings').update({
          status: 'cancelled',
          cancellation_reason: reason,
          cancelled_at: new Date().toISOString(),
          refund_percentage: refund.percentage,
          refund_amount_paise: refundPaise,
        }).eq('id', booking.id);
        if (error) {
          alert(tr('cancelPolicy_cancelFailedAlert') + error.message);
          setCancelling(false);
          return;
        }
      }

      // TIER 3: Send cancellation reminder notification with refund info
      if (hoursUntilBooking > 0 && hoursUntilBooking < 72) {
        try {
          const { notifyCancellationReminder } = await import('./notificationService');
          await notifyCancellationReminder(
            user?.id,
            user?.email,
            user?.phone,
            'System',
            hoursUntilBooking
          );
        } catch(reminderErr) { console.error('Cancellation reminder failed:', reminderErr); }
      }

      // TIER 1: Send cancellation notifications to both parties
      try {
        const { data: sitterData } = await supabase
          .from('sitter_profiles')
          .select('user_id, users(name)')
          .eq('id', booking.sitter_id)
          .single();

        if (user && sitterData) {
          const { data: sitterContact } = sitterData.user_id
            ? await supabase.rpc('get_user_contact', { target_id: sitterData.user_id })
            : { data: null };
          const { notifyBookingCancelled } = await import('./notificationService');
          const { data: parentRow } = await supabase.from('users').select('name').eq('id', booking.pet_parent_id).single();

          // Notify pet parent
          await notifyBookingCancelled({
            userId: booking.pet_parent_id,
            userEmail: user.email,
            userPhone: user.phone,
            otherUserName: 'You',
            reason: reason,
            refundAmount: (refundPaise / 100).toFixed(2),
            refundStatus: 'Processing',
            bookingRef: booking.booking_ref,
          });

          // Notify sitter
          await notifyBookingCancelled({
            userId: sitterData.user_id, // notifications.user_id is a real users.id FK, not sitter_profiles.id
            userEmail: sitterContact?.[0]?.email,
            userPhone: sitterContact?.[0]?.phone,
            otherUserName: parentRow?.name || 'The pet parent',
            reason: reason,
            refundAmount: 0,
            refundStatus: 'Booking cancelled',
            bookingRef: booking.booking_ref,
          });
        }
      } catch(notifErr) { console.error('Cancellation notification failed:', notifErr); }

      onCancelled && onCancelled();
      onClose();
    } catch (e) {
      alert(tr('cancelPolicy_cancelErrorAlert') + e.message);
    }
    setCancelling(false);
  };

  // The sheets keep a 24px top radius: the scenario tests find the policy sheet by it.
  const backdrop = { position: 'fixed', inset: 0, background: 'rgba(21,25,42,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000, fontFamily: font.family };
  const sheet = { width: '100%', maxWidth: 480, background: color.surface, borderRadius: '24px 24px 0 0', padding: '20px 20px calc(20px + env(safe-area-inset-bottom))', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto', color: color.ink };
  const backButton = (onClick, disabled) => (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...ui.secondaryButton, width: '100%', color: color.muted, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {tr('common_back')}
    </button>
  );

  if (step === 'policy') {
    return (
      <div style={backdrop}>
        <div role="dialog" aria-modal="true" style={sheet}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ fontSize: font.lg + 2, fontWeight: 700, color: color.ink }}>{tr('cancelPolicy_title')}</div>
            <button type="button" onClick={onClose} aria-label={tr('common_close')}
              style={{ width: 36, height: 36, borderRadius: radius.pill, border: 'none', background: color.tile, color: color.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <Icon name="plus" size={20} style={{ transform: 'rotate(45deg)' }} />
            </button>
          </div>

          <div style={{ background: color.infoSoft, borderRadius: radius.md, padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10 }}>
            <Icon name="info" size={18} color={color.info} style={{ marginTop: 1 }} />
            <div style={{ fontSize: 13, color: color.info, lineHeight: 1.5 }}>
              {tr('cancelPolicy_advisory')}
            </div>
          </div>

          <div style={{ border: `1px solid ${color.line}`, borderRadius: radius.md, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: font.xs, color: color.muted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>{tr('cancelPolicy_refundRulesHeading')}</div>
            {[
              ['cancelPolicy_tier72Label', 'cancelPolicy_tier72Refund', color.success],
              ['cancelPolicy_tier2472Label', 'cancelPolicy_tier2472Refund', color.warning],
              ['cancelPolicy_tier024Label', 'cancelPolicy_tier024Refund', color.danger],
            ].map(([label, value, tone], i) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '8px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
                <span style={{ color: color.text }}>{tr(label)}</span>
                <span style={{ fontWeight: 600, color: tone }}>{tr(value)}</span>
              </div>
            ))}
          </div>

          <div style={{ background: color.tile, borderRadius: radius.md, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: color.text, marginBottom: 2 }}>{tr('cancelPolicy_yourRefund')}</div>
            <div style={{ fontSize: font.xxl, fontWeight: 700, color: color.ink, fontVariantNumeric: 'tabular-nums' }}>₹{refundAmount.toFixed(0)}</div>
            <div style={{ fontSize: font.sm, color: color.muted, marginTop: 2 }}>{tr(refund.labelKey)}</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ ...ui.secondaryButton, flex: 1, padding: '0 10px' }}>
              {tr('cancelPolicy_keepBooking')}
            </button>
            <button type="button" onClick={() => setStep('reason')} style={{ ...ui.primaryButton, flex: 1, padding: '0 10px', background: color.danger }}>
              {tr('cancelPolicy_cancelBooking')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'reason') {
    return (
      <div style={backdrop}>
        <div role="dialog" aria-modal="true" style={sheet}>
          <div style={{ fontSize: font.lg, fontWeight: 700, marginBottom: 4, color: color.ink }}>{tr('cancelPolicy_whyCancelling')}</div>
          <div style={{ fontSize: 13, color: color.muted, marginBottom: 16 }}>{tr('cancelPolicy_helpsImprove')}</div>

          {CANCEL_REASONS.map(({ value, labelKey }) => {
            const on = reason === value;
            return (
              <button type="button" key={value} onClick={() => { setReason(value); setStep('confirming'); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', minHeight: 48, padding: '0 14px', textAlign: 'left', fontSize: 14, fontFamily: font.family, color: on ? color.navy : color.ink, background: on ? color.navySoft : color.surface, border: `1px solid ${on ? color.navy : color.line}`, borderRadius: radius.md, marginBottom: 8, cursor: 'pointer', fontWeight: on ? 600 : 400 }}>
                {tr(labelKey)}
                <Icon name="chevronRight" size={16} color={color.faint} />
              </button>
            );
          })}

          <div style={{ marginTop: 8 }}>{backButton(() => setStep('policy'))}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={backdrop}>
      <div role="dialog" aria-modal="true" style={sheet}>
        <div style={{ fontSize: font.lg, fontWeight: 700, marginBottom: 16, textAlign: 'center', color: color.ink }}>{tr('cancelPolicy_confirmTitle')}</div>

        <div style={{ background: color.dangerSoft, borderRadius: radius.md, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: color.danger, textAlign: 'center' }}>
            {tr(isHold ? 'cancelPolicy_holdEta' : 'cancelPolicy_refundEta', { amount: '₹' + refundAmount.toFixed(0) })} {tr('cancelPolicy_yourReasonLabel')} <strong>{(() => { const r = CANCEL_REASONS.find(x => x.value === reason); return r ? tr(r.labelKey) : reason; })()}</strong>
          </div>
        </div>

        <button type="button" onClick={cancelBooking} disabled={cancelling} style={{ ...ui.primaryButton, width: '100%', background: color.danger, cursor: cancelling ? 'not-allowed' : 'pointer', opacity: cancelling ? 0.7 : 1, marginBottom: 8 }}>
          {cancelling ? tr('cancelPolicy_cancelling') : tr('cancelPolicy_confirmButton')}
        </button>
        {backButton(() => setStep('reason'), cancelling)}
      </div>
    </div>
  );
}
