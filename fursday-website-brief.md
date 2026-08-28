# Fursday — Website Build Brief

This document is a complete brief for building the **marketing website** for Fursday. It covers brand, product, audience, content, and technical context. Use this as the single source of truth.

---

## 1. What is Fursday

Fursday is **India's first dedicated peer-to-peer pet care marketplace** — modeled after Rover.com but rebuilt specifically for Indian pet parents and the Indian context (heat safety, stray dog encounters, festival anxiety, society/apartment living, WhatsApp-first communication).

**One-line pitch:** Trusted, verified pet sitters and dog walkers in Pune and Gurgaon — booked in minutes, tracked in real time, with WhatsApp walk reports after every visit.

**Tagline ideas:**
- "Happy Fursday, every day 🐾"
- "Trusted pet care, the Indian way"
- "Your pet's favorite day of the week"

**Pilot cities:** Pune and Gurgaon only (clearly state this — do not imply national availability)

**Target audience:** Gen Z and millennial pet parents in urban India — tech-comfortable, WhatsApp-native, busy professionals who travel or work long hours and need trustworthy help with dog walking, boarding, and daycare.

---

## 2. Brand Identity

**Name:** Fursday (pronounced "furs-day", a play on "Thursday")

**Brand personality:** Warm, trustworthy, a little playful, never corporate-cold. Think Zomato's friendliness crossed with Urban Company's trust signals.

**Primary brand color:** Orange `#FF6B35` (Gurgaon city theme)
**Secondary city color:** Purple `#6C5CE7` (Pune city theme)
**Dark background:** `#0f0f1a`
**Light accent backgrounds:** `#FFF0EB` (orange tint), `#F0EEFF` (purple tint)

**Logo concept:** A rounded-square or circular icon in brand orange containing a simplified geometric paw print (one oval main pad + four circular toe beans), paired with a lowercase wordmark "fursday" in a modern, friendly sans-serif (Inter or similar). Lowercase wordmark feels approachable — similar register to Airbnb, Spotify.

**Typography:** Inter or system sans-serif (-apple-system, Segoe UI). Bold weights (700-800) for headlines, regular/medium for body.

**Visual tone:** Clean, mobile-app-like, rounded corners (12-24px radius throughout), generous whitespace, soft shadows rather than hard borders. Avoid stock-photo corporate pet imagery — favor candid, warm photography or friendly illustration.

---

## 3. Product Overview (what the app actually does)

Fursday is a **two-sided marketplace**:

### For pet parents:
- Browse verified sitters/walkers near them (city + radius based)
- Book services: Dog Walking, Home Boarding, Doggy Daycare, Drop-in Visits, House Sitting
- Create detailed pet profiles (breed, personality, India-specific flags like heat sensitivity and stray-dog reactivity)
- Request a booking → sitter accepts → pay securely via UPI/card (Razorpay) → service happens → receive a WhatsApp-style Walk Report Card with photos, activity log, and mood rating
- In-app messaging with their sitter
- Rs.25,000 vet insurance cover included with every booking

### For sitters/walkers:
- Apply in a guided onboarding flow (services offered, pricing with market benchmarks, availability calendar, bio, experience, languages spoken, Aadhaar ID verification, UPI payout ID)
- See real-time earning potential before committing
- Accept/decline booking requests in a sitter job dashboard
- Mark walks as started/completed, fill in the Walk Report Card after each job
- Get paid directly to UPI after each completed booking (manual payouts during pilot; 0% commission during pilot, 15% post-pilot)

### Trust & safety features (India-specific differentiators vs. Rover):
- Aadhaar eKYC verification badge
- Heat-safety flagging for walks during Indian summer peak hours
- Festival/firecracker anxiety flagging for pets
- Stray-dog-encounter logging in walk reports
- Society/apartment gate-entry coordination fields
- WhatsApp-native updates and walk reports (not email)
- Rs.25,000 per-booking vet insurance

---

## 4. Current Tech & Live Status

- **Live app:** https://fursday.vercel.app (mobile-web app, works in any browser, installable as PWA soon)
- **Stack:** React frontend, Supabase (Postgres + Auth + Storage) backend, Vercel hosting
- **Payments:** Razorpay (UPI, cards, netbanking) — currently test mode
- **Domain purchased:** fursday.in (DNS/email setup in progress)
- **Status:** Functional pilot-stage marketplace — sitter onboarding, pet profiles, booking requests, in-app chat, payments, and admin approval panel are all built and working. Currently onboarding first real sitters in Pune and Gurgaon.

This means the **website's job** is primarily:
1. Marketing/landing page to acquire pet parents and sitters
2. Clear explanation of how it works and why it's trustworthy
3. Waitlist or direct links into the live app (fursday.vercel.app, soon fursday.in)
4. SEO-friendly content for "dog walker Gurgaon", "pet boarding Pune" type searches

---

## 5. Services & Indicative Pricing (for website content)

| Service | Price starts at | Description |
|---|---|---|
| Dog Walking | Rs.299 / 30 min walk | Daily or one-off walks with GPS-tracked routes |
| Home Boarding | Rs.799 / night | Your dog stays at a verified sitter's home |
| Doggy Daycare | Rs.599 / day | Daytime care while you're at work |
| Drop-in Visit | Rs.199 / visit | Quick check-ins, feeding, bathroom breaks |
| House Sitting | Rs.1,299 / night | Sitter stays at your home with your pet |

**Promotional offer for new users:** First walk at Rs.99

---

## 6. Key Messaging Pillars (for website copy)

1. **Trust first** — "Every sitter is Aadhaar-verified" / "Rs.25,000 vet insurance on every booking"
2. **Built for India** — "Heat-safe walk timings, stray-dog awareness, festival anxiety care — because Indian pet parenting has different needs"
3. **WhatsApp-native** — "Get a full walk report on WhatsApp — photos, mood, activity — every single time"
4. **Local & community-driven** — "Real sitters in your society, your neighbourhood — not a faceless gig platform"
5. **Earn flexibly (for sitters)** — "Earn Rs.12,000–45,000/month walking dogs you'll love. No fixed hours, no lock-in."

---

## 7. Suggested Website Pages/Sections

1. **Hero section** — tagline, city availability (Pune & Gurgaon), primary CTA ("Find a sitter" / "Become a sitter"), app screenshot or mockup
2. **How it works** — 3-4 step visual (Search → Book → Walk happens → Get WhatsApp report)
3. **Services grid** — the 5 services with icons and starting prices
4. **Trust & safety section** — Aadhaar verification, insurance, heat-safety, GPS tracking badges
5. **For sitters** — earnings calculator teaser, "Become a sitter" CTA, testimonial-style earning potential
6. **City availability** — Pune and Gurgaon cards, "more cities coming soon"
7. **Testimonials/social proof** — (placeholder until real reviews exist; can use aspirational quotes initially)
8. **FAQ** — common questions (is it safe, how do payments work, what if my sitter cancels, etc.)
9. **Footer** — links to live app, contact, social media, terms of service

---

## 8. Tone & Style Notes for Whoever Builds This

- Mobile-first design (most Indian users will visit from phones)
- Keep copy short, warm, conversational — avoid corporate jargon
- Use Rs. or ₹ consistently for currency (not "INR")
- Always specify "Pune and Gurgaon" rather than implying nationwide availability
- Paw/pet emoji (🐾) can be used sparingly for warmth, not excessively
- CTAs should link to the live app: https://fursday.vercel.app (update to fursday.in once domain is live)
- This is a **pilot-stage startup**, not an established big brand — copy can be honest about being new/growing without undermining trust (e.g. "Now live in Pune and Gurgaon" rather than fake claims of scale)

---

## 9. What NOT to Do

- Don't imply nationwide India coverage — only Pune and Gurgaon are live
- Don't use real competitor names disparagingly (Rover, Urban Company can be referenced neutrally if needed for context but not as a marketing comparison)
- Don't fabricate specific user testimonials, review counts, or sitter counts — use honest, aspirational language instead until real data exists
- Don't design a heavy, slow, image-bloated site — speed and simplicity matter for Indian mobile data conditions

---

*End of brief. This document was prepared to give a separate Claude instance everything needed to design and build the Fursday marketing website without further context from the original product-build conversation.*
