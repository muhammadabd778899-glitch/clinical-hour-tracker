import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  compareDateStr,
  daysBetween,
  endOfMonthIso,
  formatDisplayDate,
  isDateStr,
  isTimeStr,
  isWithinRange,
  startOfMonthIso,
  startOfWeekIso,
  todayIso,
} from './date';

describe('isDateStr', () => {
  it('accepts real calendar dates', () => {
    expect(isDateStr('2026-03-05')).toBe(true);
    expect(isDateStr('2024-02-29')).toBe(true); // leap year
  });

  it('rejects impossible or malformed dates', () => {
    expect(isDateStr('2026-02-31')).toBe(false);
    expect(isDateStr('2025-02-29')).toBe(false); // not a leap year
    expect(isDateStr('2026-3-5')).toBe(false);
    expect(isDateStr('05/03/2026')).toBe(false);
    expect(isDateStr('')).toBe(false);
  });
});

describe('isTimeStr', () => {
  it('accepts 24-hour times', () => {
    expect(isTimeStr('00:00')).toBe(true);
    expect(isTimeStr('23:59')).toBe(true);
  });

  it('rejects out-of-range times', () => {
    expect(isTimeStr('24:00')).toBe(false);
    expect(isTimeStr('12:60')).toBe(false);
    expect(isTimeStr('9:00')).toBe(false);
  });
});

describe('range helpers', () => {
  it('compares date strings lexicographically', () => {
    expect(compareDateStr('2026-01-01', '2026-01-02')).toBeLessThan(0);
    expect(compareDateStr('2026-01-02', '2026-01-01')).toBeGreaterThan(0);
    expect(compareDateStr('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('treats bounds as inclusive', () => {
    expect(isWithinRange('2026-03-05', '2026-03-01', '2026-03-31')).toBe(true);
    expect(isWithinRange('2026-03-01', '2026-03-01', '2026-03-31')).toBe(true);
    expect(isWithinRange('2026-03-31', '2026-03-01', '2026-03-31')).toBe(true);
    expect(isWithinRange('2026-02-28', '2026-03-01', '2026-03-31')).toBe(false);
    expect(isWithinRange('2026-04-01', '2026-03-01', '2026-03-31')).toBe(false);
  });

  it('ignores missing bounds', () => {
    expect(isWithinRange('2020-01-01', null, null)).toBe(true);
    expect(isWithinRange('2030-01-01', '2026-01-01', null)).toBe(true);
    expect(isWithinRange('2020-01-01', null, '2026-01-01')).toBe(true);
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-03-01', '2026-03-08')).toBe(7);
    expect(daysBetween('2026-03-08', '2026-03-01')).toBe(-7);
    expect(daysBetween('2026-03-01', '2026-03-01')).toBe(0);
  });
});

describe('calendar arithmetic', () => {
  it('adds days across month boundaries', () => {
    expect(addDaysIso('2026-03-30', 3)).toBe('2026-04-02');
    expect(addDaysIso('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('finds the Monday-based start of a week', () => {
    // 2026-03-05 is a Thursday → week starts Monday 2026-03-02.
    expect(startOfWeekIso('2026-03-05')).toBe('2026-03-02');
    // Sunday belongs to the week that started the previous Monday.
    expect(startOfWeekIso('2026-03-08')).toBe('2026-03-02');
  });

  it('finds month bounds', () => {
    expect(startOfMonthIso('2026-03-15')).toBe('2026-03-01');
    expect(endOfMonthIso('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonthIso('2024-02-10')).toBe('2024-02-29');
  });

  it('produces today as a local yyyy-MM-dd string', () => {
    const value = todayIso(new Date(2026, 2, 5, 23, 59));
    expect(value).toBe('2026-03-05');
  });
});

describe('formatDisplayDate', () => {
  it('formats valid dates and shows a dash for invalid input', () => {
    expect(formatDisplayDate('2026-03-05')).toBe('Mar 5, 2026');
    expect(formatDisplayDate('not-a-date')).toBe('—');
    expect(formatDisplayDate(null)).toBe('—');
  });
});
