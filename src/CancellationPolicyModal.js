import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';


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
  const paidRupees = booking.payment_status === 'paid' ? (booking.gross_amount_paise || 0) / 100 : 0;
  const refundAmount = paidRupees * refund.percentage / 100;

  const cancelBooking = async () => {
    if (!reason) return;
    setCancelling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // TIER 3: Calculate hours until refund deadline before cancelling
      const hoursUntilBooking = (serviceStartTime(booking) - new Date()) / (1000 * 60 * 60);

      const { error } = await supabase.from('bookings').update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
        refund_percentage: refund.percentage,
        refund_amount_paise: Math.round(refundAmount * 100),
      }).eq('id', booking.id);
      if (error) {
        alert(tr('cancelPolicy_cancelFailedAlert') + error.message);
        setCancelling(false);
        return;
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
            refundAmount: refundAmount.toFixed(2),
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

  if (step === 'policy') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }}>
        <div style={{ width: '100%', maxWidth: 390, background: 'white', borderRadius: '24px 24px 0 0', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{tr('cancelPolicy_title')}</div>
            <button onClick={onClose} aria-label={tr('common_close')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ background: '#E3F2FD', borderRadius: 14, padding: '12px 14px', marginBottom: 20, display: 'flex', gap: 10 }}>
            <AlertCircle size={20} color="#1565C0" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: '#1565C0', lineHeight: 1.5 }}>
              {tr('cancelPolicy_advisory')}
            </div>
          </div>

          <div style={{ background: '#F5F5F5', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 12, fontWeight: 600 }}>{tr('cancelPolicy_refundRulesHeading')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{tr('cancelPolicy_tier72Label')}</span>
                <span style={{ fontWeight: 600, color: '#2E7D32' }}>{tr('cancelPolicy_tier72Refund')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{tr('cancelPolicy_tier2472Label')}</span>
                <span style={{ fontWeight: 600, color: '#F57C00' }}>{tr('cancelPolicy_tier2472Refund')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{tr('cancelPolicy_tier024Label')}</span>
                <span style={{ fontWeight: 600, color: '#A32D2D' }}>{tr('cancelPolicy_tier024Refund')}</span>
              </div>
            </div>
          </div>

          <div style={{ background: '#FFF0EB', borderRadius: 12, padding: '14px', marginBottom: 20, borderLeft: '4px solid #FF6B35' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#E65100', marginBottom: 4 }}>{tr('cancelPolicy_yourRefund')}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#E65100' }}>₹{refundAmount.toFixed(0)}</div>
            <div style={{ fontSize: 11, color: '#D84315', marginTop: 4 }}>{tr(refund.labelKey)}</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid #E0E0E0', background: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {tr('cancelPolicy_keepBooking')}
            </button>
            <button onClick={() => setStep('reason')} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: '#A32D2D', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {tr('cancelPolicy_cancelBooking')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'reason') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }}>
        <div style={{ width: '100%', maxWidth: 390, background: 'white', borderRadius: '24px 24px 0 0', padding: '24px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{tr('cancelPolicy_whyCancelling')}</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>{tr('cancelPolicy_helpsImprove')}</div>

          {CANCEL_REASONS.map(({ value, labelKey }) => (
            <button type="button" key={value} onClick={() => { setReason(value); setStep('confirming'); }}
              style={{ display: 'block', width: '100%', padding: '12px 14px', textAlign: 'left', fontSize: 13, color: reason === value ? '#FF6B35' : '#1a1a1a', background: reason === value ? '#FFF0EB' : '#F8F8F8', border: reason === value ? '2px solid #FF6B35' : '1.5px solid #E0E0E0', borderRadius: 12, marginBottom: 8, cursor: 'pointer', fontWeight: reason === value ? 600 : 400 }}>
              {tr(labelKey)}
            </button>
          ))}

          <button onClick={() => setStep('policy')} style={{ marginTop: 12, width: '100%', padding: '12px 0', borderRadius: 12, border: '1.5px solid #E0E0E0', background: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#888' }}>
            {tr('common_back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }}>
      <div style={{ width: '100%', maxWidth: 390, background: 'white', borderRadius: '24px 24px 0 0', padding: '24px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>{tr('cancelPolicy_confirmTitle')}</div>

        <div style={{ background: '#FCEBEB', borderRadius: 12, padding: '14px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: '#A32D2D', textAlign: 'center' }}>
            {tr('cancelPolicy_refundEta', { amount: '₹' + refundAmount.toFixed(0) })} {tr('cancelPolicy_yourReasonLabel')} <strong>{(() => { const r = CANCEL_REASONS.find(x => x.value === reason); return r ? tr(r.labelKey) : reason; })()}</strong>
          </div>
        </div>

        <button onClick={cancelBooking} disabled={cancelling} style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: '#A32D2D', color: 'white', fontSize: 14, fontWeight: 700, cursor: cancelling ? 'not-allowed' : 'pointer', opacity: cancelling ? 0.7 : 1, marginBottom: 8 }}>
          {cancelling ? tr('cancelPolicy_cancelling') : tr('cancelPolicy_confirmButton')}
        </button>
        <button onClick={() => setStep('reason')} disabled={cancelling} style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: '1.5px solid #E0E0E0', background: 'white', fontSize: 14, fontWeight: 600, cursor: cancelling ? 'not-allowed' : 'pointer', color: '#888' }}>
          {tr('common_back')}
        </button>
      </div>
    </div>
  );
}
