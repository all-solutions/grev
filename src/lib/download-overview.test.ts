import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openMonitorDatabase } from "./monitor-db-core";
import {
    getDownloadOverview,
    reconcileReleaseSelections,
} from "./download-overview";
import { MONITOR_NAVIGATION } from "./monitor-navigation";

describe("download overview", () => {
    let directory: string;
    let db: ReturnType<typeof openMonitorDatabase>;
    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "grev-downloads-"));
        db = openMonitorDatabase(join(directory, "test.sqlite"));
    });
    afterEach(() => {
        db.close();
        rmSync(directory, { recursive: true, force: true });
    });

    it("returns enabled repositories, newest releases, sorted assets and partial totals", () => {
        const addRepository = (owner: string, name: string, enabled = 1) =>
            Number(
                db
                    .prepare(
                        "INSERT INTO repositories(owner,name,enabled,created_at,last_polled_at) VALUES(?,?,?,?,?)",
                    )
                    .run(owner, name, enabled, "2026-01-01", "2026-01-02")
                    .lastInsertRowid,
            );
        const addRelease = (
            repositoryId: number,
            githubId: number,
            tag: string,
            date: string,
        ) =>
            Number(
                db
                    .prepare(
                        "INSERT INTO releases(repository_id,github_release_id,tag_name,name,published_at,prerelease,draft) VALUES(?,?,?,?,?,0,0)",
                    )
                    .run(repositoryId, githubId, tag, tag, date)
                    .lastInsertRowid,
            );
        const addAsset = (
            releaseId: number,
            githubId: number,
            name: string,
            downloads?: number,
        ) => {
            const id = Number(
                db
                    .prepare(
                        "INSERT INTO assets(release_id,github_asset_id,name,size,created_at,updated_at) VALUES(?,?,?,0,'2026-01-01','2026-01-01')",
                    )
                    .run(releaseId, githubId, name).lastInsertRowid,
            );
            if (downloads !== undefined)
                db.prepare(
                    "INSERT INTO snapshots(asset_id,timestamp,download_count) VALUES(?,'2026-01-02',?)",
                ).run(id, downloads);
        };
        const first = addRepository("team", "app");
        const old = addRelease(first, 101, "v1", "2026-01-01");
        const newest = addRelease(first, 102, "v2", "2026-01-03");
        addAsset(old, 201, "old.zip", 5);
        addAsset(newest, 202, "unknown.zip");
        addAsset(newest, 203, "popular.zip", 12);
        const empty = addRepository("team", "empty");
        addRepository("team", "disabled", 0);

        const overview = getDownloadOverview(db);
        expect(overview.map(({ id }) => id)).toEqual([first, empty]);
        expect(overview[1]).toMatchObject({
            releaseCount: 0,
            downloads: 0,
            complete: true,
            releases: [],
        });
        expect(overview[0]).toMatchObject({
            releaseCount: 2,
            downloads: 17,
            complete: false,
        });
        expect(overview[0].releases[0]).toMatchObject({
            id: newest,
            downloads: 12,
            complete: false,
        });
        expect(
            overview[0].releases[0].assets.map((asset) => asset.name),
        ).toEqual(["popular.zip", "unknown.zip"]);

        expect(reconcileReleaseSelections({}, overview)[first]).toBe(newest);
        expect(
            reconcileReleaseSelections({ [first]: old }, overview)[first],
        ).toBe(old);
        expect(
            reconcileReleaseSelections({ [first]: 999 }, overview)[first],
        ).toBe(newest);
        expect(
            reconcileReleaseSelections({ [first]: newest }, [overview[1]]),
        ).not.toHaveProperty(String(first));
    });

    it("defines navigation to downloads, statistics and repository management", () => {
        expect(MONITOR_NAVIGATION.map(({ href }) => href)).toEqual([
            "/",
            "/dashboard",
            "/settings/repositories",
        ]);
    });
});
