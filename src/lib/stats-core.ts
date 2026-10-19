import type Database from "better-sqlite3";
import {
    classifyPackageType,
    classifyPlatform,
    isPackageTypeForPlatform,
    type PackageType,
    type Platform,
} from "./platform";

export type WindowValue = {
    downloads: number | null;
    complete: boolean;
    unknownAssets: number;
    observedFrom: string | null;
    observedTo: string | null;
};
export type AssetStat = {
    githubAssetId: number;
    repositoryId: number;
    repository: string;
    releaseId: number;
    releaseName: string;
    name: string;
    size: number;
    contentType: string | null;
    deletedAt: string | null;
    total: number | null;
    platform: Platform;
    override: boolean;
    packageType: PackageType;
    packageTypeOverride: boolean;
    periods: Record<"24h" | "7d" | "30d", WindowValue>;
};

export function summarizeWindow(
    samples: { timestamp: string; download_count: number }[],
    from: string,
    to: string,
): WindowValue {
    const ordered = [...samples]
        .filter((sample) => sample.timestamp <= to)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const baseline = ordered
        .filter((sample) => sample.timestamp <= from)
        .at(-1);
    const later = ordered.filter((sample) => sample.timestamp > from);
    const observedFrom = baseline?.timestamp ?? null;
    const observedTo = later.at(-1)?.timestamp ?? null;
    if (!baseline || later.length === 0)
        return {
            downloads: null,
            complete: false,
            unknownAssets: 1,
            observedFrom,
            observedTo,
        };
    const interval = [baseline, ...later];
    for (let i = 1; i < interval.length; i++) {
        if (interval[i].download_count < interval[i - 1].download_count)
            return {
                downloads: null,
                complete: false,
                unknownAssets: 1,
                observedFrom,
                observedTo,
            };
    }
    return {
        downloads: interval.at(-1)!.download_count - baseline.download_count,
        complete: true,
        unknownAssets: 0,
        observedFrom,
        observedTo,
    };
}

export function combineWindows(values: WindowValue[]): WindowValue {
    const known = values.filter((value) => value.downloads !== null);
    return {
        downloads: known.reduce((sum, value) => sum + value.downloads!, 0),
        complete: values.every((value) => value.complete),
        unknownAssets: values.reduce(
            (sum, value) => sum + value.unknownAssets,
            0,
        ),
        observedFrom:
            values
                .map((value) => value.observedFrom)
                .filter((value): value is string => Boolean(value))
                .sort()[0] ?? null,
        observedTo:
            values
                .map((value) => value.observedTo)
                .filter((value): value is string => Boolean(value))
                .sort()
                .at(-1) ?? null,
    };
}

type Scope = {
    repositoryId?: number;
    releaseId?: number;
    assetId?: number;
    enabledOnly?: boolean;
};
type RawAsset = {
    db_asset_id: number;
    github_asset_id: number;
    release_id: number;
    repository_id: number;
    owner: string;
    repository: string;
    tag_name: string;
    release_name: string | null;
    published_at: string | null;
    asset_name: string;
    size: number;
    content_type: string | null;
    deleted_at: string | null;
    override_platform: Platform | null;
    override_package_type: string | null;
};
type Sample = { asset_id: number; timestamp: string; download_count: number };

function loadAssets(db: Database.Database, scope: Scope): RawAsset[] {
    const clauses: string[] = [];
    const params: (number | string)[] = [];
    if (scope.repositoryId !== undefined) {
        clauses.push("r.id = ?");
        params.push(scope.repositoryId);
    }
    if (scope.releaseId !== undefined) {
        clauses.push("rel.id = ?");
        params.push(scope.releaseId);
    }
    if (scope.assetId !== undefined) {
        clauses.push("a.github_asset_id = ?");
        params.push(scope.assetId);
    }
    if (scope.enabledOnly) clauses.push("r.enabled = 1");
    return db
        .prepare(
            `SELECT a.id AS db_asset_id, a.github_asset_id, rel.id AS release_id, r.id AS repository_id, r.owner, r.name AS repository, rel.tag_name, rel.name AS release_name, rel.published_at, a.name AS asset_name, a.size, a.content_type, a.deleted_at, o.platform AS override_platform, p.package_type AS override_package_type FROM assets a JOIN releases rel ON rel.id = a.release_id JOIN repositories r ON r.id = rel.repository_id LEFT JOIN asset_platform_overrides o ON o.github_asset_id = a.github_asset_id LEFT JOIN asset_package_type_overrides p ON p.github_asset_id = a.github_asset_id ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""} ORDER BY r.owner COLLATE NOCASE, r.name COLLATE NOCASE, rel.published_at, rel.id, a.name`,
        )
        .all(...params) as RawAsset[];
}

function loadSamples(
    db: Database.Database,
    ids: number[],
    from: string,
    to: string,
): Map<number, Sample[]> {
    if (!ids.length) return new Map();
    const placeholders = ids.map(() => "?").join(",");
    const rows = db
        .prepare(
            `WITH prior AS (SELECT s.asset_id, s.timestamp, s.download_count, ROW_NUMBER() OVER (PARTITION BY s.asset_id ORDER BY s.timestamp DESC) AS row_num FROM snapshots s WHERE s.asset_id IN (${placeholders}) AND s.timestamp <= ?), selected AS (SELECT asset_id, timestamp, download_count FROM prior WHERE row_num = 1 UNION ALL SELECT asset_id, timestamp, download_count FROM snapshots WHERE asset_id IN (${placeholders}) AND timestamp > ? AND timestamp <= ?) SELECT asset_id, timestamp, download_count FROM selected ORDER BY asset_id, timestamp`,
        )
        .all(...ids, from, ...ids, from, to) as Sample[];
    const grouped = new Map<number, Sample[]>();
    for (const row of rows) {
        const list = grouped.get(row.asset_id) ?? [];
        list.push(row);
        grouped.set(row.asset_id, list);
    }
    return grouped;
}

export function getSummary(
    db: Database.Database,
    now = new Date().toISOString(),
) {
    const start24 = shift(now, -24 * 60 * 60 * 1000);
    const start7 = shift(now, -7 * 86400000);
    const start30 = shift(now, -30 * 86400000);
    const assets = loadAssets(db, { enabledOnly: true });
    const samples = loadSamples(
        db,
        assets.map((a) => a.db_asset_id),
        start30,
        now,
    );
    const rows = db
        .prepare(
            "SELECT r.id, r.owner, r.name, r.last_polled_at, r.last_error, (SELECT count(*) FROM releases rel WHERE rel.repository_id = r.id) AS release_count, (SELECT max(published_at) FROM releases rel WHERE rel.repository_id = r.id) AS latest_release FROM repositories r WHERE r.enabled = 1 ORDER BY r.owner COLLATE NOCASE, r.name COLLATE NOCASE",
        )
        .all() as {
        id: number;
        owner: string;
        name: string;
        last_polled_at: string | null;
        last_error: string | null;
        release_count: number;
        latest_release: string | null;
    }[];
    const items = rows.map((repo) => {
        const repoAssets = assets.filter(
            (asset) => asset.repository_id === repo.id,
        );
        const summary = summarizeScope(
            repoAssets,
            samples,
            start24,
            start7,
            start30,
            now,
            repo,
        );
        return {
            ...repo,
            last_error: safeStatusError(repo.last_error),
            metrics: summary.metrics,
            lastSuccessfulPoll: summary.lastSuccessfulPoll,
        };
    });
    const globalAssets = summarizeScope(
        assets,
        samples,
        start24,
        start7,
        start30,
        now,
    );
    return {
        generatedAt: now,
        repositories: items,
        totals: {
            ...globalAssets.metrics,
            releaseCount: rows.reduce(
                (sum, repo) => sum + repo.release_count,
                0,
            ),
        },
        monitoredRepositories: rows.length,
        lastSuccessfulPoll:
            rows
                .map((repo) => repo.last_polled_at)
                .filter((v): v is string => Boolean(v))
                .sort()
                .at(-1) ?? null,
    };
}

export function getRepositoryStats(
    db: Database.Database,
    repositoryId: number,
    now = new Date().toISOString(),
) {
    const repo = db
        .prepare(
            "SELECT r.id, r.owner, r.name, r.enabled, r.last_polled_at, r.last_error, (SELECT count(*) FROM releases rel WHERE rel.repository_id = r.id) AS release_count, (SELECT max(published_at) FROM releases rel WHERE rel.repository_id = r.id) AS latest_release FROM repositories r WHERE r.id = ?",
        )
        .get(repositoryId) as
        | {
              id: number;
              owner: string;
              name: string;
              enabled: number;
              last_polled_at: string | null;
              last_error: string | null;
              release_count: number;
              latest_release: string | null;
          }
        | undefined;
    if (!repo) return null;
    const scope = getScopeStats(db, { repositoryId }, now, repo);
    if (!scope) return null;
    const releaseRows = db
        .prepare(
            "SELECT id, tag_name, name, published_at, prerelease, draft FROM releases WHERE repository_id = ? ORDER BY published_at DESC, id DESC",
        )
        .all(repositoryId) as {
        id: number;
        tag_name: string;
        name: string | null;
        published_at: string | null;
        prerelease: number;
        draft: number;
    }[];
    const releases = releaseRows.map((release) => {
        const assets = scope.assets.filter(
            (asset) => asset.releaseId === release.id,
        );
        return { ...release, assets, metrics: summarizeAssetMetrics(assets) };
    });
    return {
        ...repo,
        ...scope,
        last_error: safeStatusError(repo.last_error),
        releases,
    };
}

export function getRepositoryStatsByName(
    db: Database.Database,
    owner: string,
    name: string,
    now = new Date().toISOString(),
) {
    const row = db
        .prepare(
            "SELECT id FROM repositories WHERE owner = ? COLLATE NOCASE AND name = ? COLLATE NOCASE",
        )
        .get(owner, name) as { id: number } | undefined;
    return row ? getRepositoryStats(db, row.id, now) : null;
}

export function getReleaseStats(
    db: Database.Database,
    releaseId: number,
    now = new Date().toISOString(),
) {
    const release = db
        .prepare(
            "SELECT rel.id, rel.repository_id, rel.tag_name, rel.name, rel.published_at, rel.prerelease, rel.draft, r.owner, r.name AS repository, r.last_polled_at FROM releases rel JOIN repositories r ON r.id = rel.repository_id WHERE rel.id = ?",
        )
        .get(releaseId) as Record<string, unknown> | undefined;
    if (!release) return null;
    return { ...release, ...getScopeStats(db, { releaseId }, now) };
}

export function getAssetStats(
    db: Database.Database,
    assetId: number,
    now = new Date().toISOString(),
) {
    const assets = getScopeStats(db, { assetId }, now);
    return assets?.assets[0] ?? null;
}

function getScopeStats(
    db: Database.Database,
    scope: Scope,
    now: string,
    meta?: Record<string, unknown>,
) {
    const assets = loadAssets(db, scope);
    if (!assets.length && scope.assetId !== undefined) return null;
    const from24 = shift(now, -86400000);
    const from7 = shift(now, -7 * 86400000);
    const from30 = shift(now, -30 * 86400000);
    const samples = loadSamples(
        db,
        assets.map((a) => a.db_asset_id),
        from30,
        now,
    );
    return summarizeScope(assets, samples, from24, from7, from30, now, meta);
}

function summarizeScope(
    assets: RawAsset[],
    samples: Map<number, Sample[]>,
    from24: string,
    from7: string,
    from30: string,
    now: string,
    meta?: Record<string, unknown>,
) {
    const assetStats = makeAssetStatsFromSamples(
        assets,
        samples,
        from24,
        from7,
        from30,
        now,
    );
    const metrics = summarizeAssetMetrics(assetStats);
    return {
        ...sanitizeMeta(meta),
        metrics: {
            ...metrics,
            releaseCount:
                typeof meta?.release_count === "number"
                    ? meta.release_count
                    : new Set(assets.map((asset) => asset.release_id)).size,
            latestRelease:
                typeof meta?.latest_release === "string"
                    ? meta.latest_release
                    : (assets
                          .map((asset) => asset.published_at)
                          .filter((v): v is string => Boolean(v))
                          .sort()
                          .at(-1) ?? null),
        },
        lastSuccessfulPoll:
            typeof meta?.last_polled_at === "string"
                ? meta.last_polled_at
                : null,
        assets: assetStats,
    };
}

function sanitizeMeta(meta?: Record<string, unknown>) {
    if (!meta) return meta;
    const copy = { ...meta };
    if (
        typeof copy.last_error === "string" &&
        !/^(GitHub collection failed|GitHub API request failed \(HTTP \d{3}\))$/.test(
            copy.last_error,
        )
    )
        copy.last_error = "Previous collection error (details hidden)";
    return copy;
}

function safeStatusError(value: string | null) {
    if (!value) return null;
    return /^(GitHub collection failed|GitHub API request failed \(HTTP \d{3}\))$/.test(
        value,
    )
        ? value
        : "Previous collection error (details hidden)";
}

function makeAssetStatsFromSamples(
    assets: RawAsset[],
    samples: Map<number, Sample[]>,
    from24: string,
    from7: string,
    from30: string,
    now: string,
): AssetStat[] {
    return assets.map((asset) => {
        const history = samples.get(asset.db_asset_id) ?? [];
        const latest = history.at(-1);
        const platform =
            asset.override_platform ?? classifyPlatform(asset.asset_name);
        const validPackageOverride =
            asset.override_package_type !== null &&
            isPackageTypeForPlatform(platform, asset.override_package_type);
        return {
            githubAssetId: asset.github_asset_id,
            repositoryId: asset.repository_id,
            repository: `${asset.owner}/${asset.repository}`,
            releaseId: asset.release_id,
            releaseName: asset.release_name ?? asset.tag_name,
            name: asset.asset_name,
            size: asset.size,
            contentType: asset.content_type,
            deletedAt: asset.deleted_at,
            total: latest?.download_count ?? null,
            platform,
            override: asset.override_platform !== null,
            packageType: validPackageOverride
                ? (asset.override_package_type as PackageType)
                : classifyPackageType(platform, asset.asset_name),
            packageTypeOverride: validPackageOverride,
            periods: {
                "24h": summarizeWindow(history, from24, now),
                "7d": summarizeWindow(history, from7, now),
                "30d": summarizeWindow(history, from30, now),
            },
        };
    });
}

function summarizeAssetMetrics(assetStats: AssetStat[]) {
    const totals = assetStats.map((asset) => asset.total);
    return {
        total: {
            downloads: totals.reduce<number>(
                (sum, value) => sum + (value ?? 0),
                0,
            ),
            complete: totals.every((value) => value !== null),
            unknownAssets: totals.filter((value) => value === null).length,
        },
        "24h": combineWindows(assetStats.map((asset) => asset.periods["24h"])),
        "7d": combineWindows(assetStats.map((asset) => asset.periods["7d"])),
        "30d": combineWindows(assetStats.map((asset) => asset.periods["30d"])),
    };
}

export function getTimeseries(
    db: Database.Database,
    scope: Scope,
    from: string,
    to: string,
) {
    const assets = loadAssets(db, scope);
    const samples = loadSamples(
        db,
        assets.map((asset) => asset.db_asset_id),
        from,
        to,
    );
    return assets.map((asset) => {
        const history = samples.get(asset.db_asset_id) ?? [];
        let previous = history.find((sample) => sample.timestamp <= from);
        const points = history
            .filter((sample) => sample.timestamp > from)
            .map((sample) => {
                const baseline = previous;
                previous = sample;
                const reset =
                    !baseline ||
                    sample.download_count < baseline.download_count;
                return {
                    timestamp: sample.timestamp,
                    intervalStart: baseline?.timestamp ?? null,
                    downloads: reset
                        ? null
                        : sample.download_count - baseline.download_count,
                    unknown: reset,
                };
            });
        return {
            githubAssetId: asset.github_asset_id,
            name: asset.asset_name,
            releaseId: asset.release_id,
            releaseName: asset.release_name ?? asset.tag_name,
            platform:
                asset.override_platform ?? classifyPlatform(asset.asset_name),
            points,
        };
    });
}

export function getPlatformBreakdown(
    db: Database.Database,
    repositoryId: number | undefined,
    now = new Date().toISOString(),
) {
    const assets = loadAssets(db, {
        repositoryId,
        enabledOnly: repositoryId === undefined,
    });
    const from = shift(now, -30 * 86400000);
    const samples = loadSamples(
        db,
        assets.map((asset) => asset.db_asset_id),
        from,
        now,
    );
    const grouped = new Map<
        string,
        {
            platform: Platform;
            repositoryId: number;
            owner: string;
            repository: string;
            assets: AssetStat[];
        }
    >();
    for (const asset of makeAssetStatsFromSamples(
        assets,
        samples,
        shift(now, -86400000),
        shift(now, -7 * 86400000),
        from,
        now,
    )) {
        const raw = assets.find(
            (row) => row.github_asset_id === asset.githubAssetId,
        )!;
        const key = `${raw.repository_id}:${asset.platform}`;
        const current = grouped.get(key) ?? {
            platform: asset.platform,
            repositoryId: raw.repository_id,
            owner: raw.owner,
            repository: raw.repository,
            assets: [],
        };
        current.assets.push(asset);
        grouped.set(key, current);
    }
    return [...grouped.values()].map((group) => ({
        platform: group.platform,
        repositoryId: group.repositoryId,
        repository: `${group.owner}/${group.repository}`,
        total: {
            downloads: group.assets.reduce(
                (sum, asset) => sum + (asset.total ?? 0),
                0,
            ),
            complete: group.assets.every((asset) => asset.total !== null),
            unknownAssets: group.assets.filter((asset) => asset.total === null)
                .length,
        },
        "30d": combineWindows(
            group.assets.map((asset) => asset.periods["30d"]),
        ),
    }));
}

export type PackageTypeFilters = {
    repositoryId?: number;
    releaseId?: number;
    platform?: Platform;
    assetIds?: number[];
};

export function getPackageTypeBreakdown(
    db: Database.Database,
    filters: PackageTypeFilters = {},
    now = new Date().toISOString(),
) {
    const scope = getScopeStats(
        db,
        {
            repositoryId: filters.repositoryId,
            releaseId: filters.releaseId,
            enabledOnly: filters.repositoryId === undefined,
        },
        now,
    );
    const requestedAssets = filters.assetIds ? new Set(filters.assetIds) : null;
    const assets = (scope?.assets ?? []).filter(
        (asset) =>
            (!filters.platform || asset.platform === filters.platform) &&
            (!requestedAssets || requestedAssets.has(asset.githubAssetId)),
    );
    const groups = new Map<string, AssetStat[]>();
    const byPlatform = new Map<string, AssetStat[]>();
    for (const asset of assets) {
        const groupKey = `${asset.repositoryId}:${asset.platform}:${asset.packageType}`;
        groups.set(groupKey, [...(groups.get(groupKey) ?? []), asset]);
        const platformKey = `${asset.repositoryId}:${asset.platform}`;
        byPlatform.set(platformKey, [
            ...(byPlatform.get(platformKey) ?? []),
            asset,
        ]);
    }
    const periodKeys = ["24h", "7d", "30d"] as const;
    const platformTotals = new Map<string, ReturnType<typeof aggregateTotal>>();
    const platformPeriods = new Map<
        string,
        Record<(typeof periodKeys)[number], WindowValue>
    >();
    for (const [platformKey, platformAssets] of byPlatform) {
        platformTotals.set(platformKey, aggregateTotal(platformAssets));
        platformPeriods.set(
            platformKey,
            Object.fromEntries(
                periodKeys.map((period) => [
                    period,
                    combineWindows(
                        platformAssets.map((asset) => asset.periods[period]),
                    ),
                ]),
            ) as Record<(typeof periodKeys)[number], WindowValue>,
        );
    }
    return [...groups.entries()].map(([key, groupAssets]) => {
        const [repositoryId, platform, packageType] = key.split(":") as [
            string,
            Platform,
            PackageType,
        ];
        const platformKey = `${repositoryId}:${platform}`;
        const total = aggregateTotal(groupAssets);
        const periods = Object.fromEntries(
            periodKeys.map((period) => [
                period,
                combineWindows(
                    groupAssets.map((asset) => asset.periods[period]),
                ),
            ]),
        ) as Record<(typeof periodKeys)[number], WindowValue>;
        const platformTotal = platformTotals.get(platformKey)!;
        const platformWindows = platformPeriods.get(platformKey)!;
        return {
            repositoryId: groupAssets[0].repositoryId,
            repository: groupAssets[0].repository,
            platform,
            packageType,
            assetCount: groupAssets.length,
            total,
            periods,
            share: {
                total: calculateShare(total, platformTotal),
                "24h": calculateShare(periods["24h"], platformWindows["24h"]),
                "7d": calculateShare(periods["7d"], platformWindows["7d"]),
                "30d": calculateShare(periods["30d"], platformWindows["30d"]),
            },
        };
    });
}

function aggregateTotal(assets: AssetStat[]) {
    const known = assets.filter((asset) => asset.total !== null);
    return {
        downloads: known.reduce((sum, asset) => sum + asset.total!, 0),
        complete: known.length === assets.length,
        unknownAssets: assets.length - known.length,
    };
}

function calculateShare(
    part: { downloads: number | null; complete: boolean },
    whole: { downloads: number | null; complete: boolean },
) {
    const complete =
        part.complete &&
        whole.complete &&
        part.downloads !== null &&
        whole.downloads !== null &&
        whole.downloads > 0;
    return {
        percent: complete ? (part.downloads! / whole.downloads!) * 100 : null,
        complete,
    };
}

function shift(iso: string, milliseconds: number) {
    return new Date(new Date(iso).getTime() + milliseconds).toISOString();
}
