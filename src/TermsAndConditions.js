import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

const SECTIONS = [
  {
    title: '1. Platform overview',
    content: "Fursday is a technology platform that connects pet owners with independent pet care providers called Sitters. Fursday is not a pet care provider itself. All pet care services are provided by independent Sitters. By using Fursday, you agree to these Terms in full. These Terms are governed by the laws of India.",
  },
  {
    title: '2. Payments and escrow',
    content: "All payments are collected by Fursday via Razorpay on behalf of the Sitter. Funds are held by Fursday until the service is marked as completed. Fursday releases the Sitter share within 48 hours of service completion. Fursday charges a flat 15% commission on the gross booking value, deducted before payout to the Sitter — Sitters receive 85% of every booking. Razorpay's payment processing fee is absorbed by Fursday.",
  },
  {
    title: '3. Cancellation and refund policy',
    content: "Cancellation 24+ hours before service: Full refund to Pet Parent.\n\nCancellation less than 24 hours before service: 50% refund to Pet Parent, 50% paid to Sitter as compensation.\n\nPet Parent no-show: No refund. Full amount paid to Sitter.\n\nCancellation by Sitter: Full refund to Pet Parent. First cancellation: warning. Second: 7-day suspension. Third: permanent suspension.\n\nFursday reserves the right to make final decisions on all disputes.",
  },
  {
    title: '4. Sitter responsibilities',
    content: "Sitters must provide accurate information during onboarding including valid Aadhaar ID, UPI details, and availability. Sitters are responsible for the safety and wellbeing of pets in their care. Sitters must send a walk report after every completed service. Sitters must maintain a rating of 3.5 or above to remain active. Fursday reserves the right to suspend or remove any Sitter who violates these terms.",
  },
  {
    title: '5. Pet Parent responsibilities',
    content: "Pet Parents must provide accurate pet information including health conditions, vaccination status, and behavioral traits. Failure to disclose known aggressive behavior may result in the Pet Parent being liable for injuries to the Sitter. Pet Parents must ensure gate access and contact availability during booked services. Pet Parents must not arrange services outside the Fursday platform with Sitters they meet through Fursday.",
  },
  {
    title: '6. Insurance and liability',
    content: "Every Fursday booking includes up to Rs.25,000 in veterinary expense coverage per incident, subject to the terms of the insurance policy. This coverage is activated automatically for each confirmed and paid booking. Fursday is not liable for incidents outside the booked service window. Maximum liability of Fursday in any dispute is limited to the value of the booking in question. All parties agree to resolve disputes through Fursday mediation before pursuing legal action.",
  },
  {
    title: '7. Platform commission and pricing',
    content: "Fursday charges a flat 15% commission on the gross booking value. Sitters receive 85% of the booking value on every completed service — this rate is shown the same way everywhere in the app, with no hidden deductions. Fursday reserves the right to change commission rates with 30 days advance notice to all Sitters.",
  },
  {
    title: '8. Dispute resolution',
    content: "All disputes must be reported to Fursday via WhatsApp or email within 24 hours of the incident. Fursday will investigate and make a final decision within 72 hours. Fursday reserves the right to refund, withhold, or redistribute payments at its sole discretion in cases of dispute or fraud. Disputes not resolved through Fursday mediation shall be subject to courts in Gurgaon, Haryana, India.",
  },
  {
    title: '9. Account termination',
    content: "Fursday reserves the right to suspend or permanently terminate any account that violates these Terms, engages in fraudulent activity, or harms the reputation of the platform. Terminated accounts forfeit any pending payouts if termination is due to fraud or gross misconduct. Users may delete their account at any time by contacting Fursday support.",
  },
  {
    title: '10. Changes to these terms',
    content: "Fursday may update these Terms at any time. Users will be notified of significant changes via email or WhatsApp. Continued use of the platform after changes constitutes acceptance of the new Terms. Current version effective from July 2026.",
  },
];

export default function TermsAndConditions({ onBack, city }) {
  const t = THEMES[city] || THEMES.Gurgaon;
  const [openSection, setOpenSection] = useState(null);

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F8F8F8', fontFamily:'-apple-system,sans-serif', paddingBottom:40 }}>
      <div style={{ background:t.grad, padding:'48px 20px 24px', display:'flex', alignItems:'center', gap:12 }}>
        <div onClick={onBack} style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <ArrowLeft size={18} color="white" />
        </div>
        <div>
          <div style={{ color:'white', fontSize:17, fontWeight:700 }}>Terms and Conditions</div>
          <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12 }}>Last updated July 2026</div>
        </div>
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        <div style={{ background:'#E3F2FD', borderRadius:14, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#1565C0', lineHeight:1.6 }}>
          Please read these Terms carefully before using Fursday. By using the platform, you agree to be bound by these Terms.
        </div>

        {SECTIONS.map((s, i) => (
          <div key={i} style={{ background:'white', borderRadius:16, marginBottom:8, boxShadow:'0 2px 8px rgba(0,0,0,0.05)', overflow:'hidden' }}>
            <div onClick={() => setOpenSection(openSection === i ? null : i)}
              style={{ padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', flex:1, paddingRight:12 }}>{s.title}</div>
              {openSection === i
                ? <ChevronUp size={18} color={t.primary} />
                : <ChevronDown size={18} color="#CCC" />}
            </div>
            {openSection === i && (
              <div style={{ padding:'12px 16px 16px', fontSize:13, color:'#555', lineHeight:1.8, borderTop:'1px solid #F5F5F5', whiteSpace:'pre-line' }}>
                {s.content}
              </div>
            )}
          </div>
        ))}

        <div style={{ textAlign:'center', padding:'20px 0', fontSize:12, color:'#AAA', lineHeight:1.6 }}>
          Questions? Contact us at hello@fursday.in
        </div>
      </div>
    </div>
  );
}