# Fursday UI — Direction A ("clean utility")

Approved by the owner on 2026-11-26. **Reference implementation:** the home screen in `src/App.js` (search for `── Home ──`), `src/InboxScreen.js`, `src/PromoBanner.js`, `src/ui/BottomNav.js`. Copy their patterns.

## Rules
1. **Tokens only.** Import from `src/theme.js`: `color`, `font`, `radius`, `shadow`, `ui`, `statusTone`, `navPadding`. Use no hex colours outside theme.js, except inside images and illustrations.
2. **One brand colour.** Navy (`color.navy`) is for primary buttons, active states and links. Saffron (`color.saffron`) is a small highlight only: offers, progress, star ratings. Use the semantic tones (`success`/`warning`/`danger`/`info` plus `*Soft`) only for status meaning.
3. **No city themes.** Delete the per-file `THEMES = { Gurgaon: orange, Pune: purple }` maps and their gradients. Keep the `city` prop if logic needs it, but it must not change colours.
4. **No emoji as UI icons.** Use `<Icon name="…"/>` from `src/ui/Icon.js` (see `ICON_NAMES`; add a new path there only if truly missing). Emoji inside user content, chat messages and translated copy text stay as they are.
5. **Page shell:**
   - Outer wrapper: `style={ui.page}` (white header and `color.bg` page).
   - Header: `ui.header` + `ui.headerTitle`.
   - Back button: `<button style={ui.backButton} aria-label={tr('common_back')}><Icon name="arrowLeft" size={20}/></button>`. Keep the `arrowLeft` icon on back buttons, because the Android hardware back button relies on it.
6. **Surfaces.**
   - Cards are `ui.card`: white, 1px `color.line` border, radius 16, no heavy shadows.
   - List rows sit inside one card, separated by `1px solid color.line`.
   - Use `ui.iconTile` for leading icons.
7. **Controls:**
   - Buttons: `ui.primaryButton`, `ui.secondaryButton` or `ui.dangerButton`.
   - Chips and tabs: `ui.chip(active)`. Inputs: `ui.input`. Labels: `ui.label`.
   - Badges: `ui.badge('success'|'warning'|'danger'|'info')`; use `statusTone[status]` for booking status.
   - Tap targets are at least 44px tall.
8. **Type.**
   - Inter (already loaded). Scale: `font.xs` 11, `sm` 12, `md` 14, `lg` 16, `xl` 20, `xxl` 24.
   - Weights: 400 body, 600 labels and buttons, 700 titles. No 800/900.
   - Sentence case, no ALL-CAPS headings except tiny eyebrow labels.
9. **Bottom navigation.**
   - **Do not render a bottom nav bar in any screen.** App.js renders the one shared `BottomNav`.
   - Delete each screen's own fixed bottom nav block.
   - On tab screens (Explore, Bookings, My Pets/UserProfile, Settings, SitterDashboard, SitterEarnings, SitterEditProfile), give the scrolling page `paddingBottom: navPadding`.
   - Keep any non-nav sticky action bar (e.g. BookingFlow's Continue bar) as is, restyled.
10. **Width.** Pages use `ui.page` (max 480, centred). Replace fixed `width: 390` with `width: '100%'` and `maxWidth: 480`. Nothing may overflow at 360px.
11. **Language.** All visible text must still come from `tr('key')`. Do not rename or remove keys, and do not change English wording: tests assert it. New text needs new keys in both `en` and `hi` (use the `addkeys.py` helper described in the brief).
12. **Don't change behaviour.** This is a visual pass. Keep props, handlers, Supabase calls, state and test-relevant text and roles as they are. Turning a clickable `div` into a `button` is fine, but keep the same accessible name.

## Patterns
- **Empty state:** a centred `ui.card`, `ui.iconTile` icon, one muted sentence, optional primary button.
- **Loading:** light skeleton blocks (`color.tile`, radius 12) instead of "Loading…" text where it's easy.
- **Status pill:** `<span style={ui.badge(statusTone[b.status])}>{label}</span>`.
- **Money:** `Rs.` + number, `fontVariantNumeric: 'tabular-nums'` in lists.
- **Modals and bottom sheets:** white, radius 20 on the top corners, `padding: 20`, a header row with title and a close `<Icon name="plus" style={{transform:'rotate(45deg)'}}/>` or text close button, primary action full width at the bottom.
