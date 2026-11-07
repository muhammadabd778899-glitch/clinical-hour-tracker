/**
 * Versioned IndexedDB schema definitions.
 * Each key is a Dexie index definition. Migrations are declared in database.ts.
 */
export const DB_NAME = 'clinical-hour-tracker';

/** v1 — initial schema. */
export const SCHEMA_V1: Record<string, string> = {
  activities: 'id, date, type, categoryId, createdAt, updatedAt',
  categories: 'id, kind, active, sortOrder',
  requirements: 'id, kind, active, createdAt',
  renewalPeriods: 'id, startDate, endDate, active',
  ceus: 'id, completionDate, createdAt',
  settings: 'key',
  meta: 'key',
};

/**
 * v2 — adds lookup indexes used by the CEU tracker filters.
 * Existing rows are preserved; Dexie only adds the indexes.
 */
export const SCHEMA_V2: Record<string, string> = {
  ...SCHEMA_V1,
  ceus: 'id, completionDate, renewalPeriodId, category, createdAt',
};

/** Latest schema version — keep in sync with the version chain in database.ts. */
export const LATEST_SCHEMA_VERSION = 2;
