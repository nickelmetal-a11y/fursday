import { priceFor, cleanRules, stayNights } from './pricing';
import { stayPrice } from './HostSettings';

// 2026-12-02 is a Wednesday, so nights Wed, Thu, Fri, Sat, Sun follow.
const WED = '2026-12-02';
const sum = (lines) => lines.reduce((a, l) => a + l.amount, 0);
const line = (res, label) => res.lines.find(l => l.label === label);

describe('priceFor: night services', () => {
  test('plain stay is nights × base price', () => {
    const res = priceFor({ service: 'boarding', basePriceRupees: 1000, startDate: WED, nights: 2 });
    expect(res.total).toBe(2000);
    expect(res.lines).toEqual([{ label: 'pricing_nightsLine', amount: 2000, vars: { n: 2, price: 1000 } }]);
  });

  test('weekend surcharge applies to Friday and Saturday nights only', () => {
    const res = priceFor({ service: 'boarding', basePriceRupees: 1000, startDate: WED, nights: 5, rules: { weekend_pct: 20 } });
    expect(line(res, 'pricing_weekendLine').amount).toBe(400);
    expect(res.total).toBe(5400);
  });

  test('a Sunday-only stay gets no weekend surcharge', () => {
    const res = priceFor({ service: 'boarding', basePriceRupees: 1000, startDate: '2026-12-06', nights: 1, rules: { weekend_pct: 50 } });
    expect(res.total).toBe(1000);
  });

  test('holiday surcharge replaces (does not stack with) the weekend one', () => {
    const res = priceFor({ service: 'housesit', basePriceRupees: 1000, startDate: WED, nights: 4, rules: { weekend_pct: 20, holiday_pct: 50, holidays: ['2026-12-04', '2026-12-03'] } });
    expect(line(res, 'pricing_holidayLine').amount).toBe(1000);
    expect(line(res, 'pricing_weekendLine').amount).toBe(200);
    expect(res.total).toBe(5200);
  });

  test('long stay discount comes off the night total, surcharges included', () => {
    const res = priceFor({ service: 'boarding', basePriceRupees: 1000, startDate: WED, nights: 7, rules: { weekend_pct: 10, long_stay_nights: 7, long_stay_pct: 10 } });
    expect(line(res, 'pricing_longStayLine').amount).toBe(-720);
    expect(res.total).toBe(6480);
  });

  test('long stay discount needs the minimum number of nights', () => {
    const res = priceFor({ service: 'boarding', basePriceRupees: 1000, startDate: WED, nights: 6, rules: { long_stay_nights: 7, long_stay_pct: 10 } });
    expect(line(res, 'pricing_longStayLine')).toBeUndefined();
    expect(res.total).toBe(6000);
  });

  test('second and further dogs get extra_dog_pct off their share', () => {
    const res = priceFor({ service: 'boarding', basePriceRupees: 1000, startDate: WED, nights: 2, dogs: 3, rules: { extra_dog_pct: 25 } });
    expect(line(res, 'pricing_extraDogsDiscountLine')).toMatchObject({ amount: 3000, vars: { n: 2, pct: 25 } });
    expect(res.total).toBe(5000);
  });

  test('extra dogs without a rule pay the full share', () => {
    const res = priceFor({ service: 'boarding', basePriceRupees: 800, startDate: WED, nights: 1, dogs: 2 });
    expect(line(res, 'pricing_extraDogsLine').amount).toBe(800);
    expect(res.total).toBe(1600);
  });

  test('puppy extra is per puppy per booking, pickup is once', () => {
    const res = priceFor({ service: 'boarding', basePriceRupees: 1000, startDate: WED, nights: 3, dogs: 2, puppies: 2, pickup: true, rules: { puppy_extra_rupees: 150, pickup_fee_rupees: 200 } });
    expect(line(res, 'pricing_puppyLine').amount).toBe(300);
    expect(line(res, 'pricing_pickupLine').amount).toBe(200);
    expect(res.total).toBe(6000 + 300 + 200);
  });

  test('no pickup fee unless pickup is chosen', () => {
    const res = priceFor({ service: 'boarding', basePriceRupees: 1000, startDate: WED, nights: 1, rules: { pickup_fee_rupees: 200 } });
    expect(res.total).toBe(1000);
  });

  test('the total always equals the sum of the lines', () => {
    const res = priceFor({ service: 'boarding', basePriceRupees: 999, startDate: WED, nights: 9, dogs: 2, puppies: 1, pickup: true, rules: { weekend_pct: 15, holiday_pct: 40, holidays: ['2026-12-05'], long_stay_nights: 7, long_stay_pct: 12, extra_dog_pct: 30, puppy_extra_rupees: 99, pickup_fee_rupees: 149 } });
    expect(res.total).toBe(sum(res.lines));
    res.lines.forEach(l => expect(Number.isInteger(l.amount)).toBe(true));
  });

  test('accepts a Date as the start', () => {
    const res = priceFor({ service: 'boarding', basePriceRupees: 1000, startDate: new Date(2026, 11, 4), nights: 1, rules: { weekend_pct: 10 } });
    expect(res.total).toBe(1100);
  });
});

describe('priceFor: visits', () => {
  test('a walk is the base price, with the dog multiplier and no night rules', () => {
    const res = priceFor({ service: 'walk30', basePriceRupees: 400, startDate: '2026-12-04', dogs: 2, rules: { weekend_pct: 50, long_stay_nights: 1, long_stay_pct: 50, extra_dog_pct: 50 } });
    expect(res.lines.map(l => l.label)).toEqual(['pricing_visitLine', 'pricing_extraDogsDiscountLine']);
    expect(res.total).toBe(600);
  });

  test('daycare with one dog is just the base price', () => {
    expect(priceFor({ service: 'daycare', basePriceRupees: 649 }).total).toBe(649);
  });

  test('a meet & greet is free whatever the rules say', () => {
    expect(priceFor({ service: 'meet_greet', basePriceRupees: 500, dogs: 3, rules: { pickup_fee_rupees: 100 }, pickup: true })).toEqual({ total: 0, lines: [] });
  });
});

describe('rule cleaning', () => {
  test('ignores junk and negatives, caps percentages', () => {
    expect(cleanRules({ weekend_pct: 'abc', holiday_pct: -5, long_stay_pct: 150, extra_dog_pct: 120, holidays: 'x' })).toMatchObject({ weekend_pct: 0, holiday_pct: 0, long_stay_pct: 100, extra_dog_pct: 100, holidays: [] });
    expect(cleanRules(null).weekend_pct).toBe(0);
  });

  test('a 100% extra-dog discount makes extra dogs free, never negative', () => {
    const res = priceFor({ service: 'walk30', basePriceRupees: 400, dogs: 2, rules: { extra_dog_pct: 100 } });
    expect(res.total).toBe(400);
  });

  test('dogs default to one; puppy extra counts each puppy', () => {
    const res = priceFor({ service: 'walk30', basePriceRupees: 300, dogs: 0, puppies: 2, rules: { puppy_extra_rupees: 50 } });
    expect(res.total).toBe(400);
  });

  test('stayNights lists each night date', () => {
    expect(stayNights('2026-12-31', 2).map(d => d.getDate())).toEqual([31, 1]);
    expect(stayNights(null, 2)).toEqual([]);
  });
});

describe("matches the host's preview (HostSettings stayPrice)", () => {
  test('the host worked example: Rs.6,328', () => {
    const rules = { weekend_pct: 20, holiday_pct: 50, holidays: ['2027-01-01'], extra_dog_pct: 25, long_stay_nights: 3, long_stay_pct: 10, puppy_extra_rupees: 200, pickup_fee_rupees: 300 };
    const res = priceFor({ service: 'boarding', basePriceRupees: 1000, startDate: '2027-01-01', nights: 3, dogs: 2, puppies: 1, pickup: true, rules });
    expect(res.total).toBe(6328);
    expect(res.total).toBe(sum(res.lines));
    expect(line(res, 'pricing_holidayLine').amount).toBe(500);
    expect(line(res, 'pricing_weekendLine').amount).toBe(200);
  });

  test('agrees with stayPrice on many combinations', () => {
    const ruleSets = [
      {},
      { weekend_pct: 15 },
      { weekend_pct: 20, holiday_pct: 10, holidays: ['2026-12-04', '2026-12-25'] },
      { holiday_pct: 35, holidays: ['2026-12-05', '2026-12-31', '2027-01-01'], extra_dog_pct: 33 },
      { long_stay_nights: 5, long_stay_pct: 12.5, extra_dog_pct: 40, puppy_extra_rupees: 175, pickup_fee_rupees: 249 },
      { weekend_pct: 17, holiday_pct: 23, holidays: ['2026-12-26'], long_stay_nights: 2, long_stay_pct: 7, extra_dog_pct: 13, puppy_extra_rupees: 99, pickup_fee_rupees: 149 },
    ];
    const starts = ['2026-12-01', '2026-12-04', '2026-12-24', '2026-12-30'];
    let checked = 0;
    for (const rules of ruleSets) for (const checkIn of starts) for (const nights of [1, 2, 5, 9]) for (const dogs of [1, 2, 3]) for (const nightly of [799, 1000, 1234]) {
      const puppies = dogs > 1 ? 1 : 0, pickup = nights % 2 === 1;
      const ours = priceFor({ service: 'boarding', basePriceRupees: nightly, startDate: checkIn, nights, dogs, puppies, pickup, rules });
      expect(ours.total).toBe(stayPrice({ nightly, rules, checkIn, nights, dogs, puppies, pickup }).total);
      expect(sum(ours.lines)).toBe(ours.total);
      checked++;
    }
    expect(checked).toBe(864);
  });
});
