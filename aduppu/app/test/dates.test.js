import { describe, it, expect } from 'vitest';
import { localDateStr, addDays, weekDates, dayLabel } from '../src/lib/dates.js';

describe('localDateStr', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = localDateStr(new Date(2025, 6, 9)); // July 9, 2025
    expect(result).toBe('2025-07-09');
  });

  it('zero-pads single-digit months and days', () => {
    const result = localDateStr(new Date(2025, 0, 5)); // Jan 5, 2025
    expect(result).toBe('2025-01-05');
  });

  it('uses local time, not UTC (a date at 00:30 IST = previous day UTC)', () => {
    // Create a Date that is 00:30 on July 9 local time.
    // If the implementation were using toISOString (UTC), this could return
    // the previous day. localDateStr must use getFullYear/getMonth/getDate.
    const d = new Date(2025, 6, 9, 0, 30, 0); // July 9, 00:30 local
    const result = localDateStr(d);
    expect(result).toBe('2025-07-09');
  });

  it('defaults to current date when called without arguments', () => {
    const result = localDateStr();
    // Should match the current local date
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });
});

describe('addDays', () => {
  it('adds positive days correctly', () => {
    expect(addDays('2025-07-09', 3)).toBe('2025-07-12');
  });

  it('adds negative days correctly', () => {
    expect(addDays('2025-07-09', -2)).toBe('2025-07-07');
  });

  it('crosses month boundaries', () => {
    expect(addDays('2025-07-30', 3)).toBe('2025-08-02');
  });

  it('crosses year boundaries', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
  });

  it('adding zero returns the same date', () => {
    expect(addDays('2025-07-09', 0)).toBe('2025-07-09');
  });
});

describe('weekDates', () => {
  it('returns 7 dates starting from Monday', () => {
    // July 9, 2025 is a Wednesday
    const dates = weekDates('2025-07-09');
    expect(dates).toHaveLength(7);
    // Monday of that week is July 7
    expect(dates[0]).toBe('2025-07-07');
    // Sunday is July 13
    expect(dates[6]).toBe('2025-07-13');
  });

  it('contains the anchor date', () => {
    const anchor = '2025-07-09';
    const dates = weekDates(anchor);
    expect(dates).toContain(anchor);
  });

  it('handles Monday as anchor (Mon is first)', () => {
    // July 7, 2025 is a Monday
    const dates = weekDates('2025-07-07');
    expect(dates[0]).toBe('2025-07-07');
    expect(dates[6]).toBe('2025-07-13');
  });

  it('handles Sunday as anchor (Sun is last)', () => {
    // July 13, 2025 is a Sunday
    const dates = weekDates('2025-07-13');
    expect(dates[0]).toBe('2025-07-07');
    expect(dates[6]).toBe('2025-07-13');
  });

  it('week crossing month boundary', () => {
    // June 30, 2025 is a Monday
    const dates = weekDates('2025-07-02'); // Wednesday
    expect(dates[0]).toBe('2025-06-30');
    expect(dates[6]).toBe('2025-07-06');
  });
});

describe('dayLabel', () => {
  it('returns "Today" for today\'s date', () => {
    const today = localDateStr();
    expect(dayLabel(today)).toBe('Today');
  });

  it('returns "Yesterday" for yesterday\'s date', () => {
    const yesterday = addDays(localDateStr(), -1);
    expect(dayLabel(yesterday)).toBe('Yesterday');
  });

  it('returns "Tomorrow" for tomorrow\'s date', () => {
    const tomorrow = addDays(localDateStr(), 1);
    expect(dayLabel(tomorrow)).toBe('Tomorrow');
  });

  it('returns weekday name for dates within the same week (2-6 days away)', () => {
    const target = addDays(localDateStr(), 3);
    const result = dayLabel(target);
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    expect(weekdays).toContain(result);
  });

  it('returns formatted date for older dates (> 6 days away)', () => {
    const farDate = addDays(localDateStr(), -14);
    const result = dayLabel(farDate);
    // Should be in 'D Mon' format like '25 Jun'
    expect(result).toMatch(/^\d{1,2} \w{3}$/);
  });

  it('returns formatted date for future dates (> 6 days away)', () => {
    const farDate = addDays(localDateStr(), 14);
    const result = dayLabel(farDate);
    expect(result).toMatch(/^\d{1,2} \w{3}$/);
  });
});
