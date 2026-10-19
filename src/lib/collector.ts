import type Database from "better-sqlite3";
import type { Octokit } from "octokit";

export type CollectorRepository = {
    id: number;
    owner: string;
    name: string;
    enabled: boolean | number;
    created_at?: string;
    last_polled_at?: string | null;
    last_error?: string | null;
};

type Dependencies = {
    db: Database.Database;
    octokit: Pick<Octokit, "rest" | "paginate">;
    now?: () => string;
    onError?: (message: string) => void;
};

export async function runCollector(
    {
        db,
        octokit,
        now = () => new Date().toISOString(),
        onError = console.error,
    }: Dependencies,
    repositoryId?: number,
) {
    acquireCollectorLock(db, now());
    try {
        const repos =
            repositoryId === undefined
                ? (db
                      .prepare(
                          "SELECT * FROM repositories WHERE enabled = 1 ORDER BY id",
                      )
                      .all() as CollectorRepository[])
                : (db
                      .prepare(
                          "SELECT * FROM repositories WHERE id = ? AND enabled = 1",
                      )
                      .all(repositoryId) as CollectorRepository[]);
        let processed = 0;
        let failed = 0;

        for (const repo of repos) {
            try {
                await collectOne({ db, octokit, now }, repo);
                processed++;
            } catch (error) {
                failed++;
                const message = safeErrorMessage(error);
                db.prepare(
                    "UPDATE repositories SET last_error = ? WHERE id = ?",
                ).run(message, repo.id);
                onError(
                    `Collection failed for ${repo.owner}/${repo.name}: ${message}`,
                );
            }
        }
        return { processed, failed };
    } finally {
        db.prepare("DELETE FROM collector_lock WHERE id = 1 AND pid = ?").run(
            process.pid,
        );
    }
}

function acquireCollectorLock(db: Database.Database, timestamp: string) {
    db.transaction(() => {
        const existing = db
            .prepare("SELECT pid FROM collector_lock WHERE id = 1")
            .get() as { pid: number } | undefined;
        if (existing) {
            let alive = true;
            try {
                process.kill(existing.pid, 0);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === "ESRCH")
                    alive = false;
            }
            if (alive) throw new Error("A collector is already running.");
            db.prepare("DELETE FROM collector_lock WHERE id = 1").run();
        }
        db.prepare(
            "INSERT INTO collector_lock(id, pid, started_at) VALUES (1, ?, ?)",
        ).run(process.pid, timestamp);
    })();
}

function safeErrorMessage(error: unknown) {
    // Octokit errors carry request/response headers which can contain auth data.
    // Keep only the numeric status and a fixed message to avoid leaking details.
    const candidate = error as { status?: unknown };
    const status =
        typeof candidate?.status === "number" ? candidate.status : undefined;
    const message = status
        ? `GitHub API request failed (HTTP ${status})`
        : "GitHub collection failed";
    return message;
}

async function collectOne(
    { db, octokit, now }: Dependencies,
    repo: CollectorRepository,
) {
    const timestamp = now!();
    const pages = octokit.paginate.iterator(octokit.rest.repos.listReleases, {
        owner: repo.owner,
        repo: repo.name,
        per_page: 100,
    });
    const releases: Awaited<
        ReturnType<typeof octokit.rest.repos.listReleases>
    >["data"] = [];
    // Fetch all pages before writing. A pagination/API error leaves this repo's
    // last consistent DB state intact; the enclosing transaction is atomic too.
    for await (const page of pages) releases.push(...page.data);

    const tx = db.transaction(() => {
        const upsertRelease =
            db.prepare(`INSERT INTO releases(repository_id, github_release_id, tag_name, name, published_at, prerelease, draft)
            VALUES (@repository_id, @github_release_id, @tag_name, @name, @published_at, @prerelease, @draft)
            ON CONFLICT(github_release_id) DO UPDATE SET repository_id=excluded.repository_id, tag_name=excluded.tag_name, name=excluded.name, published_at=excluded.published_at, prerelease=excluded.prerelease, draft=excluded.draft`);
        const upsertAsset =
            db.prepare(`INSERT INTO assets(release_id, github_asset_id, name, content_type, size, created_at, updated_at, deleted_at)
            VALUES (@release_id, @github_asset_id, @name, @content_type, @size, @created_at, @updated_at, NULL)
            ON CONFLICT(github_asset_id) DO UPDATE SET release_id=excluded.release_id, name=excluded.name, content_type=excluded.content_type, size=excluded.size, created_at=excluded.created_at, updated_at=excluded.updated_at, deleted_at=NULL`);
        const saveSnapshot =
            db.prepare(`INSERT INTO snapshots(asset_id, timestamp, download_count) VALUES (?, ?, ?)
            ON CONFLICT(asset_id, timestamp) DO UPDATE SET download_count=excluded.download_count`);
        const markAssetsDeleted = db.prepare(
            "UPDATE assets SET deleted_at = ? WHERE release_id = ? AND github_asset_id NOT IN (SELECT value FROM json_each(?))",
        );

        for (const release of releases) {
            upsertRelease.run({
                repository_id: repo.id,
                github_release_id: release.id,
                tag_name: release.tag_name,
                name: release.name,
                published_at: release.published_at,
                prerelease: release.prerelease ? 1 : 0,
                draft: release.draft ? 1 : 0,
            });
            const releaseId = (
                db
                    .prepare(
                        "SELECT id FROM releases WHERE github_release_id = ?",
                    )
                    .get(release.id) as { id: number }
            ).id;
            const currentAssetIds: number[] = [];
            for (const asset of release.assets) {
                upsertAsset.run({
                    release_id: releaseId,
                    github_asset_id: asset.id,
                    name: asset.name,
                    content_type: asset.content_type,
                    size: asset.size,
                    created_at: asset.created_at,
                    updated_at: asset.updated_at,
                });
                const assetId = (
                    db
                        .prepare(
                            "SELECT id FROM assets WHERE github_asset_id = ?",
                        )
                        .get(asset.id) as { id: number }
                ).id;
                saveSnapshot.run(
                    assetId,
                    timestamp,
                    Math.max(0, asset.download_count),
                );
                currentAssetIds.push(asset.id);
            }
            markAssetsDeleted.run(
                timestamp,
                releaseId,
                JSON.stringify(currentAssetIds),
            );
        }
        db.prepare(
            "UPDATE repositories SET last_polled_at = ?, last_error = NULL WHERE id = ?",
        ).run(timestamp, repo.id);
    });
    tx();
}
