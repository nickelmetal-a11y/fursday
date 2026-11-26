import { isSitterAvailable, dayAvailability, slotForTime, weeklySlots, toISODate } from './AvailabilityCalendar';

// 2026-11-30 is a Monday, 2026-11-28 a Saturday.
const MON = '2026-11-30', SAT = '2026-11-28';
const weekdaySitter = { availability_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], morning_slot: true, afternoon_slot: false, evening_slot: true };

describe('slotForTime', () => {
  test.each([
    ['07:00 AM', 'morning'], ['7:00 AM', 'morning'], ['11:30 am', 'morning'], ['12:00 PM', 'afternoon'],
    ['2:00 PM', 'afternoon'], ['14:00', 'afternoon'], ['5:00 PM', 'evening'], ['19:30', 'evening'],
    ['12:00 AM', 'morning'], ['evening', 'evening'], ['Morning', 'morning'],
  ])('%s -> %s', (input, slot) => expect(slotForTime(input)).toBe(slot));

  test('unknown input gives null', () => {
    expect(slotForTime('')).toBeNull();
    expect(slotForTime('whenever')).toBeNull();
  });
});

describe('weeklySlots', () => {
  test('morning and evening default on, afternoon default off (same as the edit screen)', () => {
    expect(weeklySlots({})).toEqual(['morning', 'evening']);
    expect(weeklySlots({ morning_slot: false, afternoon_slot: true })).toEqual(['afternoon', 'evening']);
  });
});

describe('isSitterAvailable', () => {
  test('no row: the weekly days and slot flags decide', () => {
    expect(isSitterAvailable(weekdaySitter, [], MON)).toBe(true);
    expect(isSitterAvailable(weekdaySitter, [], MON, '07:00 AM')).toBe(true);
    expect(isSitterAvailable(weekdaySitter, [], MON, '2:00 PM')).toBe(false);
    expect(isSitterAvailable(weekdaySitter, [], MON, 'evening')).toBe(true);
    expect(isSitterAvailable(weekdaySitter, [], SAT)).toBe(false);
    expect(isSitterAvailable(weekdaySitter, [], SAT, 'morning')).toBe(false);
  });

  test('a blocked row wins over the weekly default', () => {
    const rows = [{ date: MON, is_available: false, time_slots: [] }];
    expect(isSitterAvailable(weekdaySitter, rows, MON)).toBe(false);
    expect(isSitterAvailable(weekdaySitter, rows, MON, 'morning')).toBe(false);
    expect(isSitterAvailable(weekdaySitter, rows, '2026-12-01', 'morning')).toBe(true);
  });

  test('a row with slots replaces the weekly slots, even on a weekly day off', () => {
    const rows = [{ date: SAT, is_available: true, time_slots: ['afternoon'] }];
    expect(isSitterAvailable(weekdaySitter, rows, SAT)).toBe(true);
    expect(isSitterAvailable(weekdaySitter, rows, SAT, '3:00 PM')).toBe(true);
    expect(isSitterAvailable(weekdaySitter, rows, SAT, '07:00 AM')).toBe(false);
  });

  test('a row with null slots keeps the weekly slots; an empty list means no slots', () => {
    expect(isSitterAvailable(weekdaySitter, [{ date: SAT, is_available: true, time_slots: null }], SAT, 'evening')).toBe(true);
    expect(isSitterAvailable(weekdaySitter, [{ date: MON, is_available: true, time_slots: [] }], MON)).toBe(false);
  });

  test('timestamp-style dates on rows still match the day', () => {
    expect(isSitterAvailable(weekdaySitter, [{ date: MON + 'T00:00:00', is_available: false }], MON)).toBe(false);
  });

  test('a sitter without weekly days set is open every day; no date means no', () => {
    expect(isSitterAvailable({}, [], SAT, 'morning')).toBe(true);
    expect(isSitterAvailable(weekdaySitter, [], null)).toBe(false);
  });

  test('an unrecognised time only checks the day', () => {
    expect(isSitterAvailable(weekdaySitter, [], MON, 'flexible')).toBe(true);
    expect(isSitterAvailable(weekdaySitter, [], SAT, 'flexible')).toBe(false);
  });
});

describe('dayAvailability', () => {
  test('reports where the answer came from', () => {
    expect(dayAvailability(weekdaySitter, [], MON)).toEqual({ available: true, slots: ['morning', 'evening'], source: 'weekly' });
    expect(dayAvailability(weekdaySitter, [{ date: MON, is_available: false }], MON).source).toBe('override');
  });

  test('toISODate uses the local calendar day', () => {
    expect(toISODate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
