/**
 * Duration domain functions.
 * Minutes are the single canonical unit for every stored duration.
 */
import { isTimeStr } from './date';

export const MINUTES_PER_HOUR = 60;
export const MAX_DURATION_MINUTES = 24 * 60;

/**
 * Computes minutes between two `HH:mm` values.
 * Returns `null` when either value is invalid or the end is not after the start
 * (overnight activities are intentionally not supported).
 */
export function computeDurationMinutes(start: string, end: string): number | null {
  if (!isTimeStr(start) || !isTimeStr(end)) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (sh === undefined || sm === undefined || eh === undefined || em === undefined) return null;
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return minutes > 0 ? minutes : null;
}

/** Converts hours (may be fractional) to whole minutes. */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * MINUTES_PER_HOUR);
}

/** Converts whole minutes to hours (may be fractional). */
export function minutesToHours(minutes: number): number {
  return minutes / MINUTES_PER_HOUR;
}

/** True when a stored duration is valid. */
export function isValidDuration(minutes: number): boolean {
  return Number.isFinite(minutes) && Number.isInteger(minutes) && minutes > 0 && minutes <= MAX_DURATION_MINUTES;
}

/** Formats minutes as a friendly duration, e.g. `1h 30m`, `45m`. */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m';
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = Math.round(minutes % MINUTES_PER_HOUR);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Formats minutes as decimal hours for reports, e.g. `1.5`. */
export function formatHoursDecimal(minutes: number): string {
  return (minutes / MINUTES_PER_HOUR)
    .toFixed(2)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
}
