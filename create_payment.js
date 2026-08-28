const fs = require('fs');
const code = `import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Shield, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from './supabase';

const RAZORPAY_KEY = 'rzp_test_T7V79a2d0jgcQW';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

const sendConfirmationEmail = async (bookingRef, serviceName, amount, parentEmail, parentName) => {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${process.env.REACT_APP_RESEND_API_KEY}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Fursday <noreply@fursday.in>',
        to: parentEmail,
        subject: \`Booking confirmed! \${bookingRef} - \${serviceName}\`,
        html: \`
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <div style="background:#FF6B35;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px">
              <div style="font-size:40px;margin-bottom:8px">🐾</div>
              <div style="color:white;font-size:22px;font-weight:700">Booking Confirmed!</div>
              <div style="color:rgba(255,255,255,0.8);font-size:14px;margin-top:4px">Your pet is in safe hands</div>
            </div>
            <div style="background:#F8F8F8;border-radius:12px;padding:16px;margin-bottom:16px">
              <div style="font-size:13px;color:#888;margin-bottom:4px">Booking reference</div>
              <div style="font-size:18px;font-weight:700;color:#1a1a1a">\${bookingRef}</div>
            </div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
              <tr style="border-bottom:1px solid #F0F0F0"><td style="padding:10px 0;color:#888;font-size:13px">Service</td><td style="padding:10px 0;color:#1a1a1a;font-weight:600;font-size:13px;text-align:right">\${serviceName}</td></tr>
              <tr style="border-bottom:1px solid #F0F0F0"><td style="padding:10px 0;color:#888;font-size:13px">Amount paid</td><td style="padding:10px 0;color:#FF6B35;font-weight:700;font-size:13px;text-align:right">Rs.\${amount}</td></tr>
              <tr><td style="padding:10px 0;color:#888;font-size:13px">Status</td><td style="padding:10px 0;color:#2E7D32;font-weight:600;font-size:13px;text-align:right">✓ Confirmed</td></tr>
            </table>
            <div style="background:#E8F5E9;border-radius:12px;padding:14px;margin-bottom:16px;font-size:13px;color:#2E7D32;line-height:1.6">
              🛡️ Your booking includes Rs.25,000 vet insurance cover. If anything goes wrong, you're covered.
            </div>
            <div style="text-align:center;font-size:12px;color:#AAA;margin-top:24px">
              Questions? Reply to this email or WhatsApp us.<br/>Fursday — Trusted pet care in India 🐾
            </div>
          </div>
        \`,
      }),
    });
  } catch (e) { console.log('Email send error:', e); }
};

export default function PaymentScreen({ onBack, onSuccess, city, booking }) {
  const t = THEMES[city] || THEMES.Gurgaon;
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [method, setMethod] = useState('upi');
  const [retryCount, setRetryCount] = useState(0);

  const amount = booking?.amount || 29900;
  const serviceName = booking?.service || 'Dog Walking';
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
          const updateQuery = booking && booking.id
            ? supabase.from('bookings').update({ payment_id: response.razorpay_payment_id, payment_status: 'paid', status: 'confirmed' }).eq('id', booking.id)
            : supabase.from('bookings').update({ payment_id: response.razorpay_payment_id, payment_status: 'paid', status: 'confirmed' }).eq('booking_ref', bookingRef);
          await updateQuery;
          if (user?.email) {
            await sendConfirmationEmail(bookingRef, serviceName, Math.round(amount/100), user.email, user.email);
          }
        } catch(e) { console.log('Post-payment error:', e); }
        setLoading(false);
        setPaid(true);
        if (onSuccess) onSuccess(response.razorpay_payment_id);
      },
      prefill: { name: 'Pet Parent', contact: '', email: '' },
      notes: { booking_ref: bookingRef, service: serviceName },
      theme: { color: t.primary },
      modal: {
        ondismiss: () => {
          setLoading(false);
          setFailed(true);
          setFailReason('Payment was cancelled. Your booking is saved — try again when ready.');
        }
      }
    };
    try {
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        setLoading(false);
        setFailed(true);
        setFailReason(response.error?.description || 'Payment failed. Please try a different method.');
        setRetryCount(c => c + 1);
      });
      rzp.open();
    } catch(e) {
      setLoading(false);
      setFailed(true);
      setFailReason('Could not open payment. Please check your connection and try again.');
    }
  };

  if (paid) return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#0f0f1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'white', marginBottom: 8 }}>Payment done!</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 32, lineHeight: 1.6 }}>
        Your booking is confirmed.<br />A confirmation email has been sent to you.
      </div>
      <div style={{ background: '#1a1a2e', borderRadius: 20, padding: 20, width: '100%', marginBottom: 20, border: '1px solid rgba(255,107,53,0.2)' }}>
        {[
          { label: 'Booking ref', val: bookingRef },
          { label: 'Service', val: serviceName },
          { label: 'Amount paid', val: 'Rs.' + Math.round(amount/100) },
          { label: 'Status', val: 'Confirmed ✓' },
        ].map((x, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{x.label}</span>
            <span style={{ fontSize: 13, color: i === 3 ? '#4CAF50' : 'white', fontWeight: 600 }}>{x.val}</span>
          </div>
        ))}
      </div>
      <div style={{ background: '#1a1a2e', borderRadius: 16, padding: '12px 16px', width: '100%', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: 22 }}>📧</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>Confirmation email sent</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Check your inbox for booking details</div>
        </div>
        <CheckCircle size={18} color="#4CAF50" style={{ marginLeft: 'auto' }} />
      </div>
      <button onClick={onBack}
        style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: t.primary, color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
        Back to home 🐾
      </button>
    </div>
  );

  if (failed) return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#F8F8F8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <div style={{ width: 80, height: 80, borderRadius: 24, background: '#FCEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <AlertCircle size={40} color="#C62828" />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Payment {retryCount > 0 ? 'failed again' : 'unsuccessful'}</div>
      <div style={{ fontSize: 14, color: '#888', marginBottom: 24, lineHeight: 1.6, maxWidth: 300 }}>{failReason}</div>
      <div style={{ background: 'white', borderRadius: 16, padding: 16, width: '100%', marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>Your booking is safe</div>
        {[
          { icon: '✓', text: 'No money has been deducted', color: '#2E7D32' },
          { icon: '✓', text: 'Booking ref ' + bookingRef + ' is saved', color: '#2E7D32' },
          { icon: '✓', text: 'You can retry payment anytime', color: '#2E7D32' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid #F5F5F5' : 'none' }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: item.color, fontWeight: 700, flexShrink: 0 }}>{item.icon}</div>
            <span style={{ fontSize: 13, color: '#555' }}>{item.text}</span>
          </div>
        ))}
      </div>
      <button onClick={() => { setFailed(false); handleRazorpayPayment(); }}
        style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: t.primary, color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <RefreshCw size={18} /> Try again
      </button>
      <button onClick={() => { setFailed(false); setMethod(method === 'upi' ? 'card' : 'upi'); }}
        style={{ width: '100%', padding: '14px 0', borderRadius: 16, border: '1.5px solid #E0E0E0', background: 'white', color: '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>
        Try a different payment method
      </button>
      <button onClick={onBack}
        style={{ background: 'none', border: 'none', color: '#AAA', fontSize: 13, cursor: 'pointer', padding: '8px 0' }}>
        Pay later from My Bookings
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#F8F8F8', fontFamily: '-apple-system,sans-serif', paddingBottom: 100 }}>
      <div style={{ background: t.grad, padding: '48px 20px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div onClick={onBack} style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={18} color="white" />
        </div>
        <div>
          <div style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>Complete payment</div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>Secure checkout · Powered by Razorpay</div>
        </div>
      </div>
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order summary</div>
          {[
            { label: 'Service', val: serviceName },
            { label: 'Booking ref', val: bookingRef },
            { label: 'Insurance cover', val: 'Rs.25,000 vet cover' },
            { label: 'Platform fee', val: 'Rs.0 (pilot offer)' },
          ].map((x, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 3 ? '1px solid #F5F5F5' : 'none' }}>
              <span style={{ fontSize: 13, color: '#888' }}>{x.label}</span>
              <span style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500 }}>{x.val}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', marginTop: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: t.primary }}>Rs.{Math.round(amount/100)}</span>
          </div>
        </div>
        <div style={{ background: 'white', borderRadius: 20, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pay with</div>
          {[
            { id: 'upi', label: 'UPI', sub: 'GPay, PhonePe, Paytm, BHIM', emoji: '📱' },
            { id: 'card', label: 'Credit / Debit card', sub: 'Visa, Mastercard, RuPay', emoji: '💳' },
            { id: 'netbanking', label: 'Net Banking', sub: 'All major Indian banks', emoji: '🏦' },
          ].map(m => (
            <div key={m.id} onClick={() => setMethod(m.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: m.id !== 'netbanking' ? '1px solid #F5F5F5' : 'none', cursor: 'pointer' }}>
              <span style={{ fontSize: 22 }}>{m.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{m.label}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{m.sub}</div>
              </div>
              <div style={{ width: 20, height: 20, borderRadius: 10, border: method === m.id ? 'none' : '1.5px solid #DDD', background: method === m.id ? t.primary : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {method === m.id && <div style={{ width: 8, height: 8, borderRadius: 4, background: 'white' }} />}
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: '#E8F5E9', borderRadius: 14, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Shield size={16} color="#2E7D32" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 12, color: '#2E7D32', lineHeight: 1.6 }}>100% secure payment via Razorpay. Your card details are never stored.</div>
        </div>
        <div style={{ background: '#E3F2FD', borderRadius: 14, padding: '10px 14px', marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 16 }}>🛡️</span>
          <div style={{ fontSize: 12, color: '#1565C0', lineHeight: 1.6 }}>Rs.25,000 vet insurance included with every Fursday booking.</div>
        </div>
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, padding: '12px 20px 28px', background: 'white', borderTop: '1px solid #F0F0F0' }}>
        <button onClick={handleRazorpayPayment} disabled={loading}
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: loading ? '#E0E0E0' : t.primary, color: loading ? '#AAA' : 'white', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Opening payment...' : 'Pay Rs.' + Math.round(amount/100) + ' securely'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#AAA' }}>Powered by Razorpay · 256-bit SSL encryption</div>
      </div>
    </div>
  );
}`;

fs.writeFileSync('C:\\Users\\nikhil.a.mathur\\SynologyDrive\\Home Project\\fursday\\src\\PaymentScreen.js', code, 'utf8');
console.log('Done, bytes:', code.length);
