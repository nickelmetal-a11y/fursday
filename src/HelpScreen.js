import React, { useMemo, useState } from 'react';
import { useLanguage } from './i18n';
import { useSupportContact, openWhatsAppSupport, callSupport } from './supportContact';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

// Each answer is kept in both languages side by side so the two never drift apart.
const FAQ = [
  { group: 'parent', q: { en: 'How do I book a sitter?', hi: 'सिटर कैसे बुक करें?' },
    a: { en: 'Tap a service on Home or open Explore, pick a sitter, then choose your pet, date and time. The sitter confirms the request, and you pay once it is confirmed.', hi: 'होम पर कोई सेवा चुनें या Explore खोलें, सिटर चुनें, फिर अपना पालतू, तारीख और समय चुनें। सिटर अनुरोध स्वीकार करता है, और स्वीकार होने के बाद आप भुगतान करते हैं।' } },
  { group: 'parent', q: { en: 'How are sitters verified?', hi: 'सिटर का सत्यापन कैसे होता है?' },
    a: { en: 'Every sitter submits Aadhaar and is reviewed by the Fursday team before going live. A "Verified" badge on a profile means the identity check passed. Reviews come only from parents who completed a booking.', hi: 'हर सिटर आधार जमा करता है और लाइव होने से पहले Fursday टीम उसकी जाँच करती है। प्रोफ़ाइल पर "सत्यापित" बैज का मतलब है कि पहचान जाँच पूरी हो गई है। रिव्यू केवल उन्हीं माता-पिता के होते हैं जिन्होंने बुकिंग पूरी की।' } },
  { group: 'parent', q: { en: 'What is the refund policy if I cancel?', hi: 'रद्द करने पर रिफ़ंड नीति क्या है?' },
    a: { en: '72 hours or more before the service: 100% refund. 24 to 72 hours before: 75%. Less than 24 hours: no refund. If the sitter cancels, you always get 100% back. Refunds reach you in 5 to 7 working days.', hi: 'सेवा से 72 घंटे या उससे पहले: 100% रिफ़ंड। 24 से 72 घंटे पहले: 75%। 24 घंटे से कम: कोई रिफ़ंड नहीं। अगर सिटर रद्द करता है, तो आपको हमेशा 100% वापस मिलता है। रिफ़ंड 5 से 7 कार्यदिवस में आता है।' } },
  { group: 'parent', q: { en: 'What is the 4-digit start code?', hi: '4 अंकों का स्टार्ट कोड क्या है?' },
    a: { en: 'When your sitter arrives, share the code shown on your booking. The walk starts only after the sitter enters it, so you always know the service has really begun.', hi: 'जब सिटर पहुँचे, तो अपनी बुकिंग पर दिखा कोड बताएँ। सिटर के कोड डालने के बाद ही सैर शुरू होती है, ताकि आपको पता रहे कि सेवा सच में शुरू हुई है।' } },
  { group: 'parent', q: { en: 'How do I change the time of a booking?', hi: 'बुकिंग का समय कैसे बदलें?' },
    a: { en: 'Open the booking and message your sitter in chat to agree a new time. If the new time does not work for them, cancel and book again; the refund rules above apply.', hi: 'बुकिंग खोलें और चैट में सिटर से नए समय पर बात करें। अगर नया समय उनके लिए ठीक नहीं है, तो रद्द करके दोबारा बुक करें; ऊपर दिए रिफ़ंड नियम लागू होंगे।' } },
  { group: 'parent', q: { en: 'The sitter did not turn up. What now?', hi: 'सिटर नहीं आया, अब क्या करें?' },
    a: { en: 'Use SOS or WhatsApp support right away. If the sitter does not show up, you get a full refund and we follow up with the sitter.', hi: 'तुरंत SOS या WhatsApp सपोर्ट का उपयोग करें। सिटर के न आने पर आपको पूरा रिफ़ंड मिलता है और हम सिटर से बात करते हैं।' } },
  { group: 'parent', q: { en: 'How do I report a problem or raise a complaint?', hi: 'समस्या या शिकायत कैसे दर्ज करें?' },
    a: { en: 'Open the booking in Bookings within 24 hours and tap "Report a problem with this sitter", or "Dispute" on a completed booking. We reply within 72 hours.', hi: 'बुकिंग्स में 24 घंटे के अंदर बुकिंग खोलें और "इस सिटर की शिकायत करें" पर, या पूरी हुई बुकिंग पर "विवाद दर्ज करें" पर टैप करें। हम 72 घंटे में जवाब देते हैं।' } },
  { group: 'parent', q: { en: 'How do promo codes work?', hi: 'प्रोमो कोड कैसे काम करते हैं?' },
    a: { en: 'Enter the code on the review step before booking. Each code can be used once per person. The discount comes from Fursday, never from your sitter\'s earnings.', hi: 'बुकिंग से पहले रिव्यू स्टेप पर कोड डालें। हर कोड एक व्यक्ति एक बार ही उपयोग कर सकता है। छूट Fursday देता है, आपके सिटर की कमाई से कभी नहीं कटती।' } },
  { group: 'sitter', q: { en: 'How do I get approved as a sitter?', hi: 'सिटर के रूप में मंज़ूरी कैसे मिलती है?' },
    a: { en: 'Finish all 8 signup steps, including Aadhaar and UPI. The team reviews you, usually within 24 to 48 hours. If something needs fixing, you will see the reason on your profile; update it and we review again.', hi: 'आधार और UPI सहित सभी 8 साइनअप स्टेप पूरे करें। टीम आमतौर पर 24 से 48 घंटे में जाँच करती है। अगर कुछ ठीक करना है, तो कारण आपकी प्रोफ़ाइल पर दिखेगा; उसे अपडेट करें और हम दोबारा जाँच करेंगे।' } },
  { group: 'sitter', q: { en: 'How much does Fursday take?', hi: 'Fursday कितना कमीशन लेता है?' },
    a: { en: 'The Fursday commission is a flat 15% of each booking, so you keep 85%. The first 20 approved sitters (Founding Sitters) pay 0%.', hi: 'हर बुकिंग का सिर्फ़ 15%, यानी 85% आपका। पहले 20 मंज़ूर सिटर (फ़ाउंडिंग सिटर) 0% देते हैं।' } },
  { group: 'sitter', q: { en: 'When do I get paid?', hi: 'मुझे भुगतान कब मिलता है?' },
    a: { en: 'After a booking is marked complete, your share goes to the UPI ID on your profile, normally within 48 hours. Check Earnings for the status of each payout.', hi: 'बुकिंग पूरी होने के बाद आपका हिस्सा आपकी प्रोफ़ाइल वाले UPI ID पर आमतौर पर 48 घंटे में आता है। हर भुगतान की स्थिति कमाई सेक्शन में देखें।' } },
  { group: 'sitter', q: { en: 'How do I start and finish a walk?', hi: 'सैर कैसे शुरू और खत्म करें?' },
    a: { en: 'At the door, ask the parent for their 4-digit code and enter it to start. When you finish, add photos and a walk report; parents who get reports book again far more often.', hi: 'दरवाज़े पर माता-पिता से 4 अंकों का कोड लें और शुरू करने के लिए डालें। खत्म होने पर फ़ोटो और वॉक रिपोर्ट जोड़ें; रिपोर्ट पाने वाले माता-पिता कहीं ज़्यादा दोबारा बुक करते हैं।' } },
  { group: 'sitter', q: { en: 'I have a problem with a parent or a booking.', hi: 'मुझे किसी माता-पिता या बुकिंग से समस्या है।' },
    a: { en: 'If you feel unsafe, press SOS. For anything else, contact support on WhatsApp with the booking reference; we reply within 24 hours.', hi: 'अगर आप असुरक्षित महसूस करें, तो SOS दबाएँ। बाकी किसी भी बात के लिए बुकिंग नंबर के साथ WhatsApp पर सपोर्ट से संपर्क करें; हम 24 घंटे में जवाब देते हैं।' } },
  { group: 'account', q: { en: 'How do I switch to Hindi?', hi: 'अंग्रेज़ी में कैसे बदलें?' },
    a: { en: 'Tap the EN / हि button at the top of any screen.', hi: 'किसी भी स्क्रीन के ऊपर EN / हि बटन पर टैप करें।' } },
  { group: 'account', q: { en: 'How do I delete my account?', hi: 'अपना खाता कैसे डिलीट करें?' },
    a: { en: 'Go to Settings and tap "Delete my account". We remove your personal data within 30 days, apart from payment records the law requires us to keep.', hi: 'Settings में जाकर "मेरा खाता डिलीट करें" पर टैप करें। हम 30 दिन में आपका निजी डेटा हटा देते हैं, सिवाय उन भुगतान रिकॉर्ड के जिन्हें कानूनन रखना ज़रूरी है।' } },
];

const GROUPS = [
  { id: 'parent', label: { en: 'Pet parents', hi: 'पालतू माता-पिता' } },
  { id: 'sitter', label: { en: 'Sitters', hi: 'सिटर' } },
  { id: 'account', label: { en: 'Account', hi: 'खाता' } },
];

export default function HelpScreen({ onBack, city, isSitter }) {
  const { lang } = useLanguage();
  const L = (o) => o[lang] || o.en;
  const { whatsapp, phone } = useSupportContact();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(null);
  const [group, setGroup] = useState(isSitter ? 'sitter' : 'parent');
  const hi = lang === 'hi';

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ.filter(f => (q ? (L(f.q) + ' ' + L(f.a)).toLowerCase().includes(q) : f.group === group));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, group, lang]);

  const contactBtn = { flex: 1, minWidth: 0, minHeight: 72, borderRadius: radius.lg, border: `1px solid ${color.line}`, background: color.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: font.sm, fontWeight: 600, fontFamily: font.family, color: color.ink, cursor: 'pointer', boxSizing: 'border-box' };
  const contactIcon = (name, tone) => (
    <span style={{ width: 36, height: 36, borderRadius: radius.pill, background: tone ? color[tone + 'Soft'] : color.navySoft, color: tone ? color[tone] : color.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={18} />
    </span>
  );

  return (
    <div style={{ ...ui.page, paddingBottom: 40 }}>
      <div style={ui.header}>
        <button onClick={onBack} aria-label={hi ? 'वापस' : 'Back'} style={ui.backButton}>
          <Icon name="arrowLeft" size={20} />
        </button>
        <h1 style={ui.headerTitle}>{hi ? 'मदद और सवाल' : 'Help & FAQ'}</h1>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: color.surface, border: `1px solid ${color.line}`, borderRadius: radius.md, padding: '0 14px', minHeight: 48 }}>
          <Icon name="search" size={18} color={color.muted} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={hi ? 'अपना सवाल खोजें' : 'Search your question'} aria-label={hi ? 'खोजें' : 'Search'}
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: 15, padding: '12px 0', background: 'transparent', fontFamily: font.family, color: color.ink }} />
        </label>

        <div>
          <h2 style={ui.sectionTitle}>{hi ? 'हमसे बात करें' : 'Talk to us'}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...contactBtn, opacity: whatsapp ? 1 : 0.5 }} disabled={!whatsapp} onClick={() => openWhatsAppSupport(whatsapp, hi ? 'नमस्ते, मुझे Fursday में मदद चाहिए' : 'Hi, I need help with Fursday')}>
              {contactIcon('message', 'success')}WhatsApp
            </button>
            <button style={{ ...contactBtn, opacity: phone ? 1 : 0.5 }} disabled={!phone} onClick={() => callSupport(phone)}>
              {contactIcon('phone')}{hi ? 'कॉल करें' : 'Call'}
            </button>
            <a href="mailto:support@fursday.in" style={{ ...contactBtn, textDecoration: 'none' }}>
              {contactIcon('mail', 'info')}{hi ? 'ईमेल' : 'Email'}
            </a>
          </div>
          <div style={{ fontSize: font.sm, color: color.muted, marginTop: 8, lineHeight: 1.5 }}>{hi ? 'हम आमतौर पर 24 घंटे में जवाब देते हैं। आपात स्थिति में Settings में SOS दबाएँ।' : 'We usually reply within 24 hours. In an emergency, use SOS in Settings.'}</div>
        </div>

        <div>
          {!query && (
            <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto' }}>
              {GROUPS.map(g => (
                <button key={g.id} role="tab" aria-selected={group === g.id} onClick={() => { setGroup(g.id); setOpen(null); }}
                  style={{ ...ui.chip(group === g.id), minHeight: 40, flexShrink: 0 }}>
                  {L(g.label)}
                </button>
              ))}
            </div>
          )}

          {results.length === 0 && (
            <div style={{ ...ui.card, textAlign: 'center', padding: 24, fontSize: 13, color: color.muted }}>
              <div style={{ ...ui.iconTile, margin: '0 auto 10px' }}><Icon name="search" /></div>
              {hi ? 'कोई जवाब नहीं मिला। ऊपर WhatsApp पर पूछें।' : 'No answer found. Ask us on WhatsApp above.'}
            </div>
          )}
          {results.length > 0 && (
            <div style={{ background: color.surface, borderRadius: radius.lg, overflow: 'hidden', border: `1px solid ${color.line}` }}>
              {results.map((f, i) => {
                const key = f.q.en;
                const isOpen = open === key;
                return (
                  <div key={key} style={{ borderTop: i ? `1px solid ${color.line}` : 'none' }}>
                    <button onClick={() => setOpen(isOpen ? null : key)} aria-expanded={isOpen}
                      style={{ width: '100%', minHeight: 56, padding: '12px 16px', background: 'none', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', fontSize: font.md, fontWeight: 600, fontFamily: font.family, color: color.ink }}>
                      <span>{L(f.q)}</span>
                      <Icon name="chevronDown" size={18} color={isOpen ? color.navy : color.faint} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </button>
                    {isOpen && <div style={{ padding: '0 16px 16px', fontSize: font.md, color: color.text, lineHeight: 1.65 }}>{L(f.a)}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
