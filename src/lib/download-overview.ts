import type Database from "better-sqlite3";

export type DownloadAsset = {
    id: number;
    name: string;
    downloads: number | null;
};
export type DownloadRelease = {
    id: number;
    name: string;
    tag: string;
    publishedAt: string | null;
    downloads: number;
    complete: boolean;
    assets: DownloadAsset[];
};
export type DownloadRepository = {
    id: number;
    owner: string;
    name: string;
    lastSuccessfulUpdate: string | null;
    releaseCount: number;
    downloads: number;
    complete: boolean;
    releases: DownloadRelease[];
};

type Row = {
    repository_id: number;
    owner: string;
    repository: string;
    last_polled_at: string | null;
    release_id: number | null;
    release_name: string | null;
    tag_name: string | null;
    published_at: string | null;
    asset_id: number | null;
    asset_name: string | null;
    downloads: number | null;
};

export function getDownloadOverview(
    db: Database.Database,
): DownloadRepository[] {
    const rows = db
        .prepare(
            `
        WITH latest AS (
            SELECT asset_id, download_count,
                   ROW_NUMBER() OVER (PARTITION BY asset_id ORDER BY timestamp DESC, id DESC) AS rank
            FROM snapshots
        )
        SELECT r.id AS repository_id, r.owner, r.name AS repository, r.last_polled_at,
               rel.id AS release_id, rel.name AS release_name, rel.tag_name, rel.published_at,
               a.id AS asset_id, a.name AS asset_name, latest.download_count AS downloads
        FROM repositories r
        LEFT JOIN releases rel ON rel.repository_id = r.id
        LEFT JOIN assets a ON a.release_id = rel.id AND a.deleted_at IS NULL
        LEFT JOIN latest ON latest.asset_id = a.id AND latest.rank = 1
        WHERE r.enabled = 1
        ORDER BY r.owner COLLATE NOCASE, r.name COLLATE NOCASE,
                 (rel.published_at IS NULL), rel.published_at DESC, rel.id DESC,
                 (latest.download_count IS NULL), latest.download_count DESC, a.name COLLATE NOCASE
    `,
        )
        .all() as Row[];

    const repositories = new Map<number, DownloadRepository>();
    const releases = new Map<number, DownloadRelease>();
    for (const row of rows) {
        let repository = repositories.get(row.repository_id);
        if (!repository) {
            repository = {
                id: row.repository_id,
                owner: row.owner,
                name: row.repository,
                lastSuccessfulUpdate: row.last_polled_at,
                releaseCount: 0,
                downloads: 0,
                complete: true,
                releases: [],
            };
            repositories.set(row.repository_id, repository);
        }
        if (row.release_id === null) continue;
        let release = releases.get(row.release_id);
        if (!release) {
            release = {
                id: row.release_id,
                name: row.release_name || row.tag_name || "Untitled release",
                tag: row.tag_name || "",
                publishedAt: row.published_at,
                downloads: 0,
                complete: true,
                assets: [],
            };
            releases.set(row.release_id, release);
            repository.releases.push(release);
            repository.releaseCount++;
        }
        if (row.asset_id === null) continue;
        const asset = {
            id: row.asset_id,
            name: row.asset_name || "",
            downloads: row.downloads,
        };
        release.assets.push(asset);
        if (row.downloads === null) release.complete = false;
        else release.downloads += row.downloads;
        if (row.downloads === null) repository.complete = false;
        else repository.downloads += row.downloads;
    }
    for (const repository of repositories.values()) {
        for (const release of repository.releases) {
            release.assets.sort(
                (a, b) =>
                    (b.downloads ?? -1) - (a.downloads ?? -1) ||
                    a.name.localeCompare(b.name),
            );
        }
    }
    return [...repositories.values()];
}

export function reconcileReleaseSelections(
    previous: Record<number, number>,
    repositories: DownloadRepository[],
): Record<number, number> {
    return Object.fromEntries(
        repositories
            .map((repository) => {
                const releaseIds = new Set(
                    repository.releases.map((release) => release.id),
                );
                const selected = previous[repository.id];
                return [
                    repository.id,
                    selected && releaseIds.has(selected)
                        ? selected
                        : (repository.releases[0]?.id ?? 0),
                ];
            })
            .filter(([, releaseId]) => Number(releaseId) > 0),
    );
}
