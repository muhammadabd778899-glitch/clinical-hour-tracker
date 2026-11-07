/**
 * Repository layer — the only code that talks to IndexedDB tables.
 * UI components and pages never touch Dexie directly; they call services,
 * which call repositories, which validate with Zod before writing.
 */
import type { InsertType, Table } from 'dexie';
import { getDB, type ClinicalTrackerDB } from '@/db/database';
import type {
  Activity,
  Category,
  CeURecord,
  MetaRow,
  RenewalPeriod,
  Requirement,
  SettingRow,
} from '@/domain/types';

export type Db = ClinicalTrackerDB;

function dbOr(base?: Db): Db {
  return base ?? getDB();
}

/** All entities use a string primary key supplied by the service layer. */
type RepoTable<T extends { id: string }> = Table<T, string, InsertType<T, 'id'>>;

/** Generic CRUD used by each typed repository. */
function repo<T extends { id: string }>(select: (db: Db) => RepoTable<T>) {
  return {
    list: async (base?: Db): Promise<T[]> => (await select(dbOr(base)).toArray()).slice(),
    getById: async (id: string, base?: Db): Promise<T | undefined> =>
      (await select(dbOr(base)).get(id)) ?? undefined,
    put: async (record: T, base?: Db): Promise<void> => {
      await select(dbOr(base)).put(record);
    },
    putMany: async (records: T[], base?: Db): Promise<void> => {
      await select(dbOr(base)).bulkPut(records);
    },
    remove: async (id: string, base?: Db): Promise<void> => {
      await select(dbOr(base)).delete(id);
    },
    clear: async (base?: Db): Promise<void> => {
      await select(dbOr(base)).clear();
    },
    count: async (base?: Db): Promise<number> => select(dbOr(base)).count(),
  };
}

/* ----------------------------- Activities ----------------------------- */

export const activityRepository = {
  ...repo<Activity>((db) => db.activities),
  listByDateRange: async (start: string, end: string, base?: Db): Promise<Activity[]> =>
    dbOr(base)
      .activities.where('date')
      .between(start, end, true, true)
      .toArray(),
  listByType: async (type: Activity['type'], base?: Db): Promise<Activity[]> =>
    dbOr(base).activities.where('type').equals(type).toArray(),
};

/* ------------------------------ Categories ---------------------------- */

export const categoryRepository = {
  ...repo<Category>((db) => db.categories),
  listActive: async (base?: Db): Promise<Category[]> => {
    const all = await dbOr(base).categories.toArray();
    return all.filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder);
  },
};

/* ----------------------------- Requirements --------------------------- */

export const requirementRepository = {
  ...repo<Requirement>((db) => db.requirements),
  listActive: async (base?: Db): Promise<Requirement[]> => {
    const all = await dbOr(base).requirements.toArray();
    return all.filter((r) => r.active);
  },
};

/* --------------------------- Renewal periods -------------------------- */

export const renewalPeriodRepository = {
  ...repo<RenewalPeriod>((db) => db.renewalPeriods),
  listActive: async (base?: Db): Promise<RenewalPeriod[]> => {
    const all = await dbOr(base).renewalPeriods.toArray();
    return all.filter((r) => r.active);
  },
};

/* ------------------------------- CEUs --------------------------------- */

export const ceuRepository = {
  ...repo<CeURecord>((db) => db.ceus),
  listByPeriod: async (periodId: string, base?: Db): Promise<CeURecord[]> =>
    dbOr(base).ceus.where('renewalPeriodId').equals(periodId).toArray(),
};

/* ------------------------------- Settings ----------------------------- */

export const settingsRepository = {
  get: async <T>(key: string, fallback: T, base?: Db): Promise<T> => {
    const row = await dbOr(base).settings.get(key);
    return row === undefined ? fallback : (row.value as T);
  },
  set: async (key: string, value: unknown, base?: Db): Promise<void> => {
    await dbOr(base).settings.put({ key, value });
  },
  getAll: async (base?: Db): Promise<SettingRow[]> => dbOr(base).settings.toArray(),
};

/* -------------------------------- Meta -------------------------------- */

export const metaRepository = {
  get: async <T>(key: string, fallback: T, base?: Db): Promise<T> => {
    const row = await dbOr(base).meta.get(key);
    return row === undefined ? fallback : (row.value as T);
  },
  set: async (key: string, value: unknown, base?: Db): Promise<void> => {
    await dbOr(base).meta.put({ key, value } satisfies MetaRow);
  },
};
