import Dexie, { type EntityTable } from 'dexie';
import { LATEST_SCHEMA_VERSION, SCHEMA_V1, SCHEMA_V2, DB_NAME } from './schema';
import type {
  Activity,
  Category,
  CeURecord,
  MetaRow,
  RenewalPeriod,
  Requirement,
  SettingRow,
} from '@/domain/types';
import { newId } from '@/lib/id';
import { nowIso } from '@/domain/date';

export class ClinicalTrackerDB extends Dexie {
  activities!: EntityTable<Activity, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  requirements!: EntityTable<Requirement, 'id'>;
  renewalPeriods!: EntityTable<RenewalPeriod, 'id'>;
  ceus!: EntityTable<CeURecord, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name: string = DB_NAME) {
    super(name);
    // Version chain — add new versions below, never edit old ones.
    this.version(1).stores(SCHEMA_V1);
    this.version(2).stores(SCHEMA_V2);
  }
}

let instance: ClinicalTrackerDB | null = null;

/** Returns the shared database instance (opens the connection lazily). */
export function getDB(): ClinicalTrackerDB {
  if (!instance) instance = new ClinicalTrackerDB();
  return instance;
}

/** Replaces the shared instance (used by tests and restore flows). */
export function setDB(db: ClinicalTrackerDB | null): void {
  instance = db;
}

export function closeDB(): void {
  instance?.close();
  instance = null;
}

/** The default categories every new profile starts with. */
export function defaultCategories(): Category[] {
  const ts = nowIso();
  const base = [
    { label: 'Direct client work', kind: 'direct' as const, sortOrder: 10 },
    { label: 'Indirect work (documentation, planning)', kind: 'indirect' as const, sortOrder: 20 },
    { label: 'Individual supervision', kind: 'individual_supervision' as const, sortOrder: 30 },
    { label: 'Group supervision', kind: 'group_supervision' as const, sortOrder: 40 },
    { label: 'Other professional activity', kind: 'other' as const, sortOrder: 50 },
  ];
  return base.map((b) => ({
    id: newId(),
    label: b.label,
    kind: b.kind,
    active: true,
    sortOrder: b.sortOrder,
    createdAt: ts,
    updatedAt: ts,
  }));
}

/**
 * Opens the database, runs pending migrations and seeds the default
 * categories once. Safe to call multiple times.
 */
export async function initDatabase(db: ClinicalTrackerDB = getDB()): Promise<ClinicalTrackerDB> {
  await db.open();
  await db.transaction('rw', db.categories, db.meta, async () => {
    const seeded = await db.meta.get('seededCategories');
    if (!seeded) {
      const count = await db.categories.count();
      if (count === 0) await db.categories.bulkPut(defaultCategories());
      await db.meta.put({ key: 'seededCategories', value: true });
    }
    await db.meta.put({ key: 'schemaVersion', value: LATEST_SCHEMA_VERSION });
  });
  return db;
}

/** True when IndexedDB is usable in this browser/profile. */
export async function isStorageAvailable(): Promise<boolean> {
  try {
    if (typeof indexedDB === 'undefined') return false;
    const probe = new Dexie('storage-probe');
    probe.version(1).stores({ probe: 'id' });
    await probe.open();
    probe.close();
    await Dexie.delete('storage-probe');
    return true;
  } catch {
    return false;
  }
}

/** Rough usage estimate for the Settings page (best effort). */
export async function storageEstimate(): Promise<{ usage: number | null; quota: number | null }> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return { usage: est.usage ?? null, quota: est.quota ?? null };
    }
  } catch {
    /* fall through */
  }
  return { usage: null, quota: null };
}
