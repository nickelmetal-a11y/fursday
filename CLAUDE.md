# 🐾 Fursday - Claude Project Rulebook

**READ THIS FIRST before starting any work on Fursday.**

---

## 📋 PROJECT OVERVIEW

**Fursday** is a pet care marketplace connecting pet parents with vetted sitters for walks, boarding, daycare, etc.

- **Status:** Production (14/14 Phase 1 features complete)
- **Production URL:** https://fursday.vercel.app
- **Tech Stack:** React 19 + React Router 7 | Supabase PostgreSQL | Vercel deployment
- **Team Email:** nikhil.a.mathur@accenture.com
- **Vercel Account:** nikhilmathur-4671
- **Vercel Email:** nikhilmathur@mac.com (NOT accenture email)

---

## 🏗️ ARCHITECTURE

### Frontend (React)
- **src/App.js** - Main app, GPS detection, map initialization, city routing
- **src/LoginScreen.js** - Email auth, dynamic city messaging
- **src/BookingFlow.js** - 4-step booking flow with heat advisory
- **src/BookingsDashboard.js** - Active/past bookings, reviews, reports
- **src/SitterDashboard.js** - Sitter job board and earnings
- **src/SitterEditProfile.js** - Sitter profile with portfolio photos
- **src/ExploreScreen.js** - GPS-sorted sitter discovery
- **src/ChatScreen.js** - Real-time messaging
- **src/PetProfile.js** - Pet creation with photos
- **src/ReviewModal.js** - Post-booking 5-star reviews (NEW - Phase 2)

### Backend (Supabase)
- **bookings** table - Booking workflow
- **sitter_profiles** table - Sitter metadata with avg_rating, review_count
- **pet_profiles** table - Pet metadata with photos
- **users** table - Auth
- **sitter_pii** table - Sensitive data (Aadhaar, UPI)
- **sitter_profile_photos** table - Up to 3 portfolio photos
- **reviews** table - Ratings & reviews (Phase 2)
- **messages** table - Chat history
- **sitter_reports** table - Incident reports

### Key Features
| Feature | File | Status |
|---------|------|--------|
| City-agnostic setup | App.js, CITY_CONFIG | ✅ Live |
| GPS city auto-detect | App.js | ✅ Live |
| Heat advisory | BookingFlow.js:82-90 | ✅ Live |
| Aggression disclosure | BookingFlow.js:56-77 | ✅ Live |
| Sitter photos (max 3) | SitterEditProfile.js | ✅ Live |
| Emergency contact | BookingsDashboard.js | ✅ Live |
| Report sitter | BookingsDashboard.js | ✅ Live |
| Pet profile edit | PetProfile.js | ✅ Live |
| Ratings & Reviews | ReviewModal.js, BookingsDashboard.js | ✅ Live (Phase 2 P1) |

---

## 🔧 DEVELOPMENT WORKFLOW

### Before Starting Any Task
1. Read this file ✓
2. Check `/memory/MEMORY.md` for context from previous sessions
3. Run `git status` to see current state
4. Review task priority in Phase roadmap below

### Code Quality Rules
- **NO hardcoded city references** - Use CITY_CONFIG object
- **NO Comments** - Only if WHY is non-obvious (hidden constraints, workarounds)
- **NO premature abstractions** - 3 similar lines > 1 abstraction
- **NO dead code** - Delete unused functions immediately
- **RLS by default** - All new tables must have Row Level Security policies
- **Test as you code** - Start dev server early, verify UI changes work

### File Conventions
- Components: PascalCase (ReviewModal.js)
- Utilities: camelCase (compressImage.js if extracted)
- Migrations: `NNN_description.sql` in supabase/migrations/
- One component per file (except small helpers)

### Git Commits
- Commit frequently (don't batch)
- Use present tense: "Add ratings system" not "Added"
- Prefix with emoji: 🎨 refactor, ✅ complete feature, 🐛 fix bug, 📚 docs
- Always include: `Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>`

### Deployment
```bash
cd "C:\Users\nikhil.a.mathur\SynologyDrive\Home Project\fursday"
git add -A
git commit -m "message"
vercel --prod
```
- Never use `git push` - use `vercel --prod` directly
- Deployment takes 3-5 minutes
- Check https://fursday.vercel.app after deploy

---

## 📊 PHASE ROADMAP

### ✅ PHASE 1: MVP (COMPLETE - 14/14)
- [x] Core booking flow
- [x] Sitter discovery
- [x] Pet profiles
- [x] Messaging
- [x] Aggression disclosure
- [x] Emergency contacts
- [x] Sitter photos (3 max)
- [x] Heat advisory
- [x] Report sitter
- [x] Map rendering (fixed)
- [x] Sitter name loading (fixed)
- [x] City-agnostic setup

### 🟡 PHASE 2: TRUST & ACCOUNTABILITY (IN PROGRESS)
**Part 1: Ratings & Reviews** ✅ LIVE
- [x] 5-star rating modal
- [x] Written review text (10+ chars)
- [x] Database storage
- [x] Sitter profile display
- [x] Integration with BookingsDashboard

**Part 2: Walk Photo Reports** (IN PROGRESS - 60% complete)
- [x] Sitter uploads 1-3 photos after walk (PhotoUploadModal.js complete)
- [x] Photo upload integration in SitterDashboard (button for completed walks)
- [ ] Photo carousel UI in BookingsDashboard (for parents viewing proof)
- [ ] Parent confirmation flow

**Part 3: Cancellation Policy** (2-3 days after Part 2)
- [ ] Clear refund rules UI
- [ ] Auto-refund logic by timing
- [ ] Dispute handling

### 🟢 PHASE 3: RETENTION (3-4 days after Phase 2)
- [ ] Repeat booking button
- [ ] Favorite sitters list
- [ ] Walk receipts/invoices
- [ ] Push notifications
- [ ] Referral program

---

## 🚀 CURRENT TASK QUEUE

| Priority | Task | Est. Time | Owner |
|----------|------|-----------|-------|
| 🔴 HIGH | Walk Photo Reports | 2 days | Claude |
| 🔴 HIGH | Cancellation Policy | 1 day | Claude |
| 🟡 MED | Repeat Booking | 1 day | Claude |
| 🟡 MED | Favorites List | 1 day | Claude |
| 🟡 MED | Receipts/Invoices | 1 day | Claude |
| 🟢 LOW | Push notifications | 2 days | Later |
| 🟢 LOW | Referral program | 2 days | Later |

---

## 📝 KEY LOCATIONS

| What | Where |
|------|-------|
| Frontend code | `src/` |
| Database schema | `supabase/migrations/` |
| Config | `CITY_CONFIG` object in App.js |
| Themes | THEMES object in each component |
| Supabase project ID | Reference in `.env` (local only) |
| Deployed app | https://fursday.vercel.app |
| Vercel dashboard | https://vercel.com/gyaandangal/fursday |
| Supabase dashboard | https://supabase.com/dashboard/projects |

---

## ⚡ QUICK REFERENCE

### Start Dev Server
```bash
npm start
# Opens http://localhost:3000
```

### Test a Feature
1. Open http://localhost:3000
2. Log in with test email
3. Navigate to feature
4. Test UI interactions
5. Check console for errors

### Common Tasks

**Add new booking field:**
1. Update bookings table migration
2. Update BookingFlow.js form
3. Update BookingsDashboard display
4. Test end-to-end

**Add new sitter field:**
1. Update sitter_profiles table
2. Update SitterEditProfile.js form
3. Update SitterOnboarding.js
4. Update SitterDashboard display

**Add new RLS policy:**
1. Create in migration file
2. Test with role-specific queries
3. Verify non-owners can't access

---

## 🎯 RULES FOR THIS SESSION

1. **Read this file first** - Every session starts here
2. **Check memory** - See `/memory/MEMORY.md` for context
3. **Deploy after features** - Don't batch work across multiple features
4. **Test in browser** - No feature is "done" without testing
5. **Keep it simple** - No premature optimization
6. **Ask before big changes** - Major refactors need approval
7. **Focus on Phase 2** - Heat advisory, sitter photos, and ratings/reviews are done; continue with walk reports

---

## 📞 SUPPORT

**Issue?**
1. Check git history for similar fix
2. Search codebase for pattern
3. Read related test if available
4. Ask in Claude Code /help

**Deployment issue?**
1. Check preview logs: `vercel logs`
2. Verify Supabase migrations applied
3. Check RLS policies
4. Restart with fresh deploy

**Database issue?**
1. Check Supabase dashboard > SQL Editor
2. Verify RLS policy
3. Check auth.uid() context
4. Test with different user role

---

**Last Updated:** 2026-09-01  
**Status:** Phase 2 Part 1 Live (Ratings & Reviews) + Phase 2 Part 2 In Progress (Walk Photo Reports - sitter upload complete)  
**Next:** Photo carousel in BookingsDashboard + Parent confirmation flow

