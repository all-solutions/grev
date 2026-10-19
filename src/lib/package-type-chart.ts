export type PackageTypeMetric = "total" | "24h" | "7d" | "30d";
export type PackageTypeStat = {
    platform: string;
    packageType: string;
    repositoryId?: number;
    repository?: string;
    releaseId?: number;
    releaseName?: string;
    assetCount: number;
    total: { downloads: number; complete: boolean; unknownAssets: number };
    periods: Record<
        "24h" | "7d" | "30d",
        { downloads: number | null; complete: boolean; unknownAssets: number }
    >;
    share: Record<
        PackageTypeMetric,
        { percent: number | null; complete: boolean }
    >;
};

export type PackageTypeChartRow = Record<
    string,
    string | number | boolean | null
> & { repositoryId: number; repository: string };

export function packageMetric(
    item: PackageTypeStat,
    metric: PackageTypeMetric,
) {
    return metric === "total" ? item.total : item.periods[metric];
}

export function preparePackageTypeChart(
    items: PackageTypeStat[],
    metric: PackageTypeMetric,
) {
    const rows = new Map<number, PackageTypeChartRow>();
    const series = new Map<string, { label: string; colorKey: string }>();
    for (const item of items) {
        if (item.repositoryId === undefined || !item.repository) continue;
        const row = rows.get(item.repositoryId) ?? {
            repositoryId: item.repositoryId,
            repository: item.repository,
        };
        const key = `${item.platform} · ${item.packageType}`;
        const current = packageMetric(item, metric);
        row[key] = current.downloads;
        row[`${key}Complete`] = current.complete;
        row[`${key}Assets`] = item.assetCount;
        series.set(key, { label: key, colorKey: item.packageType });
        rows.set(item.repositoryId, row);
    }
    return { rows: [...rows.values()], series: [...series.entries()] };
}
