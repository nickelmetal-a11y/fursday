import { useState, useEffect } from 'react';

// Minimal, dependency-free i18n: a flat key->string dictionary per language,
// persisted to localStorage (not per-component state) so a language choice
// made on one screen holds across navigation, which in this app means a
// full component remount rather than a client-side route change.
const translations = {
  en: {
    greeting: 'Hi',
    live: '● You are live',
    pendingApproval: '○ Pending approval',
    thisMonth: 'This month so far',
    payoutNote: 'Payout on 5th of next month',
    newRequests: 'New requests',
    yourRating: 'Your rating',
    totalWalks: 'Total walks',
    tabNew: 'New',
    tabRequests: 'Requests',
    tabUpcoming: 'Upcoming',
    tabActive: 'Active',
    tabPast: 'Past',
    noNewRequests: 'No new requests',
    noUpcomingJobs: 'No upcoming jobs',
    noActiveWalks: 'No active walks',
    noPastJobs: 'No past jobs',
    newRequestHint: 'New booking requests will appear here. Make sure your profile is live!',
    confirmedHint: 'Your confirmed bookings will appear here.',
    message: 'Message',
    call: 'Call',
    accept: 'Accept',
    decline: 'Decline',
    newBookingBanner: 'New booking request — respond within 1 hour',
    walkInProgress: 'Walk in progress',
    onMyWay: 'On my way',
    arrived: 'Arrived',
    enterOtpTitleWalk: 'Enter OTP to start the walk',
    enterOtpTitleDrop: 'Enter drop-off OTP to start',
    otpHint: 'Ask {name} for the 4-digit code shown in their app.',
    start: 'Start',
    sos: '🆘 SOS — Call Fursday Support Now',
    pickupOtpTitle: 'Show pick-up OTP to pet parent',
    pickupOtpHint: 'When {name} collects their dog, show them this code.',
    parentCollected: 'Parent collected the dog ✓',
    completeWalk: 'Complete walk ✓',
    uploadPhotos: '📸 Upload walk photos',
    photosUploaded: '✅ Photos uploaded',
    homeNav: 'Home',
    jobsNav: 'My Jobs',
    earningsNav: 'Earnings',
    editProfileNav: 'Edit profile',
    needHelp: 'Need help? Chat with Fursday support',
    loadingJobs: 'Loading your jobs...',
    openRequestsHint: 'Open requests from pet parents near you. Accept to let them know you are available.',
    noOpenRequests: 'No open requests',
    openRequestsEmptyHint: 'When pet parents broadcast a request, it will appear here.',
    acceptThisRequest: 'Accept this request',

    welcome: 'Welcome to Fursday',
    taglineEmail: 'Trusted pet care, right at your doorstep.',
    taglineOtp: 'Enter the 6-digit code we sent to your email.',
    yourEmail: 'Your email',
    continueWithEmail: 'Continue with email →',
    sending: 'Sending...',
    noPasswordNeeded: 'No password needed · Secure OTP login',
    codeSentTo: 'Code sent to',
    checkInbox: 'Check your inbox and enter the 6-digit code.',
    signIn: 'Sign in',
    verifying: 'Verifying...',
    useDifferentEmail: 'Use a different email',
    resendCode: 'Resend code',
  },
  hi: {
    greeting: 'नमस्ते',
    live: '● आप लाइव हैं',
    pendingApproval: '○ स्वीकृति बाकी है',
    thisMonth: 'इस महीने अब तक',
    payoutNote: 'भुगतान अगले महीने की 5 तारीख को',
    newRequests: 'नई रिक्वेस्ट',
    yourRating: 'आपकी रेटिंग',
    totalWalks: 'कुल वॉक',
    tabNew: 'नई',
    tabRequests: 'रिक्वेस्ट',
    tabUpcoming: 'आगामी',
    tabActive: 'जारी',
    tabPast: 'पुरानी',
    noNewRequests: 'कोई नई रिक्वेस्ट नहीं',
    noUpcomingJobs: 'कोई आगामी बुकिंग नहीं',
    noActiveWalks: 'कोई जारी वॉक नहीं',
    noPastJobs: 'कोई पुरानी बुकिंग नहीं',
    newRequestHint: 'नई बुकिंग रिक्वेस्ट यहां दिखेंगी। सुनिश्चित करें कि आपकी प्रोफ़ाइल लाइव है!',
    confirmedHint: 'आपकी पक्की बुकिंग यहां दिखेंगी।',
    message: 'संदेश',
    call: 'कॉल करें',
    accept: 'स्वीकार करें',
    decline: 'अस्वीकार करें',
    newBookingBanner: 'नई बुकिंग रिक्वेस्ट — 1 घंटे के अंदर जवाब दें',
    walkInProgress: 'वॉक जारी है',
    onMyWay: 'मैं आ रहा हूँ',
    arrived: 'पहुँच गया',
    enterOtpTitleWalk: 'वॉक शुरू करने के लिए OTP डालें',
    enterOtpTitleDrop: 'शुरू करने के लिए ड्रॉप-ऑफ OTP डालें',
    otpHint: '{name} से उनके ऐप में दिखा 4-अंकों का कोड पूछें।',
    start: 'शुरू करें',
    sos: '🆘 एसओएस — फर्सडे सपोर्ट को कॉल करें',
    pickupOtpTitle: 'पिक-अप OTP पालक को दिखाएं',
    pickupOtpHint: 'जब {name} अपना कुत्ता लें, तो उन्हें यह कोड दिखाएं।',
    parentCollected: 'पालक ने कुत्ता ले लिया ✓',
    completeWalk: 'वॉक पूरी करें ✓',
    uploadPhotos: '📸 वॉक की फोटो अपलोड करें',
    photosUploaded: '✅ फोटो अपलोड हो गईं',
    homeNav: 'होम',
    jobsNav: 'मेरे काम',
    earningsNav: 'कमाई',
    editProfileNav: 'प्रोफ़ाइल बदलें',
    needHelp: 'मदद चाहिए? फर्सडे सपोर्ट से चैट करें',
    loadingJobs: 'आपके काम लोड हो रहे हैं...',
    openRequestsHint: 'आपके पास के पालकों की खुली रिक्वेस्ट। उपलब्ध होने की जानकारी देने के लिए स्वीकार करें।',
    noOpenRequests: 'कोई खुली रिक्वेस्ट नहीं',
    openRequestsEmptyHint: 'जब पालक कोई रिक्वेस्ट भेजेंगे, वह यहां दिखेगी।',
    acceptThisRequest: 'यह रिक्वेस्ट स्वीकार करें',

    welcome: 'फर्सडे में आपका स्वागत है',
    taglineEmail: 'भरोसेमंद पेट केयर, आपके दरवाज़े पर।',
    taglineOtp: 'वह 6 अंकों का कोड डालें जो हमने आपके ईमेल पर भेजा है।',
    yourEmail: 'आपका ईमेल',
    continueWithEmail: 'ईमेल से जारी रखें →',
    sending: 'भेजा जा रहा है...',
    noPasswordNeeded: 'पासवर्ड की ज़रूरत नहीं · सुरक्षित OTP लॉगिन',
    codeSentTo: 'कोड भेजा गया',
    checkInbox: 'अपना इनबॉक्स देखें और 6 अंकों का कोड डालें।',
    signIn: 'साइन इन करें',
    verifying: 'जांचा जा रहा है...',
    useDifferentEmail: 'दूसरा ईमेल इस्तेमाल करें',
    resendCode: 'फिर से कोड भेजें',
  },
};

const LANG_KEY = 'fursday_lang';

export function useLanguage() {
  const [lang, setLangState] = useState(() => localStorage.getItem(LANG_KEY) || 'en');

  useEffect(() => {
    const onStorage = (e) => { if (e.key === LANG_KEY && e.newValue) setLangState(e.newValue); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setLang = (l) => {
    localStorage.setItem(LANG_KEY, l);
    setLangState(l);
  };

  const dict = translations[lang] || translations.en;
  const t = (key, vars) => {
    let str = dict[key] ?? translations.en[key] ?? key;
    if (vars) Object.keys(vars).forEach(k => { str = str.replace('{' + k + '}', vars[k]); });
    return str;
  };

  return { lang, setLang, t };
}
