import React, { useState, useRef } from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from './supabase';
import { useLanguage, registerTranslations } from './i18n';

registerTranslations({
  en: {
    sitterOnboarding_stepOf: 'Step {step} of {total}',
    sitterOnboarding_yourCity: 'YOUR CITY',
    sitterOnboarding_averagePerMonth: 'average per month',
    sitterOnboarding_topSittersEarn: 'Top sitters earn Rs.{amount} in {city}',
    sitterOnboarding_statSetOwnSchedule: 'Set your own',
    sitterOnboarding_statSetOwnScheduleSub: 'schedule',
    sitterOnboarding_statNoLockIn: 'No lock-in',
    sitterOnboarding_statNoLockInSub: 'quit anytime',
    sitterOnboarding_statFreeToJoinSub: 'to join',
    sitterOnboarding_iWantToEarnThis: 'I want to earn this 🐾',
    sitterOnboarding_notNow: 'Not now',
    sitterOnboarding_onlineNow: 'Online now',
    sitterOnboarding_welcomeAskName: 'Hey! Welcome to Fursday. What should I call you?',
    sitterOnboarding_fullNamePlaceholder: 'Your full name...',
    sitterOnboarding_send: 'Send',
    sitterOnboarding_greatAskWhatsapp: 'Great, {name}! Your WhatsApp number?',
    sitterOnboarding_whatsappNumberPlaceholder: 'WhatsApp number',
    sitterOnboarding_invalidMobileNumber: 'Enter a valid Indian mobile number',
    sitterOnboarding_whatWillYouOffer: 'What will you offer?',
    sitterOnboarding_selectAllThatApply: 'Select all that apply',
    sitterOnboarding_estimatedMonthlyEarnings: 'Estimated monthly earnings',
    sitterOnboarding_selectServicesToSeeEarnings: 'Select services to see your earnings',
    sitterOnboarding_serviceWalkName: 'Request a walker',
    sitterOnboarding_serviceWalkSub: '30 min per walk',
    sitterOnboarding_serviceBoardingName: 'Home boarding',
    sitterOnboarding_serviceBoardingSub: 'Per night',
    sitterOnboarding_serviceDaycareName: 'Doggy daycare',
    sitterOnboarding_serviceDaycareSub: 'Per day',
    sitterOnboarding_setMyPrices: 'Set my prices',
    sitterOnboarding_selectAtLeastOneService: 'Select at least one service',
    sitterOnboarding_pricingOf: 'Pricing {idx} of {total}',
    sitterOnboarding_yourPrice: 'Your price',
    sitterOnboarding_marketAvg: 'Market avg',
    sitterOnboarding_low: 'Low',
    sitterOnboarding_avgLabel: 'Avg',
    sitterOnboarding_high: 'High',
    sitterOnboarding_monthlyEstimate: 'Monthly estimate',
    sitterOnboarding_nextService: 'Next service',
    sitterOnboarding_doneWithPricing: 'Done with pricing',
    sitterOnboarding_aboutYou: 'About you',
    sitterOnboarding_helpPetParentsTrust: 'Help pet parents trust you',
    sitterOnboarding_profilePhoto: 'Profile photo',
    sitterOnboarding_addPhoto: 'Add photo',
    sitterOnboarding_photoHint: 'A clear photo of your face increases bookings by 3x. Sitters with photos earn significantly more.',
    sitterOnboarding_bio: 'Bio',
    sitterOnboarding_bioPlaceholder: 'Tell pet parents about yourself. How long have you had pets? What do you love about animals?',
    sitterOnboarding_experienceWithPets: 'Experience with pets',
    sitterOnboarding_expLessThan1: 'Less than 1 year',
    sitterOnboarding_exp1to2: '1-2 years',
    sitterOnboarding_exp3to5: '3-5 years',
    sitterOnboarding_exp5plus: '5+ years',
    sitterOnboarding_languagesSpoken: 'Languages spoken',
    sitterOnboarding_langHindi: 'Hindi',
    sitterOnboarding_langEnglish: 'English',
    sitterOnboarding_langMarathi: 'Marathi',
    sitterOnboarding_langPunjabi: 'Punjabi',
    sitterOnboarding_langTamil: 'Tamil',
    sitterOnboarding_langTelugu: 'Telugu',
    sitterOnboarding_langKannada: 'Kannada',
    sitterOnboarding_langBengali: 'Bengali',
    sitterOnboarding_continue: 'Continue',
    sitterOnboarding_yourAvailability: 'Your availability',
    sitterOnboarding_setScheduleChangeAnytime: 'Set your schedule — change anytime',
    sitterOnboarding_availableDays: 'Available days',
    sitterOnboarding_dayMon: 'Mon',
    sitterOnboarding_dayTue: 'Tue',
    sitterOnboarding_dayWed: 'Wed',
    sitterOnboarding_dayThu: 'Thu',
    sitterOnboarding_dayFri: 'Fri',
    sitterOnboarding_daySat: 'Sat',
    sitterOnboarding_daySun: 'Sun',
    sitterOnboarding_weekdays: 'Weekdays',
    sitterOnboarding_weekends: 'Weekends',
    sitterOnboarding_allDays: 'All days',
    sitterOnboarding_availableTimeSlots: 'Available time slots',
    sitterOnboarding_slotMorning: 'Morning',
    sitterOnboarding_slotAfternoon: 'Afternoon',
    sitterOnboarding_slotEvening: 'Evening',
    sitterOnboarding_maxDogsAtOneTime: 'Max dogs at one time',
    sitterOnboarding_advanceNoticeNeeded: 'Advance notice needed',
    sitterOnboarding_noticeSameDay: 'Same day',
    sitterOnboarding_notice12hrs: '12hrs',
    sitterOnboarding_notice24hrs: '24hrs',
    sitterOnboarding_notice48hrs: '48hrs',
    sitterOnboarding_notice1Week: '1 week',
    sitterOnboarding_idVerification: 'ID Verification',
    sitterOnboarding_requiredBeforeFirstBooking: 'Required before your first booking',
    sitterOnboarding_whyWeVerifyTitle: 'Why we verify:',
    sitterOnboarding_whyWeVerifyBody: 'Aadhaar verification builds trust with pet parents and is required by our insurance provider. Your data is encrypted and never shared.',
    sitterOnboarding_aadhaarNumber: 'Aadhaar number',
    sitterOnboarding_aadhaarHint: '12-digit Aadhaar number. Verified manually within 24 hours.',
    sitterOnboarding_upiIdForPayouts: 'UPI ID for payouts',
    sitterOnboarding_upiPlaceholder: 'e.g. yourname@paytm, yourname@oksbi',
    sitterOnboarding_upiHint: 'We pay you directly to this UPI ID after each completed booking.',
    sitterOnboarding_whatHappensNext: 'What happens next',
    sitterOnboarding_verifyStep1: 'Our team verifies your Aadhaar within 24 hours',
    sitterOnboarding_verifyStep2: 'You get a Verified badge on your profile',
    sitterOnboarding_verifyStep3: 'Verified sitters get 40% more bookings',
    sitterOnboarding_yourResponsibilities: 'Your responsibilities',
    sitterOnboarding_whatFursdayExpects: 'What Fursday expects from every sitter',
    sitterOnboarding_responsibilitiesIntro: 'These apply to every booking. Pet owners have matching responsibilities shown to them.',
    sitterOnboarding_respKitLabel: 'Carry your full kit',
    sitterOnboarding_respKitDetail: 'Every walk needs fresh biodegradable bags, paw wipes, and hand sanitiser. Provided by Fursday.',
    sitterOnboarding_respTimeLabel: 'Arrive on time',
    sitterOnboarding_respTimeDetail: 'Be at the location within 10 minutes of the slot. Late by 20+ min = automatic Rs.50 discount to owner.',
    sitterOnboarding_respOtpLabel: 'Enter OTP before starting',
    sitterOnboarding_respOtpDetail: 'Owner gives you a 4-digit OTP. Enter it in the app before starting the walk. No OTP = no walk.',
    sitterOnboarding_respPottyLabel: 'Always pick up potty',
    sitterOnboarding_respPottyDetail: 'Never leave waste. Use biodegradable bags. Clean Paws Promise applies to every Fursday walk.',
    sitterOnboarding_respWipeLabel: 'Wipe paws after walk',
    sitterOnboarding_respWipeDetail: 'Clean the dog paws before re-entering the home. Use the wipe from your kit.',
    sitterOnboarding_respReportLabel: 'Submit walk report',
    sitterOnboarding_respReportDetail: 'Report must be submitted before payment is released. No report = no payment.',
    sitterOnboarding_respNoFoodLabel: 'No food, water, or medication',
    sitterOnboarding_respNoFoodDetail: 'Do not provide food, water, treats, or medication unless explicitly agreed in writing before booking.',
    sitterOnboarding_respPrivacyLabel: 'Keep owner details private',
    sitterOnboarding_respPrivacyDetail: 'Never share the owner address or contact details. Phone numbers are hidden until booking is confirmed.',
    sitterOnboarding_respNoDealsLabel: 'No off-platform deals',
    sitterOnboarding_respNoDealsDetail: 'Soliciting direct payment from owners is strictly prohibited. Account suspended immediately.',
    sitterOnboarding_respEmergencyLabel: 'Emergency button if anything goes wrong',
    sitterOnboarding_respEmergencyDetail: 'Any dog bite, injury, or incident: press emergency button in app within 2 hours. Photos mandatory.',
    sitterOnboarding_responsibilitiesFooter: 'Violating these responsibilities may result in account suspension. Fursday protects both sitters and owners fairly.',
    sitterOnboarding_acceptResponsibilities: 'I accept these responsibilities',
    sitterOnboarding_reviewAndGoLive: 'Review & go live',
    sitterOnboarding_almostThere: 'Almost there!',
    sitterOnboarding_serviceWord: 'service',
    sitterOnboarding_servicesWord: 'services',
    sitterOnboarding_acrossInCity: 'across {count} {unit} in {city}',
    sitterOnboarding_completeAfterApproval: 'Complete after approval',
    sitterOnboarding_completeStep1: 'Aadhaar verification (24hrs)',
    sitterOnboarding_completeStep2: 'Add home photos',
    sitterOnboarding_completeStep3: 'Complete pet care certification (free, 2hrs)',
    sitterOnboarding_agreeTermsPart1: "I agree to Fursday's",
    sitterOnboarding_sitterTermsOfService: 'Sitter Terms of Service',
    sitterOnboarding_agreeTermsPart2: '. I understand my prices are visible to pet parents and I can change them anytime.',
    sitterOnboarding_goLiveOnFursday: '🚀 Go live on Fursday',
    sitterOnboarding_youreLive: "You're live,",
    sitterOnboarding_profileUnderReview: 'Profile under review.',
    sitterOnboarding_whatsappWithin24h: 'We will WhatsApp you within 24 hours.',
    sitterOnboarding_yourEarningPotential: 'Your earning potential',
    sitterOnboarding_estimatedMonthlyInCity: 'estimated monthly in {city}',
    sitterOnboarding_whatsappNotification: 'WhatsApp notification',
    sitterOnboarding_phoneWhenApproved: '+91 {phone} when approved',
    sitterOnboarding_goToSitterDashboard: 'Go to Sitter Dashboard 🐾',
    sitterOnboarding_pleaseLogInFirst: 'Please log in first.',
    sitterOnboarding_photoUploadFailed: 'Photo upload failed: {error}',
    sitterOnboarding_notLoggedIn: 'Not logged in! Please log in first.',
    sitterOnboarding_cityNotFound: 'City not found: {city}. Please select Gurgaon or Pune.',
    sitterOnboarding_couldNotSaveDetails: 'Could not save your details: {error}',
    sitterOnboarding_couldNotSaveSitterProfile: 'Could not save your sitter profile: {error}',
    sitterOnboarding_couldNotSaveServices: 'Could not save your services: {error}',
    sitterOnboarding_couldNotSaveVerificationDetails: 'Could not save your verification details: {error}',
    sitterOnboarding_somethingWentWrong: 'Something went wrong, please try again.',
    sitterOnboarding_notifWelcomeTitle: 'Welcome to Fursday! 🐾',
    sitterOnboarding_notifWelcomeBody: 'You will be notified when pet parents request your services.',
  },
  hi: {
    sitterOnboarding_stepOf: 'चरण {step} / {total}',
    sitterOnboarding_yourCity: 'आपका शहर',
    sitterOnboarding_averagePerMonth: 'प्रति माह औसत',
    sitterOnboarding_topSittersEarn: '{city} में टॉप सिटर्स Rs.{amount} तक कमाते हैं',
    sitterOnboarding_statSetOwnSchedule: 'अपनी मर्ज़ी से',
    sitterOnboarding_statSetOwnScheduleSub: 'समय तय करें',
    sitterOnboarding_statNoLockIn: 'कोई बंधन नहीं',
    sitterOnboarding_statNoLockInSub: 'कभी भी छोड़ें',
    sitterOnboarding_statFreeToJoinSub: 'जॉइन करने के लिए',
    sitterOnboarding_iWantToEarnThis: 'मुझे यह कमाना है 🐾',
    sitterOnboarding_notNow: 'अभी नहीं',
    sitterOnboarding_onlineNow: 'अभी ऑनलाइन',
    sitterOnboarding_welcomeAskName: 'नमस्ते! Fursday में आपका स्वागत है। आपको किस नाम से बुलाऊं?',
    sitterOnboarding_fullNamePlaceholder: 'अपना पूरा नाम...',
    sitterOnboarding_send: 'भेजें',
    sitterOnboarding_greatAskWhatsapp: 'बढ़िया, {name}! आपका व्हाट्सएप नंबर?',
    sitterOnboarding_whatsappNumberPlaceholder: 'व्हाट्सएप नंबर',
    sitterOnboarding_invalidMobileNumber: 'एक सही भारतीय मोबाइल नंबर डालें',
    sitterOnboarding_whatWillYouOffer: 'आप क्या सेवाएं देंगे?',
    sitterOnboarding_selectAllThatApply: 'जो लागू हों वे सभी चुनें',
    sitterOnboarding_estimatedMonthlyEarnings: 'अनुमानित मासिक कमाई',
    sitterOnboarding_selectServicesToSeeEarnings: 'अपनी कमाई देखने के लिए सेवाएं चुनें',
    sitterOnboarding_serviceWalkName: 'वॉकर सेवा',
    sitterOnboarding_serviceWalkSub: 'हर सैर 30 मिनट की',
    sitterOnboarding_serviceBoardingName: 'होम बोर्डिंग',
    sitterOnboarding_serviceBoardingSub: 'प्रति रात',
    sitterOnboarding_serviceDaycareName: 'डॉगी डेकेयर',
    sitterOnboarding_serviceDaycareSub: 'प्रति दिन',
    sitterOnboarding_setMyPrices: 'अपनी कीमतें तय करें',
    sitterOnboarding_selectAtLeastOneService: 'कम से कम एक सेवा चुनें',
    sitterOnboarding_pricingOf: 'कीमत {idx} / {total}',
    sitterOnboarding_yourPrice: 'आपकी कीमत',
    sitterOnboarding_marketAvg: 'बाज़ार औसत',
    sitterOnboarding_low: 'कम',
    sitterOnboarding_avgLabel: 'औसत',
    sitterOnboarding_high: 'अधिक',
    sitterOnboarding_monthlyEstimate: 'मासिक अनुमान',
    sitterOnboarding_nextService: 'अगली सेवा',
    sitterOnboarding_doneWithPricing: 'कीमत तय करना पूरा हुआ',
    sitterOnboarding_aboutYou: 'आपके बारे में',
    sitterOnboarding_helpPetParentsTrust: 'पालतू पशु मालिकों का भरोसा जीतें',
    sitterOnboarding_profilePhoto: 'प्रोफ़ाइल फोटो',
    sitterOnboarding_addPhoto: 'फोटो जोड़ें',
    sitterOnboarding_photoHint: 'आपके चेहरे की स्पष्ट फोटो से बुकिंग 3 गुना बढ़ जाती है। फोटो वाले सिटर्स काफी ज्यादा कमाते हैं।',
    sitterOnboarding_bio: 'बायो',
    sitterOnboarding_bioPlaceholder: 'पालतू पशु मालिकों को अपने बारे में बताएं। आपके पास कितने समय से पालतू जानवर हैं? आपको जानवरों के बारे में क्या पसंद है?',
    sitterOnboarding_experienceWithPets: 'पालतू जानवरों के साथ अनुभव',
    sitterOnboarding_expLessThan1: '1 साल से कम',
    sitterOnboarding_exp1to2: '1-2 साल',
    sitterOnboarding_exp3to5: '3-5 साल',
    sitterOnboarding_exp5plus: '5+ साल',
    sitterOnboarding_languagesSpoken: 'बोली जाने वाली भाषाएं',
    sitterOnboarding_langHindi: 'हिन्दी',
    sitterOnboarding_langEnglish: 'अंग्रेज़ी',
    sitterOnboarding_langMarathi: 'मराठी',
    sitterOnboarding_langPunjabi: 'पंजाबी',
    sitterOnboarding_langTamil: 'तमिल',
    sitterOnboarding_langTelugu: 'तेलुगु',
    sitterOnboarding_langKannada: 'कन्नड़',
    sitterOnboarding_langBengali: 'बंगाली',
    sitterOnboarding_continue: 'जारी रखें',
    sitterOnboarding_yourAvailability: 'आपकी उपलब्धता',
    sitterOnboarding_setScheduleChangeAnytime: 'अपना शेड्यूल तय करें — कभी भी बदलें',
    sitterOnboarding_availableDays: 'उपलब्ध दिन',
    sitterOnboarding_dayMon: 'सोम',
    sitterOnboarding_dayTue: 'मंगल',
    sitterOnboarding_dayWed: 'बुध',
    sitterOnboarding_dayThu: 'गुरु',
    sitterOnboarding_dayFri: 'शुक्र',
    sitterOnboarding_daySat: 'शनि',
    sitterOnboarding_daySun: 'रवि',
    sitterOnboarding_weekdays: 'सप्ताह के दिन',
    sitterOnboarding_weekends: 'सप्ताहांत',
    sitterOnboarding_allDays: 'सभी दिन',
    sitterOnboarding_availableTimeSlots: 'उपलब्ध समय स्लॉट',
    sitterOnboarding_slotMorning: 'सुबह',
    sitterOnboarding_slotAfternoon: 'दोपहर',
    sitterOnboarding_slotEvening: 'शाम',
    sitterOnboarding_maxDogsAtOneTime: 'एक समय में अधिकतम कुत्ते',
    sitterOnboarding_advanceNoticeNeeded: 'कितनी पहले से सूचना चाहिए',
    sitterOnboarding_noticeSameDay: 'उसी दिन',
    sitterOnboarding_notice12hrs: '12 घंटे',
    sitterOnboarding_notice24hrs: '24 घंटे',
    sitterOnboarding_notice48hrs: '48 घंटे',
    sitterOnboarding_notice1Week: '1 सप्ताह',
    sitterOnboarding_idVerification: 'पहचान सत्यापन',
    sitterOnboarding_requiredBeforeFirstBooking: 'आपकी पहली बुकिंग से पहले ज़रूरी है',
    sitterOnboarding_whyWeVerifyTitle: 'हम सत्यापन क्यों करते हैं:',
    sitterOnboarding_whyWeVerifyBody: 'आधार सत्यापन पालतू पशु मालिकों के साथ भरोसा बनाता है और हमारी बीमा कंपनी के लिए ज़रूरी है। आपका डेटा एन्क्रिप्टेड रहता है और कभी शेयर नहीं किया जाता।',
    sitterOnboarding_aadhaarNumber: 'आधार नंबर',
    sitterOnboarding_aadhaarHint: '12 अंकों का आधार नंबर। 24 घंटे के भीतर मैन्युअल रूप से सत्यापित किया जाएगा।',
    sitterOnboarding_upiIdForPayouts: 'भुगतान के लिए UPI आईडी',
    sitterOnboarding_upiPlaceholder: 'जैसे yourname@paytm, yourname@oksbi',
    sitterOnboarding_upiHint: 'हर पूरी हुई बुकिंग के बाद हम सीधे इस UPI आईडी पर भुगतान करते हैं।',
    sitterOnboarding_whatHappensNext: 'आगे क्या होगा',
    sitterOnboarding_verifyStep1: 'हमारी टीम 24 घंटे के भीतर आपका आधार सत्यापित करेगी',
    sitterOnboarding_verifyStep2: 'आपकी प्रोफ़ाइल पर वेरीफाइड बैज मिलेगा',
    sitterOnboarding_verifyStep3: 'वेरीफाइड सिटर्स को 40% ज्यादा बुकिंग मिलती हैं',
    sitterOnboarding_yourResponsibilities: 'आपकी ज़िम्मेदारियां',
    sitterOnboarding_whatFursdayExpects: 'Fursday हर सिटर से क्या उम्मीद करता है',
    sitterOnboarding_responsibilitiesIntro: 'ये सभी बुकिंग पर लागू होती हैं। पालतू पशु मालिकों को भी उनकी जिम्मेदारियां दिखाई जाती हैं।',
    sitterOnboarding_respKitLabel: 'अपनी पूरी किट साथ रखें',
    sitterOnboarding_respKitDetail: 'हर सैर के लिए ताज़े बायोडिग्रेडेबल बैग, पंजा वाइप्स और हैंड सैनिटाइज़र चाहिए। यह Fursday द्वारा दिया जाता है।',
    sitterOnboarding_respTimeLabel: 'समय पर पहुंचें',
    sitterOnboarding_respTimeDetail: 'तय समय के 10 मिनट के भीतर जगह पर पहुंचें। 20+ मिनट देर होने पर मालिक को अपने आप Rs.50 की छूट मिलेगी।',
    sitterOnboarding_respOtpLabel: 'शुरू करने से पहले OTP डालें',
    sitterOnboarding_respOtpDetail: 'मालिक आपको 4 अंकों का OTP देगा। सैर शुरू करने से पहले इसे ऐप में डालें। बिना OTP के सैर शुरू नहीं होगी।',
    sitterOnboarding_respPottyLabel: 'हमेशा गंदगी साफ करें',
    sitterOnboarding_respPottyDetail: 'कभी भी गंदगी न छोड़ें। बायोडिग्रेडेबल बैग का उपयोग करें। हर Fursday सैर पर क्लीन पॉज़ प्रॉमिस लागू होता है।',
    sitterOnboarding_respWipeLabel: 'सैर के बाद पंजे साफ करें',
    sitterOnboarding_respWipeDetail: 'घर में दोबारा प्रवेश करने से पहले कुत्ते के पंजे साफ करें। अपनी किट के वाइप का उपयोग करें।',
    sitterOnboarding_respReportLabel: 'सैर की रिपोर्ट जमा करें',
    sitterOnboarding_respReportDetail: 'भुगतान जारी होने से पहले रिपोर्ट जमा करनी होगी। बिना रिपोर्ट के भुगतान नहीं होगा।',
    sitterOnboarding_respNoFoodLabel: 'खाना, पानी या दवा न दें',
    sitterOnboarding_respNoFoodDetail: 'बुकिंग से पहले लिखित रूप में सहमति के बिना खाना, पानी, ट्रीट या दवा न दें।',
    sitterOnboarding_respPrivacyLabel: 'मालिक की जानकारी गुप्त रखें',
    sitterOnboarding_respPrivacyDetail: 'मालिक का पता या संपर्क जानकारी कभी शेयर न करें। बुकिंग कन्फर्म होने तक फोन नंबर छिपे रहते हैं।',
    sitterOnboarding_respNoDealsLabel: 'प्लेटफॉर्म के बाहर कोई डील नहीं',
    sitterOnboarding_respNoDealsDetail: 'मालिकों से सीधे भुगतान मांगना पूरी तरह प्रतिबंधित है। ऐसा करने पर खाता तुरंत सस्पेंड कर दिया जाएगा।',
    sitterOnboarding_respEmergencyLabel: 'कुछ भी गलत होने पर इमरजेंसी बटन दबाएं',
    sitterOnboarding_respEmergencyDetail: 'किसी भी कुत्ते के काटने, चोट या घटना पर: 2 घंटे के भीतर ऐप में इमरजेंसी बटन दबाएं। फोटो देना अनिवार्य है।',
    sitterOnboarding_responsibilitiesFooter: 'इन जिम्मेदारियों का उल्लंघन करने पर खाता सस्पेंड हो सकता है। Fursday सिटर्स और मालिकों दोनों के साथ निष्पक्ष व्यवहार करता है।',
    sitterOnboarding_acceptResponsibilities: 'मुझे ये जिम्मेदारियां स्वीकार हैं',
    sitterOnboarding_reviewAndGoLive: 'समीक्षा करें और लाइव हों',
    sitterOnboarding_almostThere: 'बस थोड़ा और!',
    sitterOnboarding_serviceWord: 'सेवा',
    sitterOnboarding_servicesWord: 'सेवाएं',
    sitterOnboarding_acrossInCity: '{city} में {count} {unit} के साथ',
    sitterOnboarding_completeAfterApproval: 'स्वीकृति के बाद पूरा करें',
    sitterOnboarding_completeStep1: 'आधार सत्यापन (24 घंटे)',
    sitterOnboarding_completeStep2: 'घर की फोटो जोड़ें',
    sitterOnboarding_completeStep3: 'पालतू देखभाल सर्टिफिकेशन पूरा करें (मुफ्त, 2 घंटे)',
    sitterOnboarding_agreeTermsPart1: 'मैं Fursday की',
    sitterOnboarding_sitterTermsOfService: 'सिटर सेवा शर्तों',
    sitterOnboarding_agreeTermsPart2: ' से सहमत हूं। मुझे पता है कि मेरी कीमतें पालतू पशु मालिकों को दिखती हैं और उन्हें कभी भी बदला जा सकता है।',
    sitterOnboarding_goLiveOnFursday: '🚀 Fursday पर लाइव हों',
    sitterOnboarding_youreLive: 'आप लाइव हैं,',
    sitterOnboarding_profileUnderReview: 'प्रोफ़ाइल की समीक्षा हो रही है।',
    sitterOnboarding_whatsappWithin24h: 'हम 24 घंटे के भीतर आपको व्हाट्सएप करेंगे।',
    sitterOnboarding_yourEarningPotential: 'आपकी कमाई की संभावना',
    sitterOnboarding_estimatedMonthlyInCity: '{city} में अनुमानित मासिक',
    sitterOnboarding_whatsappNotification: 'व्हाट्सएप सूचना',
    sitterOnboarding_phoneWhenApproved: 'स्वीकृति मिलने पर +91 {phone}',
    sitterOnboarding_goToSitterDashboard: 'सिटर डैशबोर्ड पर जाएं 🐾',
    sitterOnboarding_pleaseLogInFirst: 'कृपया पहले लॉग इन करें।',
    sitterOnboarding_photoUploadFailed: 'फोटो अपलोड नहीं हो सकी: {error}',
    sitterOnboarding_notLoggedIn: 'लॉग इन नहीं है! कृपया पहले लॉग इन करें।',
    sitterOnboarding_cityNotFound: 'शहर नहीं मिला: {city}। कृपया Gurgaon या Pune चुनें।',
    sitterOnboarding_couldNotSaveDetails: 'आपकी जानकारी सेव नहीं हो सकी: {error}',
    sitterOnboarding_couldNotSaveSitterProfile: 'आपकी सिटर प्रोफ़ाइल सेव नहीं हो सकी: {error}',
    sitterOnboarding_couldNotSaveServices: 'आपकी सेवाएं सेव नहीं हो सकीं: {error}',
    sitterOnboarding_couldNotSaveVerificationDetails: 'आपकी सत्यापन जानकारी सेव नहीं हो सकी: {error}',
    sitterOnboarding_somethingWentWrong: 'कुछ गलत हो गया, कृपया फिर से कोशिश करें।',
    sitterOnboarding_notifWelcomeTitle: 'Fursday में आपका स्वागत है! 🐾',
    sitterOnboarding_notifWelcomeBody: 'जब पालतू पशु मालिक आपकी सेवाएं मांगेंगे, तो आपको सूचना मिलेगी।',
  },
});

const compressImage = (file, maxPx = 1200) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxPx) { h = h * maxPx / w; w = maxPx; }
      if (h > maxPx) { w = w * maxPx / h; h = maxPx; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.8);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

const ORANGE = '#FF6B35';
const ORANGE_LIGHT = '#FFF0EB';
const DARK = '#0f0f1a';
const DARK2 = '#1a1a2e';

const CITY_DATA = {
  Gurgaon: { avg: 22000, top: 45000 },
  Pune: { avg: 19000, top: 40000 },
};

const SERVICES = [
  { id: 'walk30', name: 'Request a walker', sub: '30 min per walk', icon: '🦮', avg: 320, default: 299, min: 149, max: 599, bookings: 20, nameKey: 'sitterOnboarding_serviceWalkName', subKey: 'sitterOnboarding_serviceWalkSub' },
  { id: 'boarding', name: 'Home boarding', sub: 'Per night', icon: '🏠', avg: 899, default: 799, min: 499, max: 1999, bookings: 4, nameKey: 'sitterOnboarding_serviceBoardingName', subKey: 'sitterOnboarding_serviceBoardingSub' },
  { id: 'daycare', name: 'Doggy daycare', sub: 'Per day', icon: '☀️', avg: 699, default: 599, min: 399, max: 1299, bookings: 8, nameKey: 'sitterOnboarding_serviceDaycareName', subKey: 'sitterOnboarding_serviceDaycareSub' },
];

const EXPERIENCE_OPTIONS = ['Less than 1 year', '1-2 years', '3-5 years', '5+ years'];
const EXPERIENCE_KEYS = {
  'Less than 1 year': 'sitterOnboarding_expLessThan1',
  '1-2 years': 'sitterOnboarding_exp1to2',
  '3-5 years': 'sitterOnboarding_exp3to5',
  '5+ years': 'sitterOnboarding_exp5plus',
};

const LANGUAGES = ['Hindi', 'English', 'Marathi', 'Punjabi', 'Tamil', 'Telugu', 'Kannada', 'Bengali'];
const LANGUAGE_KEYS = {
  Hindi: 'sitterOnboarding_langHindi',
  English: 'sitterOnboarding_langEnglish',
  Marathi: 'sitterOnboarding_langMarathi',
  Punjabi: 'sitterOnboarding_langPunjabi',
  Tamil: 'sitterOnboarding_langTamil',
  Telugu: 'sitterOnboarding_langTelugu',
  Kannada: 'sitterOnboarding_langKannada',
  Bengali: 'sitterOnboarding_langBengali',
};

const DAY_KEYS = {
  Mon: 'sitterOnboarding_dayMon', Tue: 'sitterOnboarding_dayTue', Wed: 'sitterOnboarding_dayWed',
  Thu: 'sitterOnboarding_dayThu', Fri: 'sitterOnboarding_dayFri', Sat: 'sitterOnboarding_daySat', Sun: 'sitterOnboarding_daySun',
};

const ADVANCE_NOTICE_KEYS = {
  'Same day': 'sitterOnboarding_noticeSameDay', '12hrs': 'sitterOnboarding_notice12hrs',
  '24hrs': 'sitterOnboarding_notice24hrs', '48hrs': 'sitterOnboarding_notice48hrs', '1 week': 'sitterOnboarding_notice1Week',
};

const RESPONSIBILITIES = [
  { emoji: '🦺', labelKey: 'sitterOnboarding_respKitLabel', detailKey: 'sitterOnboarding_respKitDetail', required: true },
  { emoji: '⏰', labelKey: 'sitterOnboarding_respTimeLabel', detailKey: 'sitterOnboarding_respTimeDetail', required: true },
  { emoji: '📱', labelKey: 'sitterOnboarding_respOtpLabel', detailKey: 'sitterOnboarding_respOtpDetail', required: true },
  { emoji: '🧹', labelKey: 'sitterOnboarding_respPottyLabel', detailKey: 'sitterOnboarding_respPottyDetail', required: true },
  { emoji: '🐾', labelKey: 'sitterOnboarding_respWipeLabel', detailKey: 'sitterOnboarding_respWipeDetail', required: true },
  { emoji: '📋', labelKey: 'sitterOnboarding_respReportLabel', detailKey: 'sitterOnboarding_respReportDetail', required: true },
  { emoji: '🚫', labelKey: 'sitterOnboarding_respNoFoodLabel', detailKey: 'sitterOnboarding_respNoFoodDetail', required: false },
  { emoji: '🔒', labelKey: 'sitterOnboarding_respPrivacyLabel', detailKey: 'sitterOnboarding_respPrivacyDetail', required: true },
  { emoji: '💰', labelKey: 'sitterOnboarding_respNoDealsLabel', detailKey: 'sitterOnboarding_respNoDealsDetail', required: true },
  { emoji: '🆘', labelKey: 'sitterOnboarding_respEmergencyLabel', detailKey: 'sitterOnboarding_respEmergencyDetail', required: true },
];

const VERIFY_STEP_KEYS = ['sitterOnboarding_verifyStep1', 'sitterOnboarding_verifyStep2', 'sitterOnboarding_verifyStep3'];
const COMPLETE_STEP_KEYS = ['sitterOnboarding_completeStep1', 'sitterOnboarding_completeStep2', 'sitterOnboarding_completeStep3'];

const TOTAL_STEPS = 8;

export default function SitterOnboarding({ onDone, city }) {
  const { t: tr } = useLanguage();
  const [screen, setScreen] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [chatStep, setChatStep] = useState(0);
  const [services, setServices] = useState([]);
  const [prices, setPrices] = useState(Object.fromEntries(SERVICES.map(s => [s.id, s.default])));
  const [pricingIdx, setPricingIdx] = useState(0);
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [languages, setLanguages] = useState(['Hindi', 'English']);
  const [aadhaar, setAadhaar] = useState('');
  const [upiId, setUpiId] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [availableDays, setAvailableDays] = useState(['Mon','Tue','Wed','Thu','Fri']);
  const [morningSlot, setMorningSlot] = useState(true);
  const [eveningSlot, setEveningSlot] = useState(true);
  const [afternoonSlot, setAfternoonSlot] = useState(false);
  const [maxDogs, setMaxDogs] = useState('1');
  const [advanceNotice, setAdvanceNotice] = useState('24hrs');
  const [saving, setSaving] = useState(false);
  const [sitterLat, setSitterLat] = useState(null);
  const [sitterLng, setSitterLng] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [draftSitterId, setDraftSitterId] = useState(null);
  const [restoringDraft, setRestoringDraft] = useState(true);
  const photoInputRef = useRef(null);

  // Resume-in-progress onboarding: a closed tab/app used to lose the whole
  // flow (nothing persisted until the final "Go live" submit). Now every
  // step upserts a `status: 'draft'` row, and on mount we restore from it.
  React.useEffect(() => {
    const restore = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setRestoringDraft(false); return; }
        const { data: draft } = await supabase.from('sitter_profiles').select('*').eq('user_id', user.id).eq('status', 'draft').single();
        if (draft) {
          setDraftSitterId(draft.id);
          if (draft.bio) setBio(draft.bio);
          if (draft.experience_text) setExperience(draft.experience_text);
          if (draft.languages?.length) setLanguages(draft.languages);
          if (draft.availability_days?.length) setAvailableDays(draft.availability_days);
          if (draft.morning_slot != null) setMorningSlot(draft.morning_slot);
          if (draft.afternoon_slot != null) setAfternoonSlot(draft.afternoon_slot);
          if (draft.evening_slot != null) setEveningSlot(draft.evening_slot);
          if (draft.max_dogs) setMaxDogs(String(draft.max_dogs));
          if (draft.advance_notice) setAdvanceNotice(draft.advance_notice);
          if (draft.profile_photo_url) setPhotoUrl(draft.profile_photo_url);
          if (draft.upi_id) setUpiId(draft.upi_id);

          const { data: userRow } = await supabase.from('users').select('name').eq('id', user.id).single();
          if (userRow?.name && userRow.name.toLowerCase() !== user.email?.toLowerCase()) setName(userRow.name);
          const { data: contact } = await supabase.rpc('get_user_contact', { target_id: user.id });
          if (contact?.[0]?.phone) setPhone(contact[0].phone.replace(/^\+?91/, ''));

          const { data: svcRows } = await supabase.from('sitter_services').select('service_type, price_paise').eq('sitter_id', draft.id);
          if (svcRows?.length) {
            setServices(svcRows.map(r => r.service_type));
            setPrices(prev => { const next = { ...prev }; svcRows.forEach(r => { next[r.service_type] = Math.round(r.price_paise / 100); }); return next; });
          }

          const { data: pii } = await supabase.from('sitter_pii').select('aadhaar_number').eq('sitter_id', draft.id).single();
          if (pii?.aadhaar_number) setAadhaar(pii.aadhaar_number);

          setScreen(Math.max(draft.onboarding_step || 1, 1));
        }
      } catch (e) { /* no draft yet — fresh start */ }
      setRestoringDraft(false);
    };
    restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Upserts the sitter_profiles draft row with whatever's known so far, so
  // closing mid-flow never loses progress. Returns the draft row's id.
  const saveDraft = async (step, extra = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: cityRow } = await supabase.from('cities').select('id').eq('name', city).single();
      const { data: draft, error } = await supabase.from('sitter_profiles').upsert({
        user_id: user.id, city_id: cityRow?.id, status: 'draft', onboarding_step: step,
        bio, experience_years: parseInt(experience) || 0, experience_text: experience || null,
        languages, availability_days: availableDays, morning_slot: morningSlot,
        afternoon_slot: afternoonSlot, evening_slot: eveningSlot, max_dogs: parseInt(maxDogs) || 1,
        advance_notice: advanceNotice, profile_photo_url: photoUrl, upi_id: upiId || null,
        ...extra,
      }, { onConflict: 'user_id' }).select().single();
      if (error) { console.log('Draft save error:', error.message); return draftSitterId; }
      setDraftSitterId(draft.id);
      return draft.id;
    } catch (e) { return draftSitterId; }
  };

  const saveDraftServices = async (sitterId) => {
    if (!sitterId) return;
    const activeNow = SERVICES.filter(s => services.includes(s.id));
    await supabase.from('sitter_services').delete().eq('sitter_id', sitterId);
    if (activeNow.length) {
      await supabase.from('sitter_services').insert(activeNow.map(s => ({ sitter_id: sitterId, service_type: s.id, price_paise: prices[s.id] * 100, is_active: true })));
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert(tr('sitterOnboarding_pleaseLogInFirst')); setUploadingPhoto(false); return; }
      const compressed = await compressImage(file);
      const path = `onboarding-${user.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('sitter-photos').upload(path, compressed);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('sitter-photos').getPublicUrl(path);
      setPhotoUrl(publicUrl);
    } catch (err) {
      alert(tr('sitterOnboarding_photoUploadFailed', { error: err.message || err }));
    }
    setUploadingPhoto(false);
  };

  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { setSitterLat(pos.coords.latitude); setSitterLng(pos.coords.longitude); },
        () => {}
      );
    }
  }, []);

  const cityInfo = CITY_DATA[city];
  const activeServices = SERVICES.filter(s => services.includes(s.id));
  const estimated = activeServices.reduce((sum, s) => sum + prices[s.id] * s.bookings, 0);
  const pricingService = activeServices[pricingIdx];

  const toggleService = id => setServices(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const toggleLang = lang => setLanguages(prev =>
    prev.includes(lang) ? prev.filter(x => x !== lang) : [...prev, lang]
  );

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(tr('sitterOnboarding_notifWelcomeTitle'), {
          body: tr('sitterOnboarding_notifWelcomeBody'),
          icon: '/favicon.ico',
        });
      }
    }
  };

  const handleGoLive = async () => {
    setSaving(true);
    await requestNotificationPermission();
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) { alert(tr('sitterOnboarding_notLoggedIn')); setSaving(false); return; }
      const { data: cityRow } = await supabase.from('cities').select('id').eq('name', city).single();
      if (!cityRow) {
        alert(tr('sitterOnboarding_cityNotFound', { city }));
        setSaving(false);
        return;
      }

      const { error: userError } = await supabase.from('users').upsert(
        { id: currentUser.id, name, phone: '+91' + phone, city_id: cityRow.id }
      );
      if (userError) { alert(tr('sitterOnboarding_couldNotSaveDetails', { error: userError.message })); setSaving(false); return; }

      const { data: sitter, error: sitterError } = await supabase.from('sitter_profiles').upsert({
        user_id: currentUser.id, city_id: cityRow.id,
        bio, experience_years: parseInt(experience) || 0,
        experience_text: experience || null,
        languages, status: 'pending',
        availability_days: availableDays,
        morning_slot: morningSlot,
        afternoon_slot: afternoonSlot,
        evening_slot: eveningSlot,
        max_dogs: parseInt(maxDogs) || 1,
        advance_notice: advanceNotice,
        profile_photo_url: photoUrl,
      }, { onConflict: 'user_id' }).select().single();
      if (sitterError) { alert(tr('sitterOnboarding_couldNotSaveSitterProfile', { error: sitterError.message })); setSaving(false); return; }

      // Replace any previous services (re-running onboarding shouldn't duplicate rows)
      await supabase.from('sitter_services').delete().eq('sitter_id', sitter.id);
      const rows = activeServices.map(s => ({
        sitter_id: sitter.id, service_type: s.id,
        price_paise: prices[s.id] * 100, is_active: true,
      }));
      const { error: servicesError } = await supabase.from('sitter_services').insert(rows);
      if (servicesError) { alert(tr('sitterOnboarding_couldNotSaveServices', { error: servicesError.message })); setSaving(false); return; }

      if (aadhaar || upiId) {
        const { error: piiError } = await supabase.from('sitter_pii').upsert({
          sitter_id: sitter.id,
          aadhaar_number: aadhaar || null,
          upi_id: upiId || null,
        }, { onConflict: 'sitter_id' });
        if (piiError) { alert(tr('sitterOnboarding_couldNotSaveVerificationDetails', { error: piiError.message })); setSaving(false); return; }
      }
    } catch(e) {
      alert(tr('sitterOnboarding_somethingWentWrong'));
      setSaving(false);
      return;
    }
    setSaving(false);
    setScreen(9);
  };

  const wrap = (children, dark) => (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: dark ? DARK : '#F8F8F8', fontFamily: '-apple-system,sans-serif', paddingBottom: 100 }}>
      {children}
    </div>
  );

  const BackBtn = ({ to, dark }) => (
    <button onClick={() => setScreen(to)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: dark ? 'rgba(255,255,255,0.5)' : '#888', fontSize: 13, padding: '56px 24px 0', marginBottom: 24 }}>
      <ArrowLeft size={16} /> {tr('common_back')}
    </button>
  );

  const ProgressBar = ({ step, dark }) => (
    <div style={{ padding: '0 24px', marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.4)' : '#AAA', marginBottom: 6 }}>{tr('sitterOnboarding_stepOf', { step, total: TOTAL_STEPS })}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < step ? ORANGE : (dark ? 'rgba(255,255,255,0.1)' : '#E8E8E8') }} />
        ))}
      </div>
    </div>
  );

  const BottomBtn = ({ label, onClick, disabled, dark }) => (
    <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, padding: '12px 24px calc(28px + env(safe-area-inset-bottom))', background: dark ? DARK : 'white', borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#F0F0F0'}` }}>
      <button onClick={onClick} disabled={disabled}
        style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: disabled ? '#E0E0E0' : ORANGE, color: disabled ? '#AAA' : 'white', fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {label}
      </button>
    </div>
  );

  if (restoringDraft) return wrap(
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{tr('common_loading')}</div>
    </div>
  , true);

  // SCREEN 0 — City + earnings
  if (screen === 0) return wrap(
    <div style={{ padding: '0 24px 40px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ paddingTop: 56, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🐾</div>
        <span style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>Fursday</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{tr('sitterOnboarding_yourCity')}</div>
        <div style={{ width: '100%', padding: '14px 16px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 16, fontWeight: 600, marginBottom: 28 }}>
          {city === 'Pune' ? '🌴' : '🏙️'} {city || 'Gurgaon'}
        </div>
        <div style={{ fontSize: 52, fontWeight: 900, color: ORANGE, lineHeight: 1, marginBottom: 4 }}>Rs.{cityInfo.avg.toLocaleString('en-IN')}</div>
        <div style={{ fontSize: 16, color: 'white', fontWeight: 600, marginBottom: 6 }}>{tr('sitterOnboarding_averagePerMonth')}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>{tr('sitterOnboarding_topSittersEarn', { amount: cityInfo.top.toLocaleString('en-IN'), city })}</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          {[
            { v: tr('sitterOnboarding_statSetOwnSchedule'), s: tr('sitterOnboarding_statSetOwnScheduleSub') },
            { v: tr('sitterOnboarding_statNoLockIn'), s: tr('sitterOnboarding_statNoLockInSub') },
            { v: 'Rs.0', s: tr('sitterOnboarding_statFreeToJoinSub') },
          ].map((x,i) => (
            <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{x.v}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{x.s}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setScreen(1)}
          style={{ width: '100%', padding: '18px 0', borderRadius: 18, border: 'none', background: ORANGE, color: 'white', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
          {tr('sitterOnboarding_iWantToEarnThis')}
        </button>
        <button onClick={onDone}
          style={{ width: '100%', marginTop: 12, padding: '12px 0', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer' }}>
          {tr('sitterOnboarding_notNow')}
        </button>
      </div>
    </div>
  , true);

  // SCREEN 1 — Name + WhatsApp chat
  if (screen === 1) return wrap(
    <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <BackBtn to={0} dark={true} />
      <ProgressBar step={1} dark={true} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <div style={{ width: 40, height: 40, borderRadius: 14, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🐾</div>
        <div>
          <div style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>Fursday</div>
          <div style={{ color: '#2ECC71', fontSize: 11 }}>{tr('sitterOnboarding_onlineNow')}</div>
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🐾</div>
          <div style={{ background: DARK2, borderRadius: '18px 18px 18px 4px', padding: '12px 16px' }}>
            <div style={{ color: 'white', fontSize: 14, lineHeight: 1.5 }}>{tr('sitterOnboarding_welcomeAskName')}</div>
          </div>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={tr('sitterOnboarding_fullNamePlaceholder')}
          style={{ width: '100%', padding: '14px 16px', borderRadius: 16, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', fontSize: 15, color: 'white', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
        {name.length > 1 && chatStep === 0 && (
          <div style={{ textAlign: 'right', marginBottom: 16 }}>
            <button onClick={() => setChatStep(1)} style={{ padding: '8px 20px', borderRadius: 20, border: 'none', background: ORANGE, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{tr('sitterOnboarding_send')}</button>
          </div>
        )}
        {chatStep >= 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <div style={{ background: ORANGE, borderRadius: '18px 18px 4px 18px', padding: '10px 16px' }}>
                <div style={{ color: 'white', fontSize: 14 }}>{name}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🐾</div>
              <div style={{ background: DARK2, borderRadius: '18px 18px 18px 4px', padding: '12px 16px' }}>
                <div style={{ color: 'white', fontSize: 14 }}>{tr('sitterOnboarding_greatAskWhatsapp', { name })}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ padding: '14px 12px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>+91</div>
              <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder={tr('sitterOnboarding_whatsappNumberPlaceholder')}
                style={{ flex: 1, padding: '14px 16px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', fontSize: 15, color: 'white', outline: 'none' }} />
            </div>
            {phone.length === 10 && !/^[6-9]\d{9}$/.test(phone) && (
              <div style={{ fontSize: 12, color: '#FF6B35', marginBottom: 8 }}>{tr('sitterOnboarding_invalidMobileNumber')}</div>
            )}
            {phone.length === 10 && /^[6-9]\d{9}$/.test(phone) && (
              <div style={{ textAlign: 'right', marginBottom: 16 }}>
                <button onClick={async () => { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('users').upsert({ id: user.id, name, phone: '+91' + phone }); await saveDraft(2); setScreen(2); }} style={{ padding: '8px 20px', borderRadius: 20, border: 'none', background: ORANGE, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{tr('common_next')}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  , true);

  // SCREEN 2 — Services
  if (screen === 2) return wrap(
    <div style={{ padding: '0 24px 100px', minHeight: '100vh' }}>
      <BackBtn to={1} dark={true} />
      <ProgressBar step={2} dark={true} />
      <div style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 4, paddingTop: 0 }}>{tr('sitterOnboarding_whatWillYouOffer')}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>{tr('sitterOnboarding_selectAllThatApply')}</div>
      <div style={{ background: DARK2, borderRadius: 20, padding: '16px 20px', marginBottom: 20, border: '1px solid rgba(255,107,53,0.3)' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{tr('sitterOnboarding_estimatedMonthlyEarnings')}</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: services.length > 0 ? ORANGE : 'rgba(255,255,255,0.2)' }}>
          Rs.{estimated.toLocaleString('en-IN')}
        </div>
        {services.length === 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{tr('sitterOnboarding_selectServicesToSeeEarnings')}</div>}
      </div>
      {SERVICES.map(s => {
        const sel = services.includes(s.id);
        return (
          <div key={s.id} onClick={() => toggleService(s.id)}
            style={{ background: sel ? 'rgba(255,107,53,0.12)' : DARK2, borderRadius: 16, padding: '14px 16px', marginBottom: 10, border: sel ? '1.5px solid ' + ORANGE : '1.5px solid rgba(255,255,255,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{tr(s.nameKey)}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{tr(s.subKey)} · avg Rs.{s.avg}</div>
            </div>
            {sel
              ? <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ORANGE }}>+Rs.{(prices[s.id] * s.bookings).toLocaleString('en-IN')}/mo</div>
                  <CheckCircle size={16} color={ORANGE} style={{ marginTop: 2 }} />
                </div>
              : <div style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 20 }}>+</div>
            }
          </div>
        );
      })}
      <BottomBtn label={services.length > 0 ? tr('sitterOnboarding_setMyPrices') : tr('sitterOnboarding_selectAtLeastOneService')} onClick={async () => { if(services.length > 0){ const id = await saveDraft(3); await saveDraftServices(id); setPricingIdx(0); setScreen(3); } }} disabled={services.length === 0} dark={true} />
    </div>
  , true);

  // SCREEN 3 — Pricing
  if (screen === 3) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={2} dark={false} />
      <ProgressBar step={3} dark={false} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 13, color: '#888' }}>{tr('sitterOnboarding_pricingOf', { idx: pricingIdx + 1, total: activeServices.length })}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {activeServices.map((_, i) => (
            <div key={i} style={{ width: i === pricingIdx ? 20 : 8, height: 6, borderRadius: 3, background: i <= pricingIdx ? ORANGE : '#E0E0E0' }} />
          ))}
        </div>
      </div>
      {pricingService && (
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 2 }}>{pricingService.icon} {tr(pricingService.nameKey)}</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{tr(pricingService.subKey)}</div>
          <div style={{ background: 'white', borderRadius: 20, padding: 20, marginBottom: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: '#888' }}>{tr('sitterOnboarding_yourPrice')}</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: ORANGE }}>Rs.{prices[pricingService.id]}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#AAA' }}>{tr('sitterOnboarding_marketAvg')}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Rs.{pricingService.avg}</div>
              </div>
            </div>
            <input type="range" min={pricingService.min} max={pricingService.max} step={50} value={prices[pricingService.id]}
              onChange={e => setPrices(prev => ({ ...prev, [pricingService.id]: parseInt(e.target.value) }))}
              style={{ width: '100%', marginBottom: 14, accentColor: ORANGE }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[{l:tr('sitterOnboarding_low'),v:pricingService.min},{l:tr('sitterOnboarding_avgLabel'),v:pricingService.avg},{l:tr('sitterOnboarding_high'),v:pricingService.max}].map(btn => (
                <button key={btn.v} onClick={() => setPrices(prev => ({ ...prev, [pricingService.id]: btn.v }))}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: prices[pricingService.id] === btn.v ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: prices[pricingService.id] === btn.v ? ORANGE_LIGHT : 'white', color: prices[pricingService.id] === btn.v ? ORANGE : '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {btn.l}
                </button>
              ))}
            </div>
            <div style={{ background: ORANGE_LIGHT, borderRadius: 12, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: '#888' }}>{tr('sitterOnboarding_monthlyEstimate')}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: ORANGE }}>Rs.{(prices[pricingService.id] * pricingService.bookings).toLocaleString('en-IN')}/mo</div>
            </div>
          </div>
        </div>
      )}
      <BottomBtn label={pricingIdx < activeServices.length - 1 ? tr('sitterOnboarding_nextService') : tr('sitterOnboarding_doneWithPricing')} onClick={async () => { if(pricingIdx < activeServices.length - 1) setPricingIdx(i => i + 1); else { await saveDraftServices(draftSitterId); await saveDraft(4); setScreen(4); } }} dark={false} />
    </div>
  , false);

  // SCREEN 4 — About you
  if (screen === 4) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={3} dark={false} />
      <ProgressBar step={4} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>{tr('sitterOnboarding_aboutYou')}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{tr('sitterOnboarding_helpPetParentsTrust')}</div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>{tr('sitterOnboarding_profilePhoto')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div onClick={() => photoInputRef.current?.click()}
            style={{ width: 72, height: 72, borderRadius: 20, background: photoUrl ? 'transparent' : ORANGE_LIGHT, border: photoUrl ? 'none' : '2px dashed ' + ORANGE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, overflow: 'hidden' }}>
            {uploadingPhoto ? <span style={{ fontSize: 11, color: ORANGE }}>...</span>
              : photoUrl ? <img src={photoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <><span style={{ fontSize: 24 }}>📷</span><span style={{ fontSize: 10, color: ORANGE, marginTop: 2 }}>{tr('sitterOnboarding_addPhoto')}</span></>}
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
          <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>{tr('sitterOnboarding_photoHint')}</div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>{tr('sitterOnboarding_bio')}</div>
        <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={200}
          placeholder={tr('sitterOnboarding_bioPlaceholder')}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E0E0E0', fontSize: 13, color: '#1a1a1a', outline: 'none', resize: 'none', minHeight: 90, lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, color: '#CCC', textAlign: 'right', marginTop: 4 }}>{bio.length}/200</div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>{tr('sitterOnboarding_experienceWithPets')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {EXPERIENCE_OPTIONS.map(opt => (
            <button key={opt} onClick={() => setExperience(opt)}
              style={{ padding: '8px 14px', borderRadius: 20, border: experience === opt ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: experience === opt ? ORANGE_LIGHT : 'white', color: experience === opt ? ORANGE : '#555', fontSize: 13, fontWeight: experience === opt ? 600 : 400, cursor: 'pointer' }}>
              {tr(EXPERIENCE_KEYS[opt])}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>{tr('sitterOnboarding_languagesSpoken')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {LANGUAGES.map(lang => (
            <button key={lang} onClick={() => toggleLang(lang)}
              style={{ padding: '8px 14px', borderRadius: 20, border: languages.includes(lang) ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: languages.includes(lang) ? ORANGE_LIGHT : 'white', color: languages.includes(lang) ? ORANGE : '#555', fontSize: 13, fontWeight: languages.includes(lang) ? 600 : 400, cursor: 'pointer' }}>
              {tr(LANGUAGE_KEYS[lang])}
            </button>
          ))}
        </div>
      </div>

      <BottomBtn label={tr('sitterOnboarding_continue')} onClick={async () => { await saveDraft(5); setScreen(5); }} dark={false} />
    </div>
  , false);

  // SCREEN 5 — Availability
  if (screen === 5) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={4} dark={false} />
      <ProgressBar step={5} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>{tr('sitterOnboarding_yourAvailability')}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{tr('sitterOnboarding_setScheduleChangeAnytime')}</div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>{tr('sitterOnboarding_availableDays')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => {
            const sel = availableDays.includes(day);
            return (
              <button key={day} onClick={() => setAvailableDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                style={{ padding: '8px 14px', borderRadius: 20, border: sel ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: sel ? ORANGE_LIGHT : 'white', color: sel ? ORANGE : '#555', fontSize: 13, fontWeight: sel ? 600 : 400, cursor: 'pointer' }}>
                {tr(DAY_KEYS[day])}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={() => setAvailableDays(['Mon','Tue','Wed','Thu','Fri'])}
            style={{ flex: 1, padding: '6px 0', borderRadius: 10, border: '1px solid #E0E0E0', background: 'white', color: '#888', fontSize: 12, cursor: 'pointer' }}>
            {tr('sitterOnboarding_weekdays')}
          </button>
          <button onClick={() => setAvailableDays(['Sat','Sun'])}
            style={{ flex: 1, padding: '6px 0', borderRadius: 10, border: '1px solid #E0E0E0', background: 'white', color: '#888', fontSize: 12, cursor: 'pointer' }}>
            {tr('sitterOnboarding_weekends')}
          </button>
          <button onClick={() => setAvailableDays(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])}
            style={{ flex: 1, padding: '6px 0', borderRadius: 10, border: '1px solid #E0E0E0', background: 'white', color: '#888', fontSize: 12, cursor: 'pointer' }}>
            {tr('sitterOnboarding_allDays')}
          </button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>{tr('sitterOnboarding_availableTimeSlots')}</div>
        {[
          { label: tr('sitterOnboarding_slotMorning'), sub: '6am - 10am', key: 'morning', val: morningSlot, set: setMorningSlot },
          { label: tr('sitterOnboarding_slotAfternoon'), sub: '12pm - 4pm', key: 'afternoon', val: afternoonSlot, set: setAfternoonSlot },
          { label: tr('sitterOnboarding_slotEvening'), sub: '5pm - 8pm', key: 'evening', val: eveningSlot, set: setEveningSlot },
        ].map(slot => (
          <div key={slot.key} onClick={() => slot.set(!slot.val)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: slot.key !== 'evening' ? '1px solid #F5F5F5' : 'none', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{slot.label}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{slot.sub}</div>
            </div>
            <div style={{ width: 44, height: 24, borderRadius: 12, background: slot.val ? ORANGE : '#E0E0E0', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
              <div style={{ position: 'absolute', top: 2, left: slot.val ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>{tr('sitterOnboarding_maxDogsAtOneTime')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['1','2','3','4+'].map(n => (
            <button key={n} onClick={() => setMaxDogs(n)}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: maxDogs === n ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: maxDogs === n ? ORANGE_LIGHT : 'white', color: maxDogs === n ? ORANGE : '#555', fontSize: 16, fontWeight: maxDogs === n ? 700 : 400, cursor: 'pointer' }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>{tr('sitterOnboarding_advanceNoticeNeeded')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Same day','12hrs','24hrs','48hrs','1 week'].map(n => (
            <button key={n} onClick={() => setAdvanceNotice(n)}
              style={{ padding: '8px 14px', borderRadius: 20, border: advanceNotice === n ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: advanceNotice === n ? ORANGE_LIGHT : 'white', color: advanceNotice === n ? ORANGE : '#555', fontSize: 12, fontWeight: advanceNotice === n ? 600 : 400, cursor: 'pointer' }}>
              {tr(ADVANCE_NOTICE_KEYS[n])}
            </button>
          ))}
        </div>
      </div>

      <BottomBtn label={tr('sitterOnboarding_continue')} onClick={async () => { await saveDraft(6); setScreen(6); }} dark={false} />
    </div>
  , false);

  // SCREEN 6 — ID Verification
  if (screen === 6) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={5} dark={false} />
      <ProgressBar step={6} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>{tr('sitterOnboarding_idVerification')}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{tr('sitterOnboarding_requiredBeforeFirstBooking')}</div>

      <div style={{ background: '#E3F2FD', borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10 }}>
        <span style={{ fontSize: 20 }}>🛡️</span>
        <div style={{ fontSize: 12, color: '#1565C0', lineHeight: 1.6 }}>
          <strong>{tr('sitterOnboarding_whyWeVerifyTitle')}</strong> {tr('sitterOnboarding_whyWeVerifyBody')}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>{tr('sitterOnboarding_aadhaarNumber')}</div>
        <input value={aadhaar} onChange={e => setAadhaar(e.target.value.replace(/\D/g,'').slice(0,12))}
          placeholder="XXXX XXXX XXXX"
          style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #E0E0E0', fontSize: 16, color: '#1a1a1a', outline: 'none', letterSpacing: 4, boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, color: '#AAA', marginTop: 6 }}>{tr('sitterOnboarding_aadhaarHint')}</div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>{tr('sitterOnboarding_upiIdForPayouts')}</div>
        <input value={upiId} onChange={e => setUpiId(e.target.value)}
          placeholder={tr('sitterOnboarding_upiPlaceholder')}
          style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #E0E0E0', fontSize: 15, color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, color: '#AAA', marginTop: 6 }}>{tr('sitterOnboarding_upiHint')}</div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>{tr('sitterOnboarding_whatHappensNext')}</div>
        {VERIFY_STEP_KEYS.map((key, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid #F5F5F5' : 'none' }}>
            <CheckCircle size={16} color={ORANGE} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: '#555' }}>{tr(key)}</span>
          </div>
        ))}
      </div>

      <BottomBtn label={tr('sitterOnboarding_continue')} onClick={async () => { const id = await saveDraft(7); if (id && (aadhaar || upiId)) { await supabase.from('sitter_pii').upsert({ sitter_id: id, aadhaar_number: aadhaar || null, upi_id: upiId || null }, { onConflict: 'sitter_id' }); } setScreen(7); }} dark={false} />
    </div>
  , false);

  // SCREEN 7 — Sitter responsibilities
  if (screen === 7) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={6} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>{tr('sitterOnboarding_yourResponsibilities')}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{tr('sitterOnboarding_whatFursdayExpects')}</div>

      <div style={{ background:'#FFF0EB', borderRadius:14, padding:'12px 16px', marginBottom:14, display:'flex', gap:10 }}>
        <span style={{ fontSize:18 }}>ℹ️</span>
        <div style={{ fontSize:12, color:'#FF6B35', lineHeight:1.6 }}>{tr('sitterOnboarding_responsibilitiesIntro')}</div>
      </div>

      {RESPONSIBILITIES.map((item, i) => (
        <div key={i} style={{ background:'white', borderRadius:14, padding:'12px 14px', marginBottom:8, display:'flex', gap:12, alignItems:'flex-start', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }}>
          <div style={{ width:38, height:38, borderRadius:10, background:item.required?'#FFF0EB':'#F8F8F8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{item.emoji}</div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{tr(item.labelKey)}</div>
              {item.required && <span style={{ fontSize:10, background:'#FCEBEB', color:'#A32D2D', borderRadius:6, padding:'1px 6px', fontWeight:600 }}>{tr('common_required')}</span>}
            </div>
            <div style={{ fontSize:12, color:'#888', lineHeight:1.5 }}>{tr(item.detailKey)}</div>
          </div>
        </div>
      ))}

      <div style={{ background:'#E8F5E9', borderRadius:14, padding:'12px 16px', marginBottom:16, display:'flex', gap:10 }}>
        <span style={{ fontSize:16 }}>✓</span>
        <div style={{ fontSize:12, color:'#2E7D32', lineHeight:1.6 }}>{tr('sitterOnboarding_responsibilitiesFooter')}</div>
      </div>

      <BottomBtn label={tr('sitterOnboarding_acceptResponsibilities')} onClick={async () => { await saveDraft(8); setScreen(8); }} dark={false} />
    </div>
  , false);

  // SCREEN 8 — Review + agree
  if (screen === 8) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={7} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>{tr('sitterOnboarding_reviewAndGoLive')}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{tr('sitterOnboarding_almostThere')}</div>

      <div style={{ background: DARK, borderRadius: 24, padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{tr('sitterOnboarding_estimatedMonthlyEarnings')}</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: ORANGE, marginBottom: 4 }}>Rs.{estimated.toLocaleString('en-IN')}/mo</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
          {tr('sitterOnboarding_acrossInCity', { count: activeServices.length, unit: tr(activeServices.length > 1 ? 'sitterOnboarding_servicesWord' : 'sitterOnboarding_serviceWord'), city })}
        </div>
        {activeServices.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < activeServices.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{s.icon} {tr(s.nameKey)}</span>
            <span style={{ fontSize: 13, color: ORANGE, fontWeight: 600 }}>Rs.{prices[s.id]}</span>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>{tr('sitterOnboarding_completeAfterApproval')}</div>
        {COMPLETE_STEP_KEYS.map((key, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid #F5F5F5' : 'none' }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: '#CCC' }}>○</span>
            </div>
            <span style={{ fontSize: 13, color: '#555' }}>{tr(key)}</span>
          </div>
        ))}
      </div>

      <div onClick={() => setAgreed(!agreed)}
        style={{ background: agreed ? '#E8F5E9' : 'white', borderRadius: 16, padding: '14px 16px', marginBottom: 14, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', gap: 10, border: agreed ? '1.5px solid #A5D6A7' : '1.5px solid transparent' }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, border: agreed ? 'none' : '1.5px solid #DDD', background: agreed ? ORANGE : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          {agreed && <CheckCircle size={14} color="white" />}
        </div>
        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.7 }}>
          {tr('sitterOnboarding_agreeTermsPart1')} <span style={{ color: ORANGE, fontWeight: 600 }}>{tr('sitterOnboarding_sitterTermsOfService')}</span>{tr('sitterOnboarding_agreeTermsPart2')}
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, padding: '12px 20px calc(28px + env(safe-area-inset-bottom))', background: '#F8F8F8', borderTop: '1px solid #E0E0E0' }}>
        <button onClick={() => agreed && !saving && handleGoLive()} disabled={!agreed || saving}
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: agreed && !saving ? ORANGE : '#E0E0E0', color: agreed && !saving ? 'white' : '#AAA', fontSize: 15, fontWeight: 700, cursor: agreed && !saving ? 'pointer' : 'not-allowed' }}>
          {saving ? tr('common_saving') : tr('sitterOnboarding_goLiveOnFursday')}
        </button>
      </div>
    </div>
  , false);

  // SCREEN 9 — Celebration
  return wrap(
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: 'white', marginBottom: 8, lineHeight: 1.2 }}>
        {tr('sitterOnboarding_youreLive')}<br /><span style={{ color: ORANGE }}>{name}!</span>
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 32, lineHeight: 1.6 }}>
        {tr('sitterOnboarding_profileUnderReview')}<br />{tr('sitterOnboarding_whatsappWithin24h')}
      </div>
      <div style={{ background: DARK2, borderRadius: 24, padding: 20, width: '100%', marginBottom: 16, border: '1px solid rgba(255,107,53,0.2)' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{tr('sitterOnboarding_yourEarningPotential')}</div>
        <div style={{ fontSize: 40, fontWeight: 900, color: ORANGE }}>Rs.{estimated.toLocaleString('en-IN')}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{tr('sitterOnboarding_estimatedMonthlyInCity', { city })}</div>
      </div>
      <div style={{ background: '#128C7E', borderRadius: 18, padding: '14px 20px', width: '100%', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 24 }}>💬</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>{tr('sitterOnboarding_whatsappNotification')}</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{tr('sitterOnboarding_phoneWhenApproved', { phone })}</div>
        </div>
        <CheckCircle size={18} color="white" style={{ marginLeft: 'auto', flexShrink: 0 }} />
      </div>
      <button onClick={() => { if(window.confirm) { onDone('sitter'); } else { onDone(); } }}
        style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: ORANGE, color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
        {tr('sitterOnboarding_goToSitterDashboard')}
      </button>
    </div>
  , true);
}