export const PLATFORM_NAMES = [
    "Windows",
    "Linux",
    "macOS",
    "Android",
    "Other",
] as const;

export type PlatformMetric = "total" | "30d";
export type PlatformChartSource = {
    platform: string;
    repositoryId: number;
    repository: string;
    total: { downloads: number; complete: boolean; unknownAssets: number };
    "30d": {
        downloads: number | null;
        complete: boolean;
        unknownAssets: number;
    };
};
export type PlatformChartRow = Record<
    string,
    string | number | boolean | null
> & {
    repositoryId: number;
    repository: string;
};

export function preparePlatformChartData(
    platforms: PlatformChartSource[],
    metric: PlatformMetric = "total",
): PlatformChartRow[] {
    const rows = new Map<number, PlatformChartRow>();
    for (const item of platforms) {
        const row = rows.get(item.repositoryId) ?? {
            repositoryId: item.repositoryId,
            repository: item.repository,
        };
        const downloads =
            metric === "total" ? item.total.downloads : item["30d"].downloads;
        const previous = row[item.platform];
        row[item.platform] =
            downloads === null || previous === null
                ? null
                : (typeof previous === "number" ? previous : 0) + downloads;
        const priorComplete = row[`${item.platform}Complete`];
        row[`${item.platform}Complete`] =
            priorComplete !== false && item[metric].complete;
        rows.set(item.repositoryId, row);
    }
    return [...rows.values()];
}
