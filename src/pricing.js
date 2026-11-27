// What a booking costs, from the host's base price and their pricing rules
// (sitter_profiles.pricing_rules, migration 038). Pure, so the parent's checkout
// and the host's "preview my prices" screen show exactly the same numbers.
//
// priceFor({ service, basePriceRupees, startDate, nights, dogs, puppies, pickup, rules })
//   -> { total, lines: [{ label, amount, vars }] }   label is an i18n key, amounts in whole rupees.
//
// Rules (every field optional; missing or invalid means "no rule"):
//   weekend_pct        surcharge % on Friday and Saturday nights.
//   holiday_pct        surcharge % on nights listed in holidays[] ('YYYY-MM-DD'). A night that is
//                      both weekend and holiday gets the larger of the two, never both.
//   holidays           ['2026-12-25', ...]
//   extra_dog_pct      each extra dog pays the first dog's night total less this %.
//   long_stay_nights   stays of at least this many nights get ...
//   long_stay_pct      ... this % off all dogs' night total (surcharges included).
//   puppy_extra_rupees flat extra per puppy, once per booking.
//   pickup_fee_rupees  flat fee, once, when the parent asks for pick-up and drop-back.
//
// Night services (boarding, housesit) price each night. Every other service is
// one visit: the base price, then the dog, puppy and pickup rules. A meet &
// greet is always free.

// Line labels live here so every screen that shows a breakdown gets them.
export const NIGHT_SERVICES = ['boarding', 'housesit'];
export const FREE_SERVICES = ['meet_greet'];

const num = (v, max = Infinity) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};
const parseISO = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export function cleanRules(rules) {
  const r = rules && typeof rules === 'object' ? rules : {};
  return {
    weekend_pct: num(r.weekend_pct, 200),
    holiday_pct: num(r.holiday_pct, 200),
    holidays: Array.isArray(r.holidays) ? r.holidays.map(h => String(h).slice(0, 10)) : [],
    long_stay_nights: Math.floor(num(r.long_stay_nights, 365)),
    long_stay_pct: num(r.long_stay_pct, 100),
    extra_dog_pct: num(r.extra_dog_pct, 100),
    puppy_extra_rupees: Math.round(num(r.puppy_extra_rupees)),
    pickup_fee_rupees: Math.round(num(r.pickup_fee_rupees)),
  };
}

// The dates of each night of a stay starting on startDate.
export function stayNights(startDate, nights) {
  if (!startDate || !(nights > 0)) return [];
  const d = startDate instanceof Date ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()) : parseISO(startDate);
  return Array.from({ length: nights }, (_, i) => { const n = new Date(d); n.setDate(d.getDate() + i); return n; });
}

// Same arithmetic as the host's preview (stayPrice in HostSettings.js; pricing.test.js
// checks they agree): amounts stay unrounded until the end, and the rounding
// difference goes on the last line so the lines always add up to the total.
export function priceFor({ service, basePriceRupees, startDate, nights = 1, dogs = 1, puppies = 0, pickup = false, rules } = {}) {
  if (FREE_SERVICES.includes(service)) return { total: 0, lines: [] };
  const r = cleanRules(rules);
  const base = Math.round(num(basePriceRupees));
  const dogCount = Math.max(1, Math.floor(Number(dogs) || 1));
  const raw = [];
  let oneDog;

  if (NIGHT_SERVICES.includes(service)) {
    const n = Math.max(1, Math.floor(Number(nights) || 1));
    const dates = startDate ? stayNights(startDate, n) : [];
    let weekendExtra = 0, holidayExtra = 0;
    // A night is its arrival date. A night that is both weekend and holiday gets the larger surcharge.
    dates.forEach(d => {
      const weekendPct = d.getDay() === 5 || d.getDay() === 6 ? r.weekend_pct : 0;
      const holidayPct = r.holidays.includes(iso(d)) ? r.holiday_pct : 0;
      if (holidayPct && holidayPct >= weekendPct) holidayExtra += base * holidayPct / 100;
      else if (weekendPct) weekendExtra += base * weekendPct / 100;
    });
    raw.push({ label: 'pricing_nightsLine', amount: base * n, vars: { n, price: base } });
    if (weekendExtra) raw.push({ label: 'pricing_weekendLine', amount: weekendExtra, vars: { pct: r.weekend_pct } });
    if (holidayExtra) raw.push({ label: 'pricing_holidayLine', amount: holidayExtra, vars: { pct: r.holiday_pct } });
    oneDog = base * n + weekendExtra + holidayExtra;
    const extra = (dogCount - 1) * oneDog * (1 - r.extra_dog_pct / 100);
    if (dogCount > 1) raw.push({ label: r.extra_dog_pct ? 'pricing_extraDogsDiscountLine' : 'pricing_extraDogsLine', amount: extra, vars: { n: dogCount - 1, pct: r.extra_dog_pct } });
    if (r.long_stay_nights && r.long_stay_pct && n >= r.long_stay_nights) {
      raw.push({ label: 'pricing_longStayLine', amount: -(oneDog + extra) * r.long_stay_pct / 100, vars: { pct: r.long_stay_pct, n: r.long_stay_nights } });
    }
  } else {
    raw.push({ label: 'pricing_visitLine', amount: base, vars: { price: base } });
    oneDog = base;
    if (dogCount > 1) raw.push({ label: r.extra_dog_pct ? 'pricing_extraDogsDiscountLine' : 'pricing_extraDogsLine', amount: (dogCount - 1) * oneDog * (1 - r.extra_dog_pct / 100), vars: { n: dogCount - 1, pct: r.extra_dog_pct } });
  }

  const pups = Math.max(0, Math.floor(Number(puppies) || 0));
  if (pups && r.puppy_extra_rupees) raw.push({ label: 'pricing_puppyLine', amount: pups * r.puppy_extra_rupees, vars: { n: pups } });
  if (pickup && r.pickup_fee_rupees) raw.push({ label: 'pricing_pickupLine', amount: r.pickup_fee_rupees, vars: {} });

  const total = Math.max(0, Math.round(raw.reduce((a, l) => a + l.amount, 0)));
  const lines = raw.filter(l => Math.round(l.amount) !== 0 || l === raw[0]).map(l => ({ ...l, amount: Math.round(l.amount) }));
  const drift = total - lines.reduce((a, l) => a + l.amount, 0);
  if (drift) lines[lines.length - 1].amount += drift;
  return { total, lines };
}
