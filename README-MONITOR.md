# GREV repository monitor (Phase 2)

## Architecture

The existing browser-side GREV release viewer and GitHub OAuth sign-in remain available. The monitor is a separate server-side feature: Next.js Node.js routes and the standalone collector share a local SQLite database. No analytics SDK is initialized. The project opts out of Next.js telemetry.

## Install and configure

Use Node.js 24 and pnpm 10 in the intended deployment. Install dependencies with `pnpm install --frozen-lockfile`. Copy `.env.example` to `.env.local` for development and configure:

The repository pins pnpm 10.34.7 through `packageManager` and requires Node.js 24 or newer. Runtime additions are `better-sqlite3` (SQLite) and `server-only` (guard against client imports); development additions are `tsx` (collector TypeScript entry point), `vitest` (tests), and `@types/better-sqlite3` (types). These are recorded in `pnpm-lock.yaml`. The `dev`, `build`, and `start` scripts disable Next.js telemetry before launching Next.js.

The pnpm build-script allowlist is in `pnpm-workspace.yaml`; it enables native SQLite/build tooling needed by the locked dependency graph. A frozen install was verified with pnpm 10.34.7 on Node.js 24.

- `GREV_DATABASE_PATH`: writable SQLite file path. Its parent directory is created automatically.
- `GREV_ADMIN_TOKEN`: generate a random secret of at least 32 characters. Admin APIs fail closed if missing or shorter.
- `GITHUB_TOKEN`: optional fine-grained/classic token. Public repositories work without it at lower GitHub API limits; private repositories require suitable read access.
- `GITHUB_ID`, `GITHUB_SECRET`, `AUTH_SECRET`: existing optional GitHub OAuth configuration.

The SQLite schema initializes automatically on the first server/collector start. SQL migration files live in `migrations/`; versions are recorded in `schema_migrations`. Use the same `GREV_DATABASE_PATH` for web and collector processes.

## Run

Start the web UI with `pnpm dev`. Open `/settings/repositories`, enter `GREV_ADMIN_TOKEN` into the password field, and add `owner/repository` or `https://github.com/owner/repository`. The server verifies repository existence with GitHub before insertion. Repository configuration is stored only in SQLite.

Run a collection manually with `pnpm collect`. The process uses a SQLite-backed exclusive lock shared with manual web polls, writes UTC snapshots, and returns exit code 1 if any repository fails (2 if another collector is active). A stale lock row is recovered when its recorded process no longer exists. A systemd timer or cron can invoke `pnpm collect` hourly; no web-server timer is used. `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` are the validation commands.

Admin REST APIs are under `/api/admin`: `GET/POST /repositories`, `PATCH/DELETE /repositories/:id`, and `POST /collector`. They require `Authorization: Bearer <GREV_ADMIN_TOKEN>` and same-host Origin for browser requests. Non-browser unsafe requests without Origin must include `Sec-Fetch-Site: same-origin`; the standalone collector bypasses HTTP auth and uses the filesystem/database permissions. Keep the token in a password manager; never expose it in client code or logs. The settings page holds it only in component memory, provides a Forget button, and sends it in request headers. Existing OAuth is not used as admin authorization so operations remain independent of account setup.

## Collection and history

Repositories and releases are upserted by case-insensitive repository key and GitHub release ID. Assets are keyed by GitHub asset ID, so equal names remain distinct. Each successful poll adds one snapshot per asset and marks assets missing from a release as deleted. A failed pagination pass leaves that repository's data unchanged. A missing poll never creates interpolated values. `assetDownloadDelta(assetId, since)` reports `unknown: true` and `downloads: null` when fewer than two samples exist or a counter decrease makes the interval ambiguous. Poll gaps are reflected by observed timestamps rather than represented as precise hourly data.

## Backup and deployment

Stop collector writes or use SQLite's backup API before copying the database. With WAL mode enabled, do not copy only the main `.sqlite` file while writes are active; use `sqlite3 grev.sqlite '.backup grev-backup.sqlite'` or stop all processes first. Protect the database and backup with restrictive filesystem permissions.

For the planned HestiaCP deployment, provide the absolute persistent path through `GREV_DATABASE_PATH` and ensure user `local` can write its parent directory. The app creates new data directories with mode `0700` and the SQLite file with mode `0600`. Configure secrets in the service environment, not in the repository. Build and run the app on Node.js 24; keep the database outside the application release directory. HestiaCP, HAProxy, firewall, and systemd unit configuration are outside this project change. No additional public service is required.

## Phase 2 analytics

The home page is the cross-repository analytics dashboard. `/explore` retains the original GREV release search, and `/repositories/:owner/:repo` provides repository history, release and asset details, plus platform summaries. The dashboard compares actual cumulative GitHub counters and observed snapshot intervals; it does not estimate values between polls.

Period deltas use the last sample at or before the selected start as a baseline and compare it with samples through the end. Missing baselines and any counter decrease in the interval make that asset's period value unknown. Aggregate values sum known assets and expose `complete` and `unknownAssets`; a partial sum is shown as a lower bound. For time-series charts, each point belongs to the later sample timestamp and covers the full interval since its preceding sample. Missing or reset intervals remain gaps. Custom ranges are UTC and limited to ten years.

Platform categories are Windows, Linux, macOS, Android, and Other. Automatic classification uses asset names and extensions; cross-platform archives default to Other. Admins can override a category on an asset detail page. Overrides are stored by GitHub asset ID in migration `003_platform_overrides.sql`; deleting an override restores automatic classification. Existing migration files are preserved and the migration runs automatically.

Read-only analytics endpoints are `/api/stats/summary`, `/api/stats/repositories/:owner/:repo`, `/api/stats/releases/:id`, `/api/stats/assets/:id`, `/api/stats/timeseries`, and `/api/stats/platforms`. They accept optional period/range filters where applicable and return completeness metadata for download totals. Asset platform changes use `PATCH` or `DELETE /api/admin/assets/:id/platform`, protected by the same bearer token and same-origin checks as other admin routes.

## Known limitations

The current admin token remains a shared bearer credential; rotate it by changing the environment value. Browser clients cannot invoke admin routes without explicitly entering it. Historical attribution follows GitHub asset IDs; an asset replaced with a new ID starts a new series, and totals include the latest known cumulative counters for assets retained in the database, including assets later removed upstream. There is no account-level authorization or background web timer.

## Phase 1 QA review

The QA pass checks every adjacent snapshot pair for a counter decrease; if any reset occurs in the requested interval, the delta is `null` with `unknown: true`, never a guessed positive count. Fewer than two samples are also unknown. Collector integration tests use temporary SQLite files and mocked paginated GitHub responses for pagination, ID-based upserts, repeat runs, unchanged counts, asset replacement/deletion, failed pagination atomicity, error recovery, migration/permissions, and lock recovery. Route tests verify unauthenticated repository and collector endpoints return 401.

Collector writes are one transaction per repository after all its API pages have been fetched. A failed fetch therefore does not persist partial pages. A SQLite row serializes CLI and web-triggered collectors; a dead local PID is reclaimed after an interrupted process. SQLite busy timeout and WAL support concurrent web reads/writes. Error logs and browser-visible status use bounded generic messages; verbose legacy stored errors are hidden. The admin token is only held in component memory, sent as an Authorization header, and can be cleared with “Forget admin token”; there is no browser storage. Unsafe HTTP requests require same-host Origin or same-origin Fetch Metadata. Production database paths should point to the persistent data directory writable by `local`; newly created directories/files use modes 0700/0600.

Last QA validation: `pnpm test` (14 tests), `pnpm typecheck`, `pnpm lint`, and `pnpm build` on Node.js 24 with pnpm 10.34.7. Lint passes with three pre-existing warnings in GREV UI files.
