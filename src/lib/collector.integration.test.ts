import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import type { Octokit } from "octokit";
import { openMonitorDatabase } from "./monitor-db-core";
import { runCollector } from "./collector";

let tempRoot: string;
let database: ReturnType<typeof openMonitorDatabase>;
let dbPath: string;

function makeRelease(
    id: number,
    assets: { id: number; name: string; download_count: number }[],
) {
    return {
        id,
        tag_name: `v${id}`,
        name: `Release ${id}`,
        published_at: "2026-01-01T00:00:00Z",
        prerelease: false,
        draft: false,
        assets: assets.map((asset) => ({
            ...asset,
            content_type: "application/zip",
            size: 10,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
        })),
    };
}

function mockOctokit(
    pages: unknown[][],
    throwAfterPage?: number,
): Pick<Octokit, "rest" | "paginate"> {
    async function* iterator() {
        for (let i = 0; i < pages.length; i++) {
            yield { data: pages[i] };
            if (throwAfterPage === i)
                throw Object.assign(new Error("Bearer ghp_sensitive_token"), {
                    status: 503,
                });
        }
    }
    const listReleases = vi.fn();
    return {
        rest: { repos: { listReleases } } as unknown as Octokit["rest"],
        paginate: {
            iterator: () => iterator(),
        } as unknown as Octokit["paginate"],
    };
}

function addRepo(owner: string, name: string) {
    return database
        .prepare(
            "INSERT INTO repositories(owner, name, enabled, created_at) VALUES (?, ?, 1, ?)",
        )
        .run(owner, name, "2026-01-01T00:00:00Z").lastInsertRowid as number;
}

beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "grev-qa-"));
    dbPath = join(tempRoot, "data", "test.sqlite");
    database = openMonitorDatabase(dbPath);
});

afterEach(() => {
    database.close();
    rmSync(tempRoot, { recursive: true, force: true });
});

describe("collector SQLite integration", () => {
    it("applies migrations in a configured temporary data directory with restrictive file permissions", () => {
        expect(dbPath.startsWith(tempRoot)).toBe(true);
        expect(
            database
                .prepare(
                    "SELECT version FROM schema_migrations ORDER BY version",
                )
                .all(),
        ).toEqual([
            { version: "001_initial" },
            { version: "002_collector_lock" },
            { version: "003_platform_overrides" },
            { version: "004_asset_package_type_overrides" },
        ]);
        if (process.platform !== "win32")
            expect(statSync(dbPath).mode & 0o777).toBe(0o600);
        database
            .prepare(
                "INSERT INTO repositories(owner, name, enabled, created_at) VALUES ('Case', 'Repo', 1, 'now')",
            )
            .run();
        expect(() =>
            database
                .prepare(
                    "INSERT INTO repositories(owner, name, enabled, created_at) VALUES ('case', 'repo', 1, 'now')",
                )
                .run(),
        ).toThrow();
    });

    it("upgrades a Phase 2 database to migration 004 without changing stored history", () => {
        database.close();
        const legacyPath = join(tempRoot, "legacy.sqlite");
        const existing = new Database(legacyPath);
        existing.pragma("foreign_keys = ON");
        existing.exec(
            "CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
        );
        for (const migration of [
            "001_initial.sql",
            "002_collector_lock.sql",
            "003_platform_overrides.sql",
        ]) {
            existing.exec(
                readFileSync(resolve("migrations", migration), "utf8"),
            );
            existing
                .prepare(
                    "INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)",
                )
                .run(migration.replace(/\.sql$/, ""), "2026-01-01T00:00:00Z");
        }
        const repoId = Number(
            existing
                .prepare(
                    "INSERT INTO repositories(owner, name, enabled, created_at) VALUES ('TVHarbor', 'App', 1, '2026-01-01T00:00:00Z')",
                )
                .run().lastInsertRowid,
        );
        const releaseId = Number(
            existing
                .prepare(
                    "INSERT INTO releases(repository_id, github_release_id, tag_name, prerelease, draft) VALUES (?, 987, 'beta-6', 1, 0)",
                )
                .run(repoId).lastInsertRowid,
        );
        const assetId = Number(
            existing
                .prepare(
                    "INSERT INTO assets(release_id, github_asset_id, name, size, created_at, updated_at) VALUES (?, 654, 'tvharbor-portable.exe', 42, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                )
                .run(releaseId).lastInsertRowid,
        );
        existing
            .prepare(
                "INSERT INTO snapshots(asset_id, timestamp, download_count) VALUES (?, '2026-01-02T00:00:00Z', 123)",
            )
            .run(assetId);
        existing
            .prepare(
                "INSERT INTO asset_platform_overrides(github_asset_id, platform, updated_at) VALUES (654, 'Windows', '2026-01-01T00:00:00Z')",
            )
            .run();
        existing.close();

        database = openMonitorDatabase(legacyPath);
        expect(
            database
                .prepare(
                    "SELECT download_count FROM snapshots WHERE asset_id = ?",
                )
                .get(assetId),
        ).toEqual({ download_count: 123 });
        expect(
            database
                .prepare(
                    "SELECT platform FROM asset_platform_overrides WHERE github_asset_id = 654",
                )
                .get(),
        ).toEqual({ platform: "Windows" });
        expect(
            database
                .prepare(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'asset_package_type_overrides'",
                )
                .get(),
        ).toEqual({ name: "asset_package_type_overrides" });
    });

    it("walks every page, upserts by GitHub ID, and records only one snapshot per timestamp", async () => {
        const repoId = addRepo("owner", "repo");
        const releases = [
            makeRelease(100, [
                { id: 501, name: "same.zip", download_count: 8 },
            ]),
            makeRelease(101, [
                { id: 502, name: "other.zip", download_count: 3 },
            ]),
        ];
        const result = await runCollector({
            db: database,
            octokit: mockOctokit([[releases[0]], [releases[1]]]) as Octokit,
            now: () => "2026-01-02T00:00:00.000Z",
            onError: vi.fn(),
        });
        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(
            database
                .prepare(
                    "SELECT count(*) AS n FROM releases WHERE repository_id = ?",
                )
                .get(repoId),
        ).toEqual({ n: 2 });
        expect(
            database.prepare("SELECT count(*) AS n FROM assets").get(),
        ).toEqual({ n: 2 });
        expect(
            database.prepare("SELECT count(*) AS n FROM snapshots").get(),
        ).toEqual({ n: 2 });
        await runCollector({
            db: database,
            octokit: mockOctokit([[...releases]]) as Octokit,
            now: () => "2026-01-02T00:00:00.000Z",
            onError: vi.fn(),
        });
        expect(
            database.prepare("SELECT count(*) AS n FROM releases").get(),
        ).toEqual({ n: 2 });
        expect(
            database.prepare("SELECT count(*) AS n FROM snapshots").get(),
        ).toEqual({ n: 2 });
    });

    it("records unchanged counts as a zero delta and adds a second observed sample", async () => {
        addRepo("owner", "steady");
        const release = makeRelease(200, [
            { id: 601, name: "steady.zip", download_count: 11 },
        ]);
        for (const timestamp of [
            "2026-01-02T00:00:00Z",
            "2026-01-03T00:00:00Z",
        ]) {
            await runCollector({
                db: database,
                octokit: mockOctokit([[release]]) as Octokit,
                now: () => timestamp,
                onError: vi.fn(),
            });
        }
        const samples = database
            .prepare(
                "SELECT timestamp, download_count FROM snapshots ORDER BY timestamp",
            )
            .all() as { timestamp: string; download_count: number }[];
        expect(samples).toHaveLength(2);
        expect(samples.map((sample) => sample.download_count)).toEqual([
            11, 11,
        ]);
    });

    it("marks disappeared assets deleted and treats a same-name replacement as a new asset", async () => {
        addRepo("owner", "assets");
        const first = makeRelease(300, [
            { id: 701, name: "archive.zip", download_count: 5 },
        ]);
        await runCollector({
            db: database,
            octokit: mockOctokit([[first]]) as Octokit,
            now: () => "2026-01-02T00:00:00Z",
            onError: vi.fn(),
        });
        const replacement = makeRelease(300, [
            { id: 702, name: "archive.zip", download_count: 1 },
        ]);
        await runCollector({
            db: database,
            octokit: mockOctokit([[replacement]]) as Octokit,
            now: () => "2026-01-03T00:00:00Z",
            onError: vi.fn(),
        });
        const assets = database
            .prepare(
                "SELECT github_asset_id, deleted_at FROM assets ORDER BY github_asset_id",
            )
            .all();
        expect(assets).toHaveLength(2);
        expect(assets[0]).toMatchObject({
            github_asset_id: 701,
            deleted_at: "2026-01-03T00:00:00Z",
        });
        expect(assets[1]).toMatchObject({
            github_asset_id: 702,
            deleted_at: null,
        });
    });

    it("keeps a failed paginated poll atomic, redacts error details, and resumes cleanly", async () => {
        const repoId = addRepo("owner", "recover");
        const release = makeRelease(400, [
            { id: 801, name: "first.zip", download_count: 1 },
        ]);
        const errors: string[] = [];
        const failed = await runCollector({
            db: database,
            octokit: mockOctokit([[release], []], 0) as Octokit,
            now: () => "2026-01-02T00:00:00Z",
            onError: (message) => errors.push(message),
        });
        expect(failed).toEqual({ processed: 0, failed: 1 });
        expect(
            database.prepare("SELECT count(*) AS n FROM releases").get(),
        ).toEqual({ n: 0 });
        expect(errors.join(" ")).not.toContain("ghp_sensitive_token");
        expect(
            database
                .prepare("SELECT last_error FROM repositories WHERE id = ?")
                .get(repoId),
        ).toEqual({ last_error: "GitHub API request failed (HTTP 503)" });
        const resumed = await runCollector({
            db: database,
            octokit: mockOctokit([[release]]) as Octokit,
            now: () => "2026-01-03T00:00:00Z",
            onError: vi.fn(),
        });
        expect(resumed).toEqual({ processed: 1, failed: 0 });
        expect(
            database
                .prepare(
                    "SELECT last_error, last_polled_at FROM repositories WHERE id = ?",
                )
                .get(repoId),
        ).toEqual({ last_error: null, last_polled_at: "2026-01-03T00:00:00Z" });
    });

    it("releases collector lock after errors and rejects a competing run", async () => {
        addRepo("owner", "locked");
        database
            .prepare(
                "INSERT INTO collector_lock(id, pid, started_at) VALUES (1, ?, ?)",
            )
            .run(process.pid, "now");
        await expect(
            runCollector({ db: database, octokit: mockOctokit([]) as Octokit }),
        ).rejects.toThrow("already running");
        database.prepare("DELETE FROM collector_lock").run();
        await runCollector({
            db: database,
            octokit: mockOctokit([]) as Octokit,
        });
        expect(
            database.prepare("SELECT count(*) AS n FROM collector_lock").get(),
        ).toEqual({ n: 0 });
    });

    it("recovers a lock left by a process that has exited", async () => {
        addRepo("owner", "crashed");
        database
            .prepare(
                "INSERT INTO collector_lock(id, pid, started_at) VALUES (1, 2147483647, ?)",
            )
            .run("stale");
        const result = await runCollector({
            db: database,
            octokit: mockOctokit([]) as Octokit,
        });
        expect(result).toEqual({ processed: 1, failed: 0 });
        expect(
            database.prepare("SELECT count(*) AS n FROM collector_lock").get(),
        ).toEqual({ n: 0 });
    });
});
