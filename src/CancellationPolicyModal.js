import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { supabase } from './supabase';

const calculateRefund = (bookingDate) => {
  const now = new Date();
  const booking = new Date(bookingDate);
  const hoursUntil = (booking - now) / (1000 * 60 * 60);

  if (hoursUntil >= 72) return { percentage: 100, label: 'Full refund (100%)' };
  if (hoursUntil >= 24) return { percentage: 75, label: '75% refund' };
  return { percentage: 0, label: 'No refund' };
};

export default function CancellationPolicyModal({ booking, onClose, onCancelled }) {
  const [step, setStep] = useState('policy'); // policy, reason, confirming
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const refund = calculateRefund(booking.booking_date);
  const refundAmount = (booking.price || 0) * refund.percentage / 100;

  const cancelBooking = async () => {
    if (!reason) return;
    setCancelling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // TIER 3: Calculate hours until refund deadline before cancelling
      const hoursUntilBooking = (new Date(booking.booking_date) - new Date()) / (1000 * 60 * 60);

      // NOTE: production `bookings` has no cancelled_at/cancelled_by/refund_percentage/
      // refund_amount columns, and there is no `refunds` table at all — refund percentage
      // is computed above for display only and is not currently persisted anywhere.
      const { error } = await supabase.from('bookings').update({
        status: 'cancelled',
        cancellation_reason: reason,
      }).eq('id', booking.id);
      if (error) {
        alert('Could not cancel booking: ' + error.message);
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
          .select('users(name, email, phone)')
          .eq('id', booking.sitter_id)
          .single();

        if (user && sitterData) {
          const { notifyBookingCancelled } = await import('./notificationService');

          // Notify pet parent
          await notifyBookingCancelled({
            userId: booking.pet_parent_id,
            userEmail: user.email,
            userPhone: user.phone,
            otherUserName: sitterData.users?.name,
            reason: reason,
            refundAmount: refundAmount.toFixed(2),
            refundStatus: 'Processing',
            bookingRef: booking.booking_ref,
          });

          // Notify sitter
          await notifyBookingCancelled({
            userId: booking.sitter_id,
            userEmail: sitterData.users?.email,
            userPhone: sitterData.users?.phone,
            otherUserName: user.user_metadata?.name || 'A customer',
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
      alert('Error cancelling booking: ' + e.message);
    }
    setCancelling(false);
  };

  if (step === 'policy') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }}>
        <div style={{ width: '100%', maxWidth: 390, background: 'white', borderRadius: '24px 24px 0 0', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Cancellation Policy</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ background: '#E3F2FD', borderRadius: 14, padding: '12px 14px', marginBottom: 20, display: 'flex', gap: 10 }}>
            <AlertCircle size={20} color="#1565C0" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13, color: '#1565C0', lineHeight: 1.5 }}>
              Cancelling within 24 hours of your booking may result in no refund.
            </div>
          </div>

          <div style={{ background: '#F5F5F5', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 12, fontWeight: 600 }}>REFUND RULES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Cancel 72+ hours before</span>
                <span style={{ fontWeight: 600, color: '#2E7D32' }}>100% refund</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Cancel 24-72 hours before</span>
                <span style={{ fontWeight: 600, color: '#F57C00' }}>75% refund</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Cancel 0-24 hours before</span>
                <span style={{ fontWeight: 600, color: '#A32D2D' }}>No refund</span>
              </div>
            </div>
          </div>

          <div style={{ background: '#FFF0EB', borderRadius: 12, padding: '14px', marginBottom: 20, borderLeft: '4px solid #FF6B35' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#E65100', marginBottom: 4 }}>Your refund</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#E65100' }}>₹{refundAmount.toFixed(0)}</div>
            <div style={{ fontSize: 11, color: '#D84315', marginTop: 4 }}>{refund.label}</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: '1.5px solid #E0E0E0', background: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Keep booking
            </button>
            <button onClick={() => setStep('reason')} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', background: '#A32D2D', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Cancel booking
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
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Why are you cancelling?</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>This helps us improve our service.</div>

          {['Emergency or urgent conflict', 'Sitter cancellation', 'Pet is sick', 'Weather concern', 'Change of plans', 'Other'].map(r => (
            <button key={r} onClick={() => { setReason(r); setStep('confirming'); }}
              style={{ display: 'block', width: '100%', padding: '12px 14px', textAlign: 'left', fontSize: 13, color: reason === r ? '#FF6B35' : '#1a1a1a', background: reason === r ? '#FFF0EB' : '#F8F8F8', border: reason === r ? '2px solid #FF6B35' : '1.5px solid #E0E0E0', borderRadius: 12, marginBottom: 8, cursor: 'pointer', fontWeight: reason === r ? 600 : 400 }}>
              {r}
            </button>
          ))}

          <button onClick={() => setStep('policy')} style={{ marginTop: 12, width: '100%', padding: '12px 0', borderRadius: 12, border: '1.5px solid #E0E0E0', background: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#888' }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 1000 }}>
      <div style={{ width: '100%', maxWidth: 390, background: 'white', borderRadius: '24px 24px 0 0', padding: '24px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>Confirm cancellation</div>

        <div style={{ background: '#FCEBEB', borderRadius: 12, padding: '14px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: '#A32D2D', textAlign: 'center' }}>
            You will receive ₹{refundAmount.toFixed(0)} refund within 3-5 business days. Your reason: <strong>{reason}</strong>
          </div>
        </div>

        <button onClick={cancelBooking} disabled={cancelling} style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: '#A32D2D', color: 'white', fontSize: 14, fontWeight: 700, cursor: cancelling ? 'not-allowed' : 'pointer', opacity: cancelling ? 0.7 : 1, marginBottom: 8 }}>
          {cancelling ? 'Cancelling...' : 'Yes, cancel this booking'}
        </button>
        <button onClick={() => setStep('reason')} disabled={cancelling} style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: '1.5px solid #E0E0E0', background: 'white', fontSize: 14, fontWeight: 600, cursor: cancelling ? 'not-allowed' : 'pointer', color: '#888' }}>
          Back
        </button>
      </div>
    </div>
  );
}
