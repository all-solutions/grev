import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openMonitorDatabase } from "./monitor-db-core";
import {
    combineWindows,
    getAssetStats,
    getPlatformBreakdown,
    getReleaseStats,
    getRepositoryStats,
    getSummary,
    getTimeseries,
    summarizeWindow,
} from "./stats-core";
import { classifyPlatform } from "./platform";
import { parsePositiveInteger, parseTimeRange } from "./stats-query";

let root: string;
let db: ReturnType<typeof openMonitorDatabase>;
let repoId: number;
let releaseId: number;
let assetA: number;
const now = "2026-02-01T12:00:00.000Z";

function seedAsset(
    release: number,
    githubId: number,
    name: string,
    samples: [string, number][],
    deletedAt: string | null = null,
) {
    const assetId = Number(
        db
            .prepare(
                "INSERT INTO assets(release_id, github_asset_id, name, content_type, size, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
                release,
                githubId,
                name,
                "application/octet-stream",
                128,
                "2026-01-01T00:00:00Z",
                "2026-01-01T00:00:00Z",
                deletedAt,
            ).lastInsertRowid,
    );
    for (const [timestamp, count] of samples)
        db.prepare(
            "INSERT INTO snapshots(asset_id, timestamp, download_count) VALUES (?, ?, ?)",
        ).run(assetId, timestamp, count);
    return assetId;
}

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "grev-stats-"));
    db = openMonitorDatabase(join(root, "persist", "stats.sqlite"));
    repoId = Number(
        db
            .prepare(
                "INSERT INTO repositories(owner, name, enabled, created_at, last_polled_at) VALUES ('Example', 'App', 1, ?, ?)",
            )
            .run("2025-12-01T00:00:00Z", now).lastInsertRowid,
    );
    releaseId = Number(
        db
            .prepare(
                "INSERT INTO releases(repository_id, github_release_id, tag_name, name, published_at, prerelease, draft) VALUES (?, 900, 'v1', 'One', '2026-01-01T00:00:00Z', 0, 0)",
            )
            .run(repoId).lastInsertRowid,
    );
    assetA = seedAsset(releaseId, 1001, "app-windows.zip", [
        ["2026-01-01T12:00:00.000Z", 10],
        ["2026-01-25T12:00:00.000Z", 50],
        ["2026-01-31T12:00:00.000Z", 100],
        [now, 110],
    ]);
    seedAsset(releaseId, 1002, "setup.exe", [
        ["2026-01-31T12:00:00.000Z", 5],
        [now, 8],
    ]);
});

afterEach(() => {
    db.close();
    rmSync(root, { recursive: true, force: true });
});

describe("SQLite statistics", () => {
    it("computes asset, release, repository, and dashboard totals", () => {
        const asset = getAssetStats(db, 1001, now)!;
        expect(asset.total).toBe(110);
        expect(asset.periods["24h"].downloads).toBe(10);
        expect(asset.periods["7d"].downloads).toBe(60);
        expect(asset.periods["30d"].downloads).toBe(100);
        const release = getReleaseStats(db, releaseId, now)! as {
            metrics: {
                total: { downloads: number };
                "24h": { downloads: number; complete: boolean };
            };
        };
        expect(release.metrics.total.downloads).toBe(118);
        expect(release.metrics["24h"]).toMatchObject({
            downloads: 13,
            complete: true,
        });
        const repo = getRepositoryStats(db, repoId, now)!;
        expect(repo.metrics.total.downloads).toBe(118);
        expect(repo.releases).toHaveLength(1);
        const summary = getSummary(db, now);
        expect(summary.totals.total.downloads).toBe(118);
        expect(summary.monitoredRepositories).toBe(1);
    });

    it("marks partial aggregates incomplete when an asset has no baseline", () => {
        const recent = Number(
            db
                .prepare(
                    "INSERT INTO releases(repository_id, github_release_id, tag_name, published_at, prerelease, draft) VALUES (?, 901, 'v2', '2026-01-30T00:00:00Z', 0, 0)",
                )
                .run(repoId).lastInsertRowid,
        );
        seedAsset(recent, 1003, "new.apk", [[now, 501]]);
        const stats = getRepositoryStats(db, repoId, now)!;
        expect(stats.metrics["24h"]).toMatchObject({
            downloads: 13,
            complete: false,
            unknownAssets: 1,
        });
        expect(stats.metrics.total).toMatchObject({
            downloads: 619,
            complete: true,
            unknownAssets: 0,
        });
        expect(stats.releases).toHaveLength(2);
    });

    it("treats reset intervals as unknown and never counts post-reset snapshots as a window total", () => {
        const resetSamples = [
            { timestamp: "2026-01-31T12:00:00.000Z", download_count: 100 },
            { timestamp: "2026-01-31T18:00:00.000Z", download_count: 2 },
            { timestamp: now, download_count: 120 },
        ];
        expect(
            summarizeWindow(resetSamples, "2026-01-31T12:00:00.000Z", now),
        ).toMatchObject({ downloads: null, complete: false, unknownAssets: 1 });
        const combined = combineWindows([
            {
                downloads: 4,
                complete: true,
                unknownAssets: 0,
                observedFrom: "a",
                observedTo: "b",
            },
            {
                downloads: null,
                complete: false,
                unknownAssets: 1,
                observedFrom: null,
                observedTo: "c",
            },
        ]);
        expect(combined).toMatchObject({
            downloads: 4,
            complete: false,
            unknownAssets: 1,
        });
    });

    it("retains deleted assets in historical totals and timeseries", () => {
        db.prepare("UPDATE assets SET deleted_at = ? WHERE id = ?").run(
            "2026-02-01T00:00:00Z",
            assetA,
        );
        expect(getAssetStats(db, 1001, now)).toMatchObject({
            deletedAt: "2026-02-01T00:00:00Z",
            total: 110,
        });
        expect(
            getTimeseries(
                db,
                { assetId: 1001 },
                "2026-01-31T12:00:00.000Z",
                now,
            )[0].points,
        ).toEqual([
            {
                timestamp: now,
                intervalStart: "2026-01-31T12:00:00.000Z",
                downloads: 10,
                unknown: false,
            },
        ]);
    });

    it("applies manual platform overrides and groups comparisons by repository/platform", () => {
        expect(classifyPlatform("TVHarbor-linux.AppImage")).toBe("Linux");
        expect(classifyPlatform("portable.zip")).toBe("Other");
        expect(classifyPlatform("app-darwin.zip")).toBe("macOS");
        db.prepare(
            "INSERT INTO asset_platform_overrides(github_asset_id, platform, updated_at) VALUES (1002, 'Android', ?)",
        ).run(now);
        expect(getAssetStats(db, 1002, now)).toMatchObject({
            platform: "Android",
            override: true,
        });
        expect(
            getPlatformBreakdown(db, undefined, now).some(
                (entry) =>
                    entry.platform === "Android" && entry.total.downloads === 8,
            ),
        ).toBe(true);
    });

    it("returns unknown for periods without a baseline or a later observation", () => {
        expect(
            summarizeWindow(
                [{ timestamp: now, download_count: 9 }],
                "2026-01-31T12:00:00.000Z",
                now,
            ),
        ).toMatchObject({ downloads: null, complete: false });
        expect(
            summarizeWindow(
                [{ timestamp: "2026-01-31T12:00:00.000Z", download_count: 9 }],
                "2026-01-31T12:00:00.000Z",
                now,
            ),
        ).toMatchObject({ downloads: null, complete: false });
    });
});

describe("statistics query validation", () => {
    it("accepts fixed and custom UTC ranges and rejects malformed bounds", () => {
        expect(
            parseTimeRange(new URLSearchParams("period=24h"), new Date(now)),
        ).toMatchObject({ period: "24h", to: now });
        expect(
            parseTimeRange(
                new URLSearchParams(
                    "period=custom&from=2026-01-01T00%3A00%3A00Z&to=2026-01-02T00%3A00%3A00Z",
                ),
                new Date(now),
            ),
        ).toMatchObject({ period: "custom" });
        expect(
            parseTimeRange(new URLSearchParams("period=bad"), new Date(now)),
        ).toHaveProperty("error");
        expect(
            parseTimeRange(
                new URLSearchParams(
                    "period=custom&from=2026-01-02&to=2026-01-01",
                ),
                new Date(now),
            ),
        ).toHaveProperty("error");
    });
    it("validates numeric filters", () => {
        expect(parsePositiveInteger("12", "id")).toBe(12);
        expect(parsePositiveInteger("-1", "id")).toHaveProperty("error");
        expect(parsePositiveInteger("1.2", "id")).toHaveProperty("error");
    });
});
