/** CSV and file-download helpers for the Report Studio. */
import type { ReportResult } from '@/domain/reports';
import { formatHoursDecimal } from '@/domain/duration';

/** Escapes a CSV cell and neutralises spreadsheet formula injection. */
export function csvCell(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@]/.test(str)) str = `'${str}`;
  if (/[",\n\r]/.test(str)) str = `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function reportToCsv(report: ReportResult, filterDescription: string): string {
  const lines: string[] = [];
  lines.push([csvCell('Report'), csvCell(report.title)].join(','));
  lines.push([csvCell('Generated'), csvCell(report.generatedAt)].join(','));
  lines.push([csvCell('Filters'), csvCell(filterDescription)].join(','));
  lines.push([csvCell('Scope'), csvCell('Local data only — not a regulatory record')].join(','));
  lines.push('');
  lines.push(
    [
      csvCell('Item'),
      csvCell('Records'),
      csvCell('Hours'),
      csvCell('Minutes'),
      csvCell('CEU credits'),
      csvCell('Target hours'),
      csvCell('Progress %'),
    ].join(','),
  );
  for (const r of report.rows) {
    lines.push(
      [
        csvCell(r.label),
        csvCell(r.count),
        csvCell(r.minutes > 0 ? formatHoursDecimal(r.minutes) : ''),
        csvCell(r.minutes > 0 ? r.minutes : ''),
        csvCell(r.credits > 0 ? r.credits : ''),
        csvCell(r.targetMinutes !== null ? formatHoursDecimal(r.targetMinutes) : ''),
        csvCell(r.percent !== null ? r.percent : ''),
      ].join(','),
    );
  }
  lines.push('');
  lines.push(
    [
      csvCell('Totals'),
      csvCell(report.totals.count),
      csvCell(report.totals.hours),
      csvCell(report.totals.minutes),
      csvCell(report.totals.credits > 0 ? report.totals.credits : ''),
      csvCell(''),
      csvCell(''),
    ].join(','),
  );
  // BOM so Excel opens UTF-8 correctly.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** Triggers a browser download of the given content. */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(filename: string, report: ReportResult, filterDescription: string): void {
  downloadTextFile(filename, reportToCsv(report, filterDescription), 'text/csv');
}

export function downloadJson(filename: string, data: unknown): void {
  downloadTextFile(filename, JSON.stringify(data, null, 2), 'application/json');
}

/** File-safe timestamp for export names, e.g. `2026-03-05-1430`. */
export function fileTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}
