/**
 * Core domain types.
 *
 * Conventions (see docs/DATA_MODEL.md):
 * - Durations are stored in canonical MINUTES.
 * - Dates are stored as local calendar dates in `yyyy-MM-dd` strings.
 * - Times are stored as local wall-clock times in `HH:mm` strings.
 * - Timestamps (createdAt / updatedAt) are ISO-8601 UTC strings.
 */

export type ActivityType = 'clinical' | 'supervision' | 'other';

/**
 * Classification buckets. Categories map onto a bucket; activities reference a
 * category, and the category bucket decides how the activity is summarised.
 */
export type ActivityCategoryKind =
  | 'direct'
  | 'indirect'
  | 'individual_supervision'
  | 'group_supervision'
  | 'other';

export interface Activity {
  id: string;
  type: ActivityType;
  /** Reference to a Category. `null` means "not classified yet". */
  categoryId: string | null;
  title: string;
  /** Local calendar date, `yyyy-MM-dd`. */
  date: string;
  /** Local wall-clock start time, `HH:mm`. Optional. */
  startTime: string | null;
  /** Local wall-clock end time, `HH:mm`. Optional. */
  endTime: string | null;
  /** Canonical duration in minutes. Must be > 0. */
  durationMinutes: number;
  location: string | null;
  /** Free text. Users must NOT record patient-identifying information. */
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  label: string;
  kind: ActivityCategoryKind;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type RequirementKind =
  | 'clinical_total'
  | 'direct'
  | 'indirect'
  | 'supervision_total'
  | 'individual_supervision'
  | 'group_supervision'
  | 'custom_category';

export interface Requirement {
  id: string;
  label: string;
  kind: RequirementKind;
  /** For `custom_category` requirements the progress is measured on this category. */
  categoryId: string | null;
  /** Target expressed in minutes. */
  targetMinutes: number;
  /** Optional configured period (local calendar dates). */
  periodStart: string | null;
  periodEnd: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RenewalPeriod {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  /** Target CEU credits for the period. */
  targetCredits: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CeURecord {
  id: string;
  title: string;
  provider: string;
  /** Local calendar date the activity was completed, `yyyy-MM-dd`. */
  completionDate: string;
  credits: number;
  category: string;
  renewalPeriodId: string | null;
  certificateRef: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

/** Bucket used by summarisation functions. */
export type SummaryBucket =
  | 'direct'
  | 'indirect'
  | 'individual_supervision'
  | 'group_supervision'
  | 'other';

export interface AppSettings {
  /** First-run onboarding completed. */
  onboarded: boolean;
  displayName: string;
  profession: string;
  /**
   * When true, supervision minutes are added to the "total clinical hours"
   * bucket. Default false: clinical total = direct + indirect.
   */
  includeSupervisionInClinicalTotal: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  onboarded: false,
  displayName: '',
  profession: '',
  includeSupervisionInClinicalTotal: false,
};

export interface BackupMeta {
  key: string;
  value: unknown;
}
