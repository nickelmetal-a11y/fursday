import React, { useState } from 'react';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

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
    content: "Grievance Officer: Neha\nEmail: support@fursday.in\n\nWe acknowledge complaints within 24 hours and resolve them within 15 days.",
  },
  {
    title: "10. Changes to this policy",
    content: "We will tell you about significant changes by email or in the app before they take effect. This version is effective from 25 November 2026.",
  },
];

export default function PrivacyPolicy({ onBack, city }) {
  const { t: tr, lang } = useLanguage();
  const [openSection, setOpenSection] = useState(null);

  return (
    <div style={{ ...ui.page, paddingBottom:40 }}>
      <div style={ui.header}>
        <button type="button" aria-label={tr('common_back')} onClick={onBack} style={ui.backButton}>
          <Icon name="arrowLeft" size={20} />
        </button>
        <div style={{ minWidth:0 }}>
          <h1 style={ui.headerTitle}>{tr('privacy_title')}</h1>
          <div style={{ fontSize:font.sm, color:color.muted }}>{tr('privacy_lastUpdated')}</div>
        </div>
      </div>

      <div style={{ padding:16 }}>
        <div style={{ display:'flex', gap:10, alignItems:'flex-start', background:color.infoSoft, borderRadius:radius.md, padding:'12px 14px', marginBottom:16, fontSize:13, color:color.info, lineHeight:1.6 }}>
          <Icon name="shield" size={18} style={{ marginTop:1 }} />
          <div>
            {tr('privacy_intro')}
            {lang === 'hi' && <div style={{ marginTop:6, fontSize:font.sm }}>{tr('privacy_legalEnglishNote')}</div>}
          </div>
        </div>

        <div style={{ background:color.surface, borderRadius:radius.lg, border:`1px solid ${color.line}`, overflow:'hidden' }}>
          {SECTIONS.map((s, i) => {
            const isOpen = openSection === i;
            return (
              <div key={i} style={{ borderTop:i ? `1px solid ${color.line}` : 'none' }}>
                <button type="button" aria-expanded={isOpen} onClick={() => setOpenSection(isOpen ? null : i)}
                  style={{ width:'100%', minHeight:52, border:'none', background:'none', fontFamily:font.family, textAlign:'left', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, cursor:'pointer' }}>
                  <div style={{ fontSize:font.md, fontWeight:600, color:color.ink, flex:1 }}>{s.title}</div>
                  <Icon name="chevronDown" size={18} color={isOpen ? color.navy : color.faint} style={{ transform:isOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.15s' }} />
                </button>
                {isOpen && (
                  <div style={{ padding:'0 16px 16px', fontSize:13, color:color.text, lineHeight:1.75, whiteSpace:'pre-line' }}>
                    {s.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ textAlign:'center', padding:'20px 0', fontSize:font.sm, color:color.muted, lineHeight:1.6 }}>
          {tr('privacy_footer')}
        </div>
      </div>
    </div>
  );
}