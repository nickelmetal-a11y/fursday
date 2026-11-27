import React, { useState } from 'react';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

const SECTIONS = [
  {
    title: "1. Platform overview",
    content: "Fursday is a technology platform that connects pet owners (Pet Parents) with independent pet care providers (Sitters). Fursday is not a pet care provider itself; every service is provided by an independent Sitter. By creating an account or using Fursday you agree to these Terms. These Terms are governed by the laws of India.",
  },
  {
    title: "2. Payments and payouts",
    content: "Pet Parents pay when they book, through Fursday's payment partner Razorpay, on the Sitter's behalf.\n\nUntil the Sitter accepts, the payment is only authorised (held), not charged. If the Sitter declines, or does not reply within 24 hours, the hold is released in full and the Pet Parent is not charged. Banks can take a few working days to show a released hold.\n\nWhen the Sitter accepts, the payment is captured and held. It is not paid to the Sitter until 24 hours after the service ends. If the Pet Parent reports a problem or raises a dispute in that time, the payout is paused until Fursday decides (section 8). Otherwise the Sitter's share is released and paid to their registered UPI ID, normally within 48 hours of release.\n\nCancellations are refunded under section 3. Payment processing fees are absorbed by Fursday. Promo codes are funded by Fursday and never reduce the Sitter's share.",
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
    content: "In line with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021:\n\nGrievance Officer: Neha\nEmail: support@fursday.in\n\nWe acknowledge complaints within 24 hours and resolve them within 15 days.",
  },
  {
    title: "10. Account deletion and termination",
    content: "You can ask to delete your account at any time from Settings in the app. Fursday may suspend or close any account that breaks these Terms, commits fraud or harms other users. Pending payouts may be withheld where an account is closed for fraud or serious misconduct.",
  },
  {
    title: "11. Changes to these Terms",
    content: "Fursday may update these Terms. We will tell you about significant changes by email or in the app. Continuing to use Fursday after a change means you accept the updated Terms. This version is effective from 27 November 2026.",
  },
];

export default function TermsAndConditions({ onBack, city }) {
  const { t: tr, lang } = useLanguage();
  const [openSection, setOpenSection] = useState(null);

  return (
    <div style={{ ...ui.page, paddingBottom:40 }}>
      <div style={ui.header}>
        <button type="button" aria-label={tr('common_back')} onClick={onBack} style={ui.backButton}>
          <Icon name="arrowLeft" size={20} />
        </button>
        <div style={{ minWidth:0 }}>
          <h1 style={ui.headerTitle}>{tr('terms_title')}</h1>
          <div style={{ fontSize:font.sm, color:color.muted }}>{tr('terms_lastUpdated')}</div>
        </div>
      </div>

      <div style={{ padding:16 }}>
        <div style={{ display:'flex', gap:10, alignItems:'flex-start', background:color.infoSoft, borderRadius:radius.md, padding:'12px 14px', marginBottom:16, fontSize:13, color:color.info, lineHeight:1.6 }}>
          <Icon name="info" size={18} style={{ marginTop:1 }} />
          <div>
            {tr('terms_intro')}
            {lang === 'hi' && <div style={{ marginTop:6, fontSize:font.sm }}>{tr('terms_legalEnglishNote')}</div>}
          </div>
        </div>

        <section aria-label={tr('terms_payTitle')} style={{ ...ui.card, marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:font.md, fontWeight:700, color:color.ink, marginBottom:6 }}>
            <Icon name="shield" size={18} color={color.navy} />{tr('terms_payTitle')}
          </div>
          {['terms_pay1', 'terms_pay2', 'terms_pay3', 'terms_pay4'].map((k, i) => (
            <div key={k} style={{ display:'flex', gap:10, padding:'8px 0', borderTop:i ? `1px solid ${color.line}` : 'none', fontSize:13, color:color.text, lineHeight:1.6 }}>
              <span style={{ fontWeight:700, color:color.navy, fontVariantNumeric:'tabular-nums' }}>{i + 1}</span><span>{tr(k)}</span>
            </div>
          ))}
        </section>

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
          {tr('terms_footer')}
        </div>
      </div>
    </div>
  );
}