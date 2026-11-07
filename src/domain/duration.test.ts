import { describe, expect, it } from 'vitest';
import {
  computeDurationMinutes,
  formatDuration,
  formatHoursDecimal,
  hoursToMinutes,
  isValidDuration,
  MAX_DURATION_MINUTES,
} from './duration';

describe('computeDurationMinutes', () => {
  it('computes a normal range', () => {
    expect(computeDurationMinutes('09:00', '10:30')).toBe(90);
  });

  it('computes same-hour ranges', () => {
    expect(computeDurationMinutes('14:05', '14:45')).toBe(40);
  });

  it('rejects an end time equal to the start time', () => {
    expect(computeDurationMinutes('09:00', '09:00')).toBeNull();
  });

  it('rejects an end time before the start time (no overnight support)', () => {
    expect(computeDurationMinutes('09:00', '08:00')).toBeNull();
  });

  it('rejects malformed times', () => {
    expect(computeDurationMinutes('9:00', '10:00')).toBeNull();
    expect(computeDurationMinutes('09:60', '10:00')).toBeNull();
    expect(computeDurationMinutes('', '10:00')).toBeNull();
    expect(computeDurationMinutes('24:00', '25:00')).toBeNull();
  });
});

describe('hoursToMinutes / formatDuration', () => {
  it('converts fractional hours to whole minutes', () => {
    expect(hoursToMinutes(1.5)).toBe(90);
    expect(hoursToMinutes(0.25)).toBe(15);
    expect(hoursToMinutes(2)).toBe(120);
  });

  it('formats durations for display', () => {
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(-10)).toBe('0m');
  });

  it('formats decimal hours for reports', () => {
    expect(formatHoursDecimal(90)).toBe('1.5');
    expect(formatHoursDecimal(120)).toBe('2');
    expect(formatHoursDecimal(0)).toBe('0');
  });
});

describe('isValidDuration', () => {
  it('accepts positive whole minutes up to 24h', () => {
    expect(isValidDuration(1)).toBe(true);
    expect(isValidDuration(1440)).toBe(true);
    expect(isValidDuration(MAX_DURATION_MINUTES)).toBe(true);
  });

  it('rejects zero, negatives, fractions and huge values', () => {
    expect(isValidDuration(0)).toBe(false);
    expect(isValidDuration(-30)).toBe(false);
    expect(isValidDuration(12.5)).toBe(false);
    expect(isValidDuration(1441)).toBe(false);
    expect(isValidDuration(Number.NaN)).toBe(false);
  });
});
