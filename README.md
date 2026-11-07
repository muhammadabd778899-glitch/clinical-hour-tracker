# All in One Clinical Tracker

A private, **offline-first** progressive web app for tracking clinical hours, supervision,
CEUs, targets and career milestones. Everything is stored in the browser on the device you
use — there is no account, no server and no cloud sync.

> This is a personal progress tracker. It is **not** a medical record system, **not** a
> compliance tool and **not** a licensing authority. Only your program or licensing board
> can confirm that you have met a requirement.

## Features

| Area | What it does |
| --- | --- |
| Overview | Totals for clinical hours, supervision, CEU credits and record quality, plus an 8-week chart, journey map and upcoming deadlines |
| Activity Log | Full entry form, one-step quick add, search, type/category/date filters, sorting and running totals |
| Activity detail | Loads by stable id (`#/activities/:id`) with loading, not-found, edit and delete states |
| Requirements | User-defined targets (total clinical, direct, indirect, supervision, custom category) with optional periods — no hard-coded licensure rules |
| CEU Tracker | CEU records with providers, credits, categories and renewal periods. **CEUs never count toward clinical hours** |
| Calendar | Month view of logged activity |
| Report Studio | Summary tables and CSV export for the records you have |
| Record Quality Check | Flags missing dates, mismatched durations and other inconsistencies so you can fix them |
| Settings & Help | Profile, supervision-in-total preference, backup/restore, storage info, erase-all |
| PWA | Installable, works fully offline after the first load, horizontal top navigation with a mobile “More” menu |

## Getting started

```bash
npm install          # installs dependencies
npm run dev          # development server on http://localhost:5173
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build locally
```

## Tests

```bash
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (strict, no implicit any)
npm test             # Vitest + Testing Library (unit and component tests)
npm run test:e2e     # Playwright end-to-end tests (desktop + mobile viewports)
```

The first `npm run test:e2e` needs browsers:

```bash
npx playwright install chromium
```

End-to-end coverage includes onboarding, activity create/edit/delete, detail-page refresh
by id, filters, backup download → erase → restore, merge restore, invalid backup rejection,
desktop and mobile navigation, and offline operation through the service worker.

## Architecture

```
src/
  domain/        Pure calculations: durations, summaries, progress, CEU periods, quality, reports
  validation/    Zod schemas — the single gate for every record that is written or imported
  db/            Dexie schema, migrations, seeding, storage probe
  repositories/  The only code that talks to IndexedDB
  services/      Business logic: activities, CEUs, requirements, settings, backup, export, maintenance
  hooks/         React data hooks (live queries)
  components/    Layout, feature forms and UI primitives
  pages/         Route components
tests/e2e/       Playwright specs
```

Rules the code follows:

- **Minutes are the only stored duration unit**; dates are local `yyyy-MM-dd` strings.
- **UI never touches IndexedDB** — pages call services, services call repositories,
  repositories validate with Zod before writing.
- Strict TypeScript: no `any`, no duplicated calculations (every total comes from `domain/`).
- CEU credits and clinical hours are separate totals and are never mixed.

## Backup and restore

Your records live only in this browser. From **Settings & Help** you can:

- **Download a full backup (JSON)** — a versioned file containing every record and setting.
- **Restore** — choose *Replace everything* or *Merge with existing data*. A preview shows
  exactly what will be written before anything changes, and the restore runs in a single
  transaction: if it fails, your existing data is untouched.

See [docs/backup-and-restore.md](docs/backup-and-restore.md).

## Deployment (GitHub Pages)

Two workflows are included:

- `.github/workflows/ci.yml` — lint, typecheck, unit tests, build and Playwright e2e on
  every push and pull request.
- `.github/workflows/deploy-pages.yml` — builds with `DEPLOY_BASE=/clinical-hour-tracker/`
  and publishes `dist/` to GitHub Pages.

To publish:

1. Push this repository to GitHub.
2. In the repository settings, open **Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`; the workflow builds and deploys to
   `https://<owner>.github.io/clinical-hour-tracker/`.

Routing uses hash URLs (`#/activities`), so deep links work on GitHub Pages without any
server configuration. The base path is read from the `DEPLOY_BASE` environment variable in
`vite.config.ts` — change it if you rename the repository.

## Documentation

- [User guide](docs/user-guide.md)
- [Backup and restore](docs/backup-and-restore.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Privacy and your data](docs/privacy-and-data.md)

## Icons

PWA icons are generated locally by `node scripts/generate-icons.mjs` (no network access, no
external image dependencies). Re-run it if you change the design.
