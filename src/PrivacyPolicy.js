import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from './i18n';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

const SECTIONS = [
  {
    title: "1. Who we are",
    content: "Fursday is a pet care marketplace operating in India. We connect pet owners with independent pet care providers. Fursday is the Data Fiduciary for the personal data described here under the Digital Personal Data Protection Act, 2023. Contact: support@fursday.in.",
  },
  {
    title: "2. What data we collect",
    content: "Account: your name, email and phone number.\n\nPets: name, breed, age, weight, health, vaccination, behaviour and photos.\n\nSitters only: Aadhaar number for identity verification, UPI ID for payouts, profile and portfolio photos, availability and prices. Aadhaar is never shown to other users; the app displays only its last digits, and the full number is visible only to authorised Fursday staff for verification.\n\nLocation: your approximate location when you allow it, to show nearby sitters. We do not keep a history of your precise location.\n\nBookings: services, dates, times, the address you enter for a booking, and amounts.\n\nMessages: chats and photos exchanged inside a booking.\n\nPayments: card and bank details are handled by Razorpay and never stored by Fursday.\n\nDevice: basic device and app usage information used to fix problems.",
  },
  {
    title: "3. How we use your data",
    content: "To run bookings and payments, match Pet Parents with Sitters, verify Sitters, send booking updates and walk reports, provide support and SOS help, prevent fraud and keep people safe, and meet our legal obligations in India.\n\nWe do not sell your personal data.",
  },
  {
    title: "4. Who we share data with",
    content: "The other side of your booking: a Sitter sees the Pet Parent's name, pet details, booking address and contact number for that booking, and a Pet Parent sees the Sitter's name, photo, rating and contact number.\n\nService providers who process data for us: Supabase (database and login, servers in Tokyo, Japan), Resend and Amazon SES (email), our SMS provider (text messages) and Razorpay (payments).\n\nAuthorities, when Indian law or a court order requires it.",
  },
  {
    title: "5. Storage and security",
    content: "Data is encrypted in transit and at rest. Access to personal data is limited to authorised Fursday staff, and database rules stop users from reading each other's private details. We keep your data while your account is active. When you delete your account we delete or anonymise your personal data within 30 days, except records the law requires us to keep, such as payment records.",
  },
  {
    title: "6. Your rights",
    content: "Under the Digital Personal Data Protection Act, 2023 you can: get a summary of the personal data we hold about you; correct or update it; ask us to erase it; withdraw your consent; nominate someone to exercise these rights for you; and raise a grievance with us.\n\nWrite to support@fursday.in. If you are not satisfied with our response, you can complain to the Data Protection Board of India.",
  },
  {
    title: "7. Cookies and tracking",
    content: "We use only what is needed to keep you signed in. We do not use advertising trackers or sell browsing data. If we add analytics, we will update this policy first.",
  },
  {
    title: "8. Children",
    content: "Fursday is for people aged 18 and over. We do not knowingly collect personal data from children. If you think a child has given us personal data, contact us and we will delete it.",
  },
  {
    title: "9. Grievance Officer",
    content: "Grievance Officer: [NAME TO BE ADDED]\nEmail: grievance@fursday.in\n\nWe acknowledge complaints within 24 hours and resolve them within 15 days.",
  },
  {
    title: "10. Changes to this policy",
    content: "We will tell you about significant changes by email or in the app before they take effect. This version is effective from 25 November 2026.",
  },
];

export default function PrivacyPolicy({ onBack, city }) {
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
          <div style={{ color:'white', fontSize:17, fontWeight:700 }}>{tr('privacy_title')}</div>
          <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12 }}>{tr('privacy_lastUpdated')}</div>
        </div>
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        <div style={{ background:'#E3F2FD', borderRadius:14, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#1565C0', lineHeight:1.6 }}>
          {tr('privacy_intro')}
          {lang === 'hi' && <div style={{ marginTop:6, fontSize:12 }}>{tr('privacy_legalEnglishNote')}</div>}
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
          {tr('privacy_footer')}
        </div>
      </div>
    </div>
  );
}