/**
 * Date & time helpers.
 *
 * Strategy (documented in docs/DOMAIN_RULES.md):
 * - Calendar dates are stored as local `yyyy-MM-dd` strings and parsed at
 *   local midnight, so a record never drifts across time zones.
 * - Wall-clock times are stored as `HH:mm` strings.
 * - createdAt / updatedAt are ISO-8601 UTC strings (instant timestamps).
 * - Dates are never parsed with `new Date(string)` for display purposes.
 */
import { format, isValid, parseISO } from 'date-fns';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isDateStr(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = parseLocalDate(value);
  // Rejects 2026-02-31 style values because parseISO normalises them.
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value;
}

export function isTimeStr(value: string): boolean {
  return TIME_RE.test(value);
}

/** Parses a `yyyy-MM-dd` string into a local Date at 00:00. */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`Invalid date string: ${value}`);
  }
  return new Date(y, m - 1, d);
}

/** Formats a `yyyy-MM-dd` string for display, e.g. `Mar 5, 2026`. */
export function formatDisplayDate(value: string | null | undefined): string {
  if (!value || !isDateStr(value)) return '—';
  return format(parseLocalDate(value), 'MMM d, yyyy');
}

/** Formats a `yyyy-MM-dd` string for compact display, e.g. `Mar 5`. */
export function formatShortDate(value: string | null | undefined): string {
  if (!value || !isDateStr(value)) return '—';
  return format(parseLocalDate(value), 'MMM d');
}

/** Today's local calendar date as `yyyy-MM-dd`. */
export function todayIso(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}

/** Compares two `yyyy-MM-dd` strings (`<0`, `0`, `>0`). */
export function compareDateStr(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** True when `date` falls inside [start, end] (inclusive), ignoring null bounds. */
export function isWithinRange(
  date: string,
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  if (start && compareDateStr(date, start) < 0) return false;
  if (end && compareDateStr(date, end) > 0) return false;
  return true;
}

/** Returns the number of days from `start` to `end` (positive when end is later). */
export function daysBetween(start: string, end: string): number {
  const ms = parseLocalDate(end).getTime() - parseLocalDate(start).getTime();
  return Math.round(ms / 86_400_000);
}

/** Adds `days` to a `yyyy-MM-dd` string. */
export function addDaysIso(date: string, days: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return format(d, 'yyyy-MM-dd');
}

/** Start of the week (Monday) for a `yyyy-MM-dd` string. */
export function startOfWeekIso(date: string): string {
  const d = parseLocalDate(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return format(d, 'yyyy-MM-dd');
}

/** First day of the month for a `yyyy-MM-dd` string. */
export function startOfMonthIso(date: string): string {
  const d = parseLocalDate(date);
  d.setDate(1);
  return format(d, 'yyyy-MM-dd');
}

/** Last day of the month for a `yyyy-MM-dd` string. */
export function endOfMonthIso(date: string): string {
  const d = parseLocalDate(date);
  d.setMonth(d.getMonth() + 1, 0);
  return format(d, 'yyyy-MM-dd');
}

/** ISO-8601 UTC timestamp for created/updated fields. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Reads an ISO timestamp safely; returns null when unparseable. */
export function parseIsoTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

/** Formats an ISO timestamp for display in local time. */
export function formatTimestamp(value: string | null | undefined): string {
  const d = parseIsoTimestamp(value);
  if (!d) return '—';
  return format(d, 'MMM d, yyyy h:mm a');
}
