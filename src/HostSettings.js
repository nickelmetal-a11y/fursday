import React, { useState } from 'react';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

export const CANCELLATION_POLICIES = ['flexible', 'moderate', 'strict'];
export const DEFAULT_POLICY = 'moderate';

export const RULE_FIELDS = [
  { id: 'weekend_pct', unit: 'pct', max: 100 },
  { id: 'holiday_pct', unit: 'pct', max: 200 },
  { id: 'long_stay_nights', unit: 'nights', max: 60 },
  { id: 'long_stay_pct', unit: 'pct', max: 50 },
  { id: 'extra_dog_pct', unit: 'pct', max: 100 },
  { id: 'puppy_extra_rupees', unit: 'rupees', max: 5000 },
  { id: 'pickup_fee_rupees', unit: 'rupees', max: 5000 },
];

// Festivals that move with the lunar calendar (approximate; hosts can edit).
const MOVING_FESTIVALS = ['2027-03-10', '2027-03-22', '2027-08-17', '2027-08-25', '2027-09-04', '2027-10-09', '2027-10-29',
  '2028-02-27', '2028-03-11', '2028-08-05', '2028-08-13', '2028-08-23', '2028-09-27', '2028-10-17'];
const FIXED_FESTIVALS = ['01-26', '08-15', '10-02', '12-25', '12-31'];

const iso = (d) => d.toISOString().slice(0, 10);

// Major Indian holidays in the next 12 months, as 'YYYY-MM-DD'.
export function upcomingHolidays(from = new Date()) {
  const start = iso(from);
  const end = iso(new Date(from.getTime() + 365 * 24 * 60 * 60 * 1000));
  const y = from.getFullYear();
  const fixed = [y, y + 1].flatMap(year => FIXED_FESTIVALS.map(md => year + '-' + md));
  return [...new Set([...fixed, ...MOVING_FESTIVALS])].filter(d => d >= start && d < end).sort();
}

const dayOfWeek = (isoDate) => new Date(isoDate + 'T00:00:00Z').getUTCDay();
const addDays = (isoDate, n) => iso(new Date(Date.parse(isoDate + 'T00:00:00Z') + n * 24 * 60 * 60 * 1000));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Price of a stay under a host's pricing_rules. src/pricing.js priceFor() follows the same rules:
 * - A night is the date you arrive on, so Fri–Mon is the Friday, Saturday and Sunday nights.
 * - Each night costs the nightly price. Friday and Saturday nights add weekend_pct; a night whose
 *   date is in holidays adds holiday_pct. A night that is both gets the larger surcharge, not both.
 * - The first dog pays the night total; each further dog pays the night total less extra_dog_pct.
 * - When nights >= long_stay_nights (and both long-stay rules are set), long_stay_pct comes off the
 *   whole night total for all dogs.
 * - puppy_extra_rupees is added once per puppy per booking; pickup_fee_rupees once per booking.
 * - Everything is in rupees and rounded to the nearest rupee at the end. Missing rules are 0.
 */
export function stayPrice({ nightly, rules = {}, checkIn, nights, dogs = 1, puppies = 0, pickup = false }) {
  const holidays = new Set(rules.holidays || []);
  let base = 0, surcharge = 0, weekendNights = 0, holidayNights = 0;
  for (let i = 0; i < nights; i++) {
    const night = addDays(checkIn, i);
    const weekend = [5, 6].includes(dayOfWeek(night));
    const holiday = holidays.has(night);
    if (weekend) weekendNights++;
    if (holiday) holidayNights++;
    const pct = Math.max(weekend ? num(rules.weekend_pct) : 0, holiday ? num(rules.holiday_pct) : 0);
    base += nightly;
    surcharge += nightly * pct / 100;
  }
  const oneDog = base + surcharge;
  const extraDogs = Math.max(0, dogs - 1) * oneDog * (1 - num(rules.extra_dog_pct) / 100);
  const longStay = num(rules.long_stay_nights) > 0 && num(rules.long_stay_pct) > 0 && nights >= num(rules.long_stay_nights)
    ? (oneDog + extraDogs) * num(rules.long_stay_pct) / 100 : 0;
  const puppy = Math.max(0, puppies) * num(rules.puppy_extra_rupees);
  const pickupFee = pickup ? num(rules.pickup_fee_rupees) : 0;
  return {
    base: Math.round(base), surcharge: Math.round(surcharge), extraDogs: Math.round(extraDogs), longStay: Math.round(longStay),
    puppy: Math.round(puppy), pickup: Math.round(pickupFee), weekendNights, holidayNights,
    total: Math.round(oneDog + extraDogs - longStay + puppy + pickupFee),
  };
}

export const nextFriday = (from = new Date()) => {
  const d = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7 || 7));
  return iso(d);
};

export const formatHoliday = (isoDate, locale) =>
  new Date(isoDate + 'T00:00:00Z').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export default function HostSettings({ nightly, isBoarding, rules, policy, instantBook, requiresVaccination, houseRules, onChange }) {
  const { t: tr, lang } = useLanguage();
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const [newHoliday, setNewHoliday] = useState('');
  const r = rules || {};
  const holidays = r.holidays || [];
  const setRule = (id, value) => {
    const next = { ...r };
    if (value === '' || value == null) delete next[id]; else next[id] = value;
    onChange({ rules: next });
  };
  const addHoliday = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newHoliday)) return;
    setRule('holidays', [...new Set([...holidays, newHoliday])].sort());
    setNewHoliday('');
  };

  const card = { ...ui.card, marginBottom: 12 };
  const cardTitle = { fontSize: font.md, fontWeight: 600, color: color.ink, margin: '0 0 4px' };
  const sub = { fontSize: font.sm, color: color.muted, lineHeight: 1.5 };
  const switchVisual = (on) => (
    <span aria-hidden="true" style={{ width: 44, height: 26, borderRadius: radius.pill, background: on ? color.navy : color.line, position: 'relative', transition: 'background 0.2s', flexShrink: 0, display: 'block' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: radius.pill, background: color.surface, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(16,24,40,0.2)' }} />
    </span>
  );

  const checkIn = nextFriday();
  const example = stayPrice({ nightly, rules: r, checkIn, nights: 3, dogs: 2, pickup: num(r.pickup_fee_rupees) > 0 });
  const weekday = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' });
  const exampleRows = [
    [tr('host_exampleBase', { nights: 3, nightly }), example.base],
    [tr('host_exampleSurcharge'), example.surcharge],
    [tr('host_exampleExtraDog'), example.extraDogs],
    [tr('host_exampleLongStay'), -example.longStay],
    [tr('host_examplePickup'), example.pickup],
  ].filter(([, v]) => v);

  return (
    <div>
      {isBoarding && (
        <section aria-labelledby="host-pricing-title" style={card}>
          <h2 id="host-pricing-title" style={cardTitle}>{tr('host_pricingTitle')}</h2>
          <div style={{ ...sub, marginBottom: 12 }}>{tr('host_pricingHint', { n: nightly })}</div>
          {RULE_FIELDS.map((f, i) => {
            const id = 'host-rule-' + f.id;
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label htmlFor={id} style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{tr('host_rule_' + f.id)}</label>
                  <div style={{ fontSize: font.xs, color: color.muted, lineHeight: 1.4, marginTop: 2 }}>{tr('host_rule_' + f.id + 'Hint')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {f.unit === 'rupees' && <span aria-hidden="true" style={{ fontSize: font.sm, color: color.muted }}>{tr('host_unitRs')}</span>}
                  <input id={id} type="number" inputMode="numeric" min={0} max={f.max} value={r[f.id] ?? ''} placeholder="0"
                    onChange={e => setRule(f.id, e.target.value === '' ? '' : Math.min(f.max, Math.max(0, Math.round(Number(e.target.value)))))}
                    style={{ ...ui.input, width: 84, minHeight: 44, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} />
                  {f.unit !== 'rupees' && <span aria-hidden="true" style={{ fontSize: font.sm, color: color.muted, minWidth: 14 }}>{tr(f.unit === 'pct' ? 'host_unitPct' : 'host_unitNights')}</span>}
                </div>
              </div>
            );
          })}

          <div style={{ borderTop: `1px solid ${color.line}`, paddingTop: 12, marginTop: 4 }}>
            <div id="host-holidays-title" style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{tr('host_holidaysTitle')}</div>
            <div style={{ fontSize: font.xs, color: color.muted, lineHeight: 1.4, margin: '2px 0 10px' }}>{tr('host_holidaysHint')}</div>
            {holidays.length === 0 && <div style={{ ...sub, marginBottom: 10 }}>{tr('host_holidaysNone')}</div>}
            <ul aria-labelledby="host-holidays-title" style={{ listStyle: 'none', margin: '0 0 10px', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {holidays.map(d => (
                <li key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, background: color.tile, borderRadius: radius.pill, paddingLeft: 12, fontSize: font.sm, color: color.text, fontVariantNumeric: 'tabular-nums' }}>
                  {formatHoliday(d, locale)}
                  <button type="button" onClick={() => setRule('holidays', holidays.filter(x => x !== d))} aria-label={tr('host_holidayRemove', { date: formatHoliday(d, locale) })}
                    style={{ width: 44, height: 36, border: 'none', background: 'none', color: color.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <Icon name="close" size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label htmlFor="host-holiday-new" style={ui.label}>{tr('host_holidayAdd')}</label>
                <input id="host-holiday-new" type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} style={{ ...ui.input, minHeight: 44 }} />
              </div>
              <button type="button" onClick={addHoliday} disabled={!newHoliday} style={{ ...ui.secondaryButton, minHeight: 44, flexShrink: 0 }}>{tr('host_holidayAddButton')}</button>
            </div>
            <button type="button" onClick={() => setRule('holidays', upcomingHolidays())}
              style={{ minHeight: 44, marginTop: 6, padding: '0 4px', border: 'none', background: 'none', color: color.navy, fontSize: font.sm, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {tr('host_holidayReset')}
            </button>
          </div>

          <div role="status" aria-label={tr('host_exampleTitle')} style={{ background: color.navySoft, borderRadius: radius.md, padding: '12px 14px', marginTop: 8 }}>
            <div style={{ fontSize: font.xs, fontWeight: 600, color: color.muted }}>{tr('host_exampleTitle')}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{tr('host_exampleLine', { from: weekday(checkIn), to: weekday(addDays(checkIn, 3)), dogs: 2 })}</span>
              <span data-testid="host-example-total" style={{ fontSize: font.lg, fontWeight: 700, color: color.navy, fontVariantNumeric: 'tabular-nums' }}>Rs.{example.total.toLocaleString('en-IN')}</span>
            </div>
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
              {exampleRows.map(([label, v]) => (
                <li key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: font.sm, color: color.text, lineHeight: 1.7, fontVariantNumeric: 'tabular-nums' }}>
                  <span>{label}</span><span>{v < 0 ? '−' : ''}Rs.{Math.abs(v).toLocaleString('en-IN')}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-labelledby="host-policy-title" style={card}>
        <h2 id="host-policy-title" style={cardTitle}>{tr('host_policyTitle')}</h2>
        <div style={{ ...sub, marginBottom: 10 }}>{tr('host_policyHint')}</div>
        <div role="group" aria-labelledby="host-policy-title" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CANCELLATION_POLICIES.map(p => {
            const on = (policy || DEFAULT_POLICY) === p;
            return (
              <button key={p} type="button" aria-pressed={on} onClick={() => onChange({ policy: p })}
                style={{ width: '100%', minHeight: 56, fontFamily: 'inherit', textAlign: 'left', color: 'inherit', background: on ? color.navySoft : color.surface, border: `1.5px solid ${on ? color.navy : color.line}`, borderRadius: radius.md, padding: '10px 12px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: font.md, fontWeight: 600, color: color.ink }}>{tr('host_policy_' + p)}</span>
                  <span style={{ display: 'block', fontSize: font.sm, color: color.muted, marginTop: 2, lineHeight: 1.5 }}>{tr('host_policy_' + p + 'Desc')}</span>
                </span>
                {on && <Icon name="check" size={18} color={color.navy} style={{ marginTop: 2 }} />}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="host-options-title" style={card}>
        <h2 id="host-options-title" style={{ ...cardTitle, marginBottom: 2 }}>{tr('host_optionsTitle')}</h2>
        {[
          { key: 'instantBook', on: !!instantBook, label: 'host_instantBook', subKey: 'host_instantBookSub' },
          { key: 'requiresVaccination', on: !!requiresVaccination, label: 'host_requireVacc', subKey: 'host_requireVaccSub' },
        ].map((o, i) => (
          <button key={o.key} type="button" role="switch" aria-checked={o.on} aria-label={tr(o.label)} onClick={() => onChange({ [o.key]: !o.on })}
            style={{ width: '100%', fontFamily: 'inherit', textAlign: 'left', color: 'inherit', background: 'none', border: 'none', borderTop: i ? `1px solid ${color.line}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', minHeight: 44, cursor: 'pointer' }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: font.md, fontWeight: 600, color: color.ink }}>{tr(o.label)}</span>
              <span style={{ display: 'block', fontSize: font.sm, color: color.muted, marginTop: 2 }}>{tr(o.subKey)}</span>
            </span>
            {switchVisual(o.on)}
          </button>
        ))}
      </section>

      {isBoarding && (
        <section aria-labelledby="host-rules-title" style={card}>
          <h2 id="host-rules-title" style={cardTitle}>{tr('host_rulesTitle')}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: font.sm, color: color.navy, fontWeight: 600, marginBottom: 6 }}>
            <Icon name="shield" size={15} />{tr('host_rulesAccept')}
          </div>
          <div style={{ ...sub, color: houseRules ? color.text : color.muted, whiteSpace: 'pre-wrap' }}>{houseRules || tr('host_rulesMissing')}</div>
        </section>
      )}
    </div>
  );
}
