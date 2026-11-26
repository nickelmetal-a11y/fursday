import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from './i18n';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

const SECTIONS = [
  {
    title: "1. Platform overview",
    content: "Fursday is a technology platform that connects pet owners (Pet Parents) with independent pet care providers (Sitters). Fursday is not a pet care provider itself; every service is provided by an independent Sitter. By creating an account or using Fursday you agree to these Terms. These Terms are governed by the laws of India.",
  },
  {
    title: "2. Payments and payouts",
    content: "When a booking is paid in the app, Fursday collects the payment through its payment partner (Razorpay) on the Sitter's behalf and pays the Sitter's share to their registered UPI ID after the service is marked completed, normally within 48 hours. Payment processing fees are absorbed by Fursday. Promo codes are funded by Fursday and never reduce the Sitter's share.",
  },
  {
    title: "3. Cancellation and refund policy",
    content: "Cancelled by the Pet Parent 72 hours or more before the service: 100% refund.\n\nCancelled 24 to 72 hours before: 75% refund.\n\nCancelled less than 24 hours before, or Pet Parent no-show: no refund.\n\nCancelled by the Sitter: 100% refund to the Pet Parent. Repeated Sitter cancellations lead to a warning, then suspension.\n\nRefunds go back to the original payment method within 5 to 7 working days. Fursday makes the final decision on disputed cancellations.",
  },
  {
    title: "4. Sitter responsibilities",
    content: "Sitters must give accurate information during signup, including a valid Aadhaar for identity verification and a UPI ID for payouts. Sitters are responsible for the safety and wellbeing of pets in their care, must start each service with the Pet Parent's code, and must send a walk report after every completed service. Sitters must keep a rating of 3.5 or above to stay active. Fursday may suspend or remove any Sitter who breaks these Terms.",
  },
  {
    title: "5. Pet Parent responsibilities",
    content: "Pet Parents must give accurate pet information, including health conditions, vaccination status and behaviour. Failing to disclose known aggressive behaviour may make the Pet Parent liable for injuries to the Sitter. Pet Parents must make sure the Sitter can get in and can reach them during the service. Pet Parents must not arrange services outside Fursday with Sitters they met through Fursday.",
  },
  {
    title: "6. Safety and liability",
    content: "Fursday verifies each Sitter's identity before approval and offers an in-app SOS that reaches Fursday support during a booking. Fursday does not currently provide insurance cover for pets or Sitters. Fursday is not liable for incidents outside the booked service window, and its maximum liability in any dispute is limited to the value of the booking concerned. All parties agree to try Fursday mediation before taking legal action.",
  },
  {
    title: "7. Commission and pricing",
    content: "Fursday charges a flat 15% commission on the booking value, so Sitters receive 85% of every completed booking. The first 20 approved Sitters (Founding Sitters) pay 0% commission. The rate is shown the same way everywhere in the app, with no hidden deductions. Fursday will give Sitters 30 days' notice before changing commission rates.",
  },
  {
    title: "8. Disputes and complaints",
    content: "Report a problem from the booking itself in the app, or contact support, within 24 hours of the incident. Fursday will investigate and decide within 72 hours, and may refund, withhold or redistribute payments in cases of dispute or fraud. Disputes not resolved through Fursday mediation are subject to the courts of Gurugram, Haryana, India.",
  },
  {
    title: "9. Grievance Officer",
    content: "In line with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021:\n\nGrievance Officer: [NAME TO BE ADDED]\nEmail: grievance@fursday.in\n\nWe acknowledge complaints within 24 hours and resolve them within 15 days.",
  },
  {
    title: "10. Account deletion and termination",
    content: "You can ask to delete your account at any time from Settings in the app. Fursday may suspend or close any account that breaks these Terms, commits fraud or harms other users. Pending payouts may be withheld where an account is closed for fraud or serious misconduct.",
  },
  {
    title: "11. Changes to these Terms",
    content: "Fursday may update these Terms. We will tell you about significant changes by email or in the app. Continuing to use Fursday after a change means you accept the updated Terms. This version is effective from 25 November 2026.",
  },
];

export default function TermsAndConditions({ onBack, city }) {
  const t = THEMES[city] || THEMES.Gurgaon;
  const { t: tr, lang } = useLanguage();
  const [openSection, setOpenSection] = useState(null);

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F8F8F8', fontFamily:'-apple-system,sans-serif', paddingBottom:40 }}>
      <div style={{ background:t.grad, padding:'48px 20px 24px', display:'flex', alignItems:'center', gap:12 }}>
        <button type="button" aria-label={tr('common_back')} onClick={onBack} style={{ width:36, height:36, borderRadius:12, border:'none', padding:0, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
          <ArrowLeft size={18} color="white" />
        </button>
        <div>
          <div style={{ color:'white', fontSize:17, fontWeight:700 }}>{tr('terms_title')}</div>
          <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12 }}>{tr('terms_lastUpdated')}</div>
        </div>
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        <div style={{ background:'#E3F2FD', borderRadius:14, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#1565C0', lineHeight:1.6 }}>
          {tr('terms_intro')}
          {lang === 'hi' && <div style={{ marginTop:6, fontSize:12 }}>{tr('terms_legalEnglishNote')}</div>}
        </div>

        {SECTIONS.map((s, i) => (
          <div key={i} style={{ background:'white', borderRadius:16, marginBottom:8, boxShadow:'0 2px 8px rgba(0,0,0,0.05)', overflow:'hidden' }}>
            <button type="button" aria-expanded={openSection === i} onClick={() => setOpenSection(openSection === i ? null : i)}
              style={{ width:'100%', border:'none', background:'none', font:'inherit', textAlign:'left', padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', flex:1, paddingRight:12 }}>{s.title}</div>
              {openSection === i
                ? <ChevronUp size={18} color={t.primary} />
                : <ChevronDown size={18} color="#CCC" />}
            </button>
            {openSection === i && (
              <div style={{ padding:'12px 16px 16px', fontSize:13, color:'#555', lineHeight:1.8, borderTop:'1px solid #F5F5F5', whiteSpace:'pre-line' }}>
                {s.content}
              </div>
            )}
          </div>
        ))}

        <div style={{ textAlign:'center', padding:'20px 0', fontSize:12, color:'#AAA', lineHeight:1.6 }}>
          {tr('terms_footer')}
        </div>
      </div>
    </div>
  );
}