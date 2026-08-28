import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

const SECTIONS = [
  {
    title: '1. Who we are',
    content: "Fursday is a peer-to-peer pet care marketplace operated in India. We connect pet owners with independent pet care providers. Our registered address and data controller is based in India. Contact us at hello@fursday.in for any privacy-related queries.",
  },
  {
    title: '2. What data we collect',
    content: "We collect the following information when you use Fursday:\n\nAccount data: Your email address, name, and phone number when you sign up.\n\nPet data: Information about your pets including name, breed, age, weight, health status, and photos.\n\nLocation data: Your approximate GPS location to show nearby sitters. We do not store your precise location permanently.\n\nBooking data: Details of services you book including dates, times, and payment amounts.\n\nCommunication data: Messages exchanged between pet parents and sitters on our platform.\n\nPayment data: We do not store card details. Payments are processed by Razorpay who have their own privacy policy.\n\nDevice data: Basic device information and app usage data for improving our service.",
  },
  {
    title: '3. How we use your data',
    content: "We use your data to:\n\n- Provide and improve the Fursday platform\n- Match pet parents with suitable sitters\n- Process bookings and payments\n- Send booking confirmations and walk reports\n- Ensure safety and prevent fraud\n- Comply with legal obligations under Indian law\n- Send service updates and important notifications\n\nWe do not sell your personal data to third parties.",
  },
  {
    title: '4. Who we share data with',
    content: "We share your data only with:\n\nSitters: Pet parents' names, pet details, and contact information are shared with the sitter they book.\n\nPet parents: Sitters' names, photos, ratings, and contact information are shown to pet parents.\n\nRazorpay: Payment processing. Subject to Razorpay's privacy policy.\n\nResend: Email delivery service for booking confirmations and OTP codes.\n\nSupabase: Our database provider stores your data on secure servers.\n\nLegal authorities: We may share data if required by Indian law or court order.",
  },
  {
    title: '5. Data storage and security',
    content: "Your data is stored on Supabase servers located in Japan (Tokyo region). We use industry-standard encryption for data in transit and at rest. Access to personal data is restricted to authorised Fursday team members only. We retain your data for as long as your account is active. If you delete your account, we delete your personal data within 30 days.",
  },
  {
    title: '6. Your rights',
    content: "Under India's Personal Data Protection Bill and IT Act 2000, you have the right to:\n\n- Access the personal data we hold about you\n- Correct inaccurate personal data\n- Delete your account and associated personal data\n- Withdraw consent for data processing\n- Receive a copy of your data\n\nTo exercise any of these rights, contact us at hello@fursday.in. We will respond within 30 days.",
  },
  {
    title: '7. Cookies and tracking',
    content: "Fursday uses minimal tracking. We use session cookies to keep you logged in. We do not use third-party advertising trackers or sell your browsing data. If we add analytics in future, we will update this policy and notify users.",
  },
  {
    title: '8. Children',
    content: "Fursday is not intended for use by anyone under the age of 18. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, contact us at hello@fursday.in and we will delete it immediately.",
  },
  {
    title: '9. Changes to this policy',
    content: "We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification. Continued use of Fursday after changes constitutes acceptance of the updated policy. Current version effective from July 2026.",
  },
  {
    title: '10. Contact us',
    content: "For any privacy-related questions or to exercise your data rights:\n\nEmail: hello@fursday.in\nWhatsApp: Available on the app\n\nWe aim to respond to all privacy queries within 30 days.",
  },
];

export default function PrivacyPolicy({ onBack, city }) {
  const t = THEMES[city] || THEMES.Gurgaon;
  const [openSection, setOpenSection] = useState(null);

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F8F8F8', fontFamily:'-apple-system,sans-serif', paddingBottom:40 }}>
      <div style={{ background:t.grad, padding:'48px 20px 24px', display:'flex', alignItems:'center', gap:12 }}>
        <div onClick={onBack} style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <ArrowLeft size={18} color="white" />
        </div>
        <div>
          <div style={{ color:'white', fontSize:17, fontWeight:700 }}>Privacy Policy</div>
          <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12 }}>Last updated July 2026</div>
        </div>
      </div>

      <div style={{ padding:'16px 16px 0' }}>
        <div style={{ background:'#E3F2FD', borderRadius:14, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#1565C0', lineHeight:1.6 }}>
          This policy explains how Fursday collects, uses, and protects your personal data in compliance with India's IT Act 2000 and Personal Data Protection Bill.
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