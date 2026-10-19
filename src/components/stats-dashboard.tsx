"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowDownWideNarrow,
    ArrowUpRight,
    BarChart3,
    Clock3,
    Download,
    GitFork,
    Layers3,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PackageTypeComparison } from "@/components/package-type-charts";
import { PLATFORM_NAMES, preparePlatformChartData } from "@/lib/platform-chart";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type WindowMetric = {
    downloads: number | null;
    complete: boolean;
    unknownAssets: number;
};
type Repo = {
    id: number;
    owner: string;
    name: string;
    last_polled_at: string | null;
    last_error: string | null;
    metrics: {
        total: { downloads: number; complete: boolean; unknownAssets: number };
        "24h": WindowMetric;
        "7d": WindowMetric;
        "30d": WindowMetric;
        releaseCount: number;
        latestRelease: string | null;
    };
};
type Summary = {
    generatedAt: string;
    repositories: Repo[];
    monitoredRepositories: number;
    lastSuccessfulPoll: string | null;
    totals: {
        total: { downloads: number; complete: boolean; unknownAssets: number };
        "24h": WindowMetric;
        "7d": WindowMetric;
        "30d": WindowMetric;
        releaseCount: number;
    };
};
type PlatformRow = {
    platform: string;
    repositoryId: number;
    repository: string;
    total: { downloads: number; complete: boolean; unknownAssets: number };
    "30d": WindowMetric;
};

function count(value: number | null, complete = true) {
    if (value === null) return "Unknown";
    return `${complete ? "" : "≥ "}${value.toLocaleString()}`;
}
function date(value: string | null) {
    return value ? new Date(value).toLocaleString() : "—";
}

export function StatCard({
    label,
    value,
    detail,
    icon: Icon,
}: {
    label: string;
    value: string;
    detail?: string;
    icon: typeof Download;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tabular-nums">{value}</div>
                {detail && (
                    <p className="mt-1 text-xs text-muted-foreground">
                        {detail}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export function StatsDashboard({
    summary,
    platforms,
}: {
    summary: Summary;
    platforms: PlatformRow[];
}) {
    const [sort, setSort] = useState("total");
    const [direction, setDirection] = useState("desc");
    const sorted = useMemo(
        () =>
            [...summary.repositories].sort((a, b) => {
                let result = 0;
                if (sort === "name")
                    result = `${a.owner}/${a.name}`.localeCompare(
                        `${b.owner}/${b.name}`,
                    );
                else if (sort === "24h" || sort === "7d" || sort === "30d")
                    result =
                        (a.metrics[sort].downloads ?? -1) -
                        (b.metrics[sort].downloads ?? -1);
                else
                    result =
                        a.metrics.total.downloads - b.metrics.total.downloads;
                return direction === "desc" && sort !== "name"
                    ? -result
                    : result;
            }),
        [summary.repositories, sort, direction],
    );
    const chartData = useMemo(
        () => preparePlatformChartData(platforms),
        [platforms],
    );
    const platformNames = PLATFORM_NAMES;
    const colors: Record<string, string> = {
        Windows: "#6366f1",
        Linux: "#22c55e",
        macOS: "#06b6d4",
        Android: "#f59e0b",
        Other: "#a1a1aa",
    };

    return (
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-16 pt-8 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                        GREV Monitor
                    </p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                        Release downloads
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        Actual observations from your monitored GitHub
                        repositories.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" asChild>
                        <Link href="/explore">Explore releases</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/settings/repositories">
                            Manage repositories
                        </Link>
                    </Button>
                </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard
                    label="All-time downloads"
                    value={count(
                        summary.totals.total.downloads,
                        summary.totals.total.complete,
                    )}
                    detail={
                        summary.totals.total.complete
                            ? "Latest known cumulative asset counters"
                            : `${summary.totals.total.unknownAssets} assets have no snapshot yet`
                    }
                    icon={Download}
                />
                <StatCard
                    label="Last 24 hours"
                    value={count(
                        summary.totals["24h"].downloads,
                        summary.totals["24h"].complete,
                    )}
                    detail={
                        summary.totals["24h"].complete
                            ? "Snapshot-to-snapshot change"
                            : `${summary.totals["24h"].unknownAssets} assets incomplete or reset`
                    }
                    icon={Clock3}
                />
                <StatCard
                    label="Last 7 days"
                    value={count(
                        summary.totals["7d"].downloads,
                        summary.totals["7d"].complete,
                    )}
                    detail={`${summary.totals["7d"].unknownAssets} unknown asset intervals`}
                    icon={BarChart3}
                />
                <StatCard
                    label="Last 30 days"
                    value={count(
                        summary.totals["30d"].downloads,
                        summary.totals["30d"].complete,
                    )}
                    detail={`${summary.totals["30d"].unknownAssets} unknown asset intervals`}
                    icon={BarChart3}
                />
                <StatCard
                    label="Repositories"
                    value={summary.monitoredRepositories.toLocaleString()}
                    detail={`${summary.totals.releaseCount.toLocaleString()} collected releases`}
                    icon={GitFork}
                />
                <StatCard
                    label="Last successful collector"
                    value={
                        summary.lastSuccessfulPoll
                            ? date(summary.lastSuccessfulPoll)
                            : "Not yet"
                    }
                    detail={`Statistics generated ${date(summary.generatedAt)}`}
                    icon={Layers3}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Repositories</CardTitle>
                    <CardDescription>
                        Totals include the latest known counters; period totals
                        use observed snapshots only.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {sorted.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-10 text-center">
                            <h2 className="text-lg font-semibold">
                                No repositories are being monitored yet
                            </h2>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Add a GitHub repository to begin collecting
                                release download history.
                            </p>
                            <Button className="mt-5" asChild>
                                <Link href="/settings/repositories">
                                    Open repository settings
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                <label
                                    className="text-sm text-muted-foreground"
                                    htmlFor="repo-sort"
                                >
                                    Sort by
                                </label>
                                <select
                                    id="repo-sort"
                                    className="h-9 rounded-md border bg-background px-3 text-sm"
                                    value={sort}
                                    onChange={(event) =>
                                        setSort(event.target.value)
                                    }
                                >
                                    <option value="total">
                                        Total downloads
                                    </option>
                                    <option value="24h">Last 24 hours</option>
                                    <option value="7d">Last 7 days</option>
                                    <option value="30d">Last 30 days</option>
                                    <option value="name">Name</option>
                                </select>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Toggle sort direction"
                                    onClick={() =>
                                        setDirection(
                                            direction === "desc"
                                                ? "asc"
                                                : "desc",
                                        )
                                    }
                                >
                                    <ArrowDownWideNarrow className="size-4" />
                                </Button>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                {sorted.map((repo) => (
                                    <Link
                                        key={repo.id}
                                        href={`/repositories/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`}
                                        className="group rounded-xl border bg-card p-4 transition hover:border-primary/50 hover:bg-accent/30"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="font-semibold group-hover:text-primary">
                                                    {repo.owner}/{repo.name}
                                                </h3>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {repo.metrics.releaseCount}{" "}
                                                    releases · Latest{" "}
                                                    {date(
                                                        repo.metrics
                                                            .latestRelease,
                                                    )}
                                                </p>
                                            </div>
                                            <ArrowUpRight className="size-4 text-muted-foreground" />
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                                            <Mini
                                                label="Total"
                                                value={count(
                                                    repo.metrics.total
                                                        .downloads,
                                                    repo.metrics.total.complete,
                                                )}
                                            />
                                            <Mini
                                                label="24h"
                                                value={count(
                                                    repo.metrics["24h"]
                                                        .downloads,
                                                    repo.metrics["24h"]
                                                        .complete,
                                                )}
                                            />
                                            <Mini
                                                label="7d"
                                                value={count(
                                                    repo.metrics["7d"]
                                                        .downloads,
                                                    repo.metrics["7d"].complete,
                                                )}
                                            />
                                            <Mini
                                                label="30d"
                                                value={count(
                                                    repo.metrics["30d"]
                                                        .downloads,
                                                    repo.metrics["30d"]
                                                        .complete,
                                                )}
                                            />
                                        </div>
                                        <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                                            Updated {date(repo.last_polled_at)}
                                            {repo.last_error && (
                                                <span className="ml-2 text-destructive">
                                                    · {repo.last_error}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {chartData.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Platform comparison</CardTitle>
                        <CardDescription>
                            Latest cumulative downloads by detected platform and
                            repository. Incomplete totals are lower bounds.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="w-full overflow-x-auto">
                            <div
                                className="h-[390px]"
                                style={{
                                    minWidth: Math.max(
                                        640,
                                        chartData.length * 120,
                                    ),
                                }}
                            >
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={chartData}
                                        margin={{
                                            top: 12,
                                            right: 12,
                                            left: 4,
                                            bottom: 28,
                                        }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={false}
                                        />
                                        <XAxis
                                            dataKey="repository"
                                            interval={0}
                                            height={38}
                                            tickMargin={10}
                                            tickFormatter={(value) =>
                                                String(value)
                                                    .split("/")
                                                    .at(-1) ?? String(value)
                                            }
                                            tick={{ fontSize: 11 }}
                                        />
                                        <YAxis
                                            tickFormatter={(value: number) =>
                                                value.toLocaleString()
                                            }
                                        />
                                        <Tooltip<number, string>
                                            labelFormatter={(_label, payload) =>
                                                payload?.[0]?.payload
                                                    ?.repository ?? _label
                                            }
                                            formatter={(value, name, item) => {
                                                const downloads = Number(value);
                                                const complete =
                                                    item.payload?.[
                                                        `${String(name)}Complete`
                                                    ] !== false;
                                                return [
                                                    `${complete ? "" : "≥ "}${downloads.toLocaleString()}`,
                                                    String(name),
                                                ];
                                            }}
                                        />
                                        <Legend verticalAlign="bottom" />
                                        {platformNames.map((name) => (
                                            <Bar
                                                key={name}
                                                name={name}
                                                dataKey={name}
                                                stackId="platform"
                                                fill={colors[name]}
                                            />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
            <PackageTypeComparison
                repositories={summary.repositories.map((repo) => ({
                    id: repo.id,
                    owner: repo.owner,
                    name: repo.name,
                }))}
            />
        </div>
    );
}

export function RepositoryPlatformChart({
    platforms,
}: {
    platforms: PlatformRow[];
}) {
    const [metric, setMetric] = useState<"total" | "30d">("total");
    const names = PLATFORM_NAMES;
    const colors: Record<string, string> = {
        Windows: "#6366f1",
        Linux: "#22c55e",
        macOS: "#06b6d4",
        Android: "#f59e0b",
        Other: "#a1a1aa",
    };
    const row = preparePlatformChartData(platforms, metric)[0];
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <CardTitle>Platform breakdown</CardTitle>
                        <CardDescription>
                            Detected from asset names and file types. Partial
                            values are lower bounds.
                        </CardDescription>
                    </div>
                    <select
                        aria-label="Platform chart metric"
                        className="h-8 rounded-md border bg-background px-2 text-sm"
                        value={metric}
                        onChange={(event) =>
                            setMetric(event.target.value as "total" | "30d")
                        }
                    >
                        <option value="total">All-time</option>
                        <option value="30d">Last 30 days</option>
                    </select>
                </div>
            </CardHeader>
            <CardContent>
                {platforms.length ? (
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[row]}
                                margin={{
                                    top: 8,
                                    right: 10,
                                    left: 0,
                                    bottom: 34,
                                }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                />
                                <XAxis dataKey="repository" hide />
                                <YAxis
                                    tickFormatter={(value: number) =>
                                        value.toLocaleString()
                                    }
                                />
                                <Tooltip<number, string>
                                    labelFormatter={(_label, payload) =>
                                        payload?.[0]?.payload?.repository ??
                                        _label
                                    }
                                    formatter={(value, name, item) => {
                                        const downloads = Number(value);
                                        const complete =
                                            item.payload?.[
                                                `${String(name)}Complete`
                                            ] !== false;
                                        return [
                                            `${complete ? "" : "≥ "}${downloads.toLocaleString()}`,
                                            String(name),
                                        ];
                                    }}
                                />
                                <Legend verticalAlign="bottom" />
                                {names.map((name) => (
                                    <Bar
                                        key={name}
                                        name={name}
                                        dataKey={name}
                                        stackId="platform"
                                        fill={colors[name]}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                        No assets available for platform classification.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function Mini({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold tabular-nums">{value}</p>
        </div>
    );
}

export function DownloadTrendChart({
    repositoryId,
    releases,
    assets,
}: {
    repositoryId: number;
    releases: { id: number; title: string }[];
    assets: { githubAssetId: number; releaseId: number; name: string }[];
}) {
    const [period, setPeriod] = useState("30d");
    const [chartType, setChartType] = useState<"bar" | "line">("bar");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [mode, setMode] = useState<"repository" | "releases" | "assets">(
        "repository",
    );
    const [selectedReleaseIds, setSelectedReleaseIds] = useState<number[]>(
        releases.slice(0, 4).map((release) => release.id),
    );
    const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>(
        assets.slice(0, 5).map((asset) => asset.githubAssetId),
    );
    const [assetReleaseId, setAssetReleaseId] = useState<number | null>(
        releases[0]?.id ?? null,
    );
    const [series, setSeries] = useState<
        {
            githubAssetId: number;
            name: string;
            releaseId: number;
            releaseName: string;
            points: {
                timestamp: string;
                intervalStart: string | null;
                downloads: number | null;
                unknown: boolean;
            }[];
        }[]
    >([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const query = useMemo(() => {
        const params = new URLSearchParams({
            repositoryId: String(repositoryId),
            period,
        });
        if (period === "custom" && fromDate && toDate) {
            params.set("from", new Date(`${fromDate}T00:00:00Z`).toISOString());
            params.set("to", new Date(`${toDate}T23:59:59.999Z`).toISOString());
        }
        return `/api/stats/timeseries?${params}`;
    }, [repositoryId, period, fromDate, toDate]);
    useEffect(() => {
        let active = true;
        fetch(query)
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok)
                    throw new Error(
                        data.error || "Could not load observations",
                    );
                if (active) {
                    setSeries(data.series);
                    setError("");
                }
            })
            .catch((reason) => {
                if (active)
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : "Could not load observations",
                    );
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [query]);
    const activeSeries = useMemo(() => {
        if (mode === "assets")
            return series.filter((item) =>
                selectedAssetIds.includes(item.githubAssetId),
            );
        if (mode === "releases")
            return series.filter((item) =>
                selectedReleaseIds.includes(item.releaseId),
            );
        return series;
    }, [mode, series, selectedAssetIds, selectedReleaseIds]);
    const data = useMemo(() => {
        const timestamps = new Set(
            activeSeries.flatMap((item) =>
                item.points.map((point) => point.timestamp),
            ),
        );
        return [...timestamps].sort().map((timestamp) => {
            const row: Record<string, string | number | null> = { timestamp };
            if (mode === "assets") {
                for (const item of activeSeries)
                    row[`asset-${item.githubAssetId}`] =
                        item.points.find(
                            (point) => point.timestamp === timestamp,
                        )?.downloads ?? null;
            } else {
                const groups =
                    mode === "repository"
                        ? [
                              {
                                  key: "repository",
                                  ids: new Set(
                                      activeSeries.map(
                                          (item) => item.githubAssetId,
                                      ),
                                  ),
                              },
                          ]
                        : selectedReleaseIds.map((id) => ({
                              key: `release-${id}`,
                              ids: new Set(
                                  activeSeries
                                      .filter((item) => item.releaseId === id)
                                      .map((item) => item.githubAssetId),
                              ),
                          }));
                for (const group of groups) {
                    const points = activeSeries
                        .filter((item) => group.ids.has(item.githubAssetId))
                        .flatMap((item) =>
                            item.points.filter(
                                (point) => point.timestamp === timestamp,
                            ),
                        );
                    const known = points.filter(
                        (point) => point.downloads !== null,
                    );
                    const unknown = points.some((point) => point.unknown);
                    row[group.key] =
                        points.length === 0 ||
                        points.length < group.ids.size ||
                        unknown
                            ? null
                            : known.reduce(
                                  (sum, point) => sum + (point.downloads ?? 0),
                                  0,
                              );
                }
            }
            return row;
        });
    }, [activeSeries, mode, selectedReleaseIds]);
    const lineKeys =
        mode === "assets"
            ? activeSeries.map((item) => `asset-${item.githubAssetId}`)
            : mode === "repository"
              ? ["repository"]
              : selectedReleaseIds
                    .map((id) => `release-${id}`)
                    .filter((key) =>
                        activeSeries.some(
                            (item) => `release-${item.releaseId}` === key,
                        ),
                    );
    const palette = [
        "#6366f1",
        "#06b6d4",
        "#f97316",
        "#22c55e",
        "#e11d48",
        "#a855f7",
        "#eab308",
        "#14b8a6",
    ];
    const labels = new Map<number, string>([
        ...assets.map(
            (asset) => [asset.githubAssetId, asset.name] as [number, string],
        ),
        ...releases.map(
            (release) => [release.id, release.title] as [number, string],
        ),
    ]);
    const toggle = (
        list: number[],
        setList: (next: number[]) => void,
        id: number,
    ) =>
        setList(
            list.includes(id)
                ? list.filter((item) => item !== id)
                : [...list, id],
        );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Download development</CardTitle>
                <CardDescription>
                    Each point shows change between two actual snapshots. Gaps
                    are not interpolated; reset intervals are unknown.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    {["24h", "7d", "30d", "90d", "all", "custom"].map((key) => (
                        <Button
                            key={key}
                            size="sm"
                            variant={period === key ? "default" : "secondary"}
                            onClick={() => {
                                setPeriod(key);
                                if (key === "custom" && !fromDate && !toDate) {
                                    const today = new Date();
                                    setToDate(today.toISOString().slice(0, 10));
                                    setFromDate(
                                        new Date(
                                            today.getTime() - 30 * 86400000,
                                        )
                                            .toISOString()
                                            .slice(0, 10),
                                    );
                                    setLoading(true);
                                }
                            }}
                        >
                            {key === "all"
                                ? "All history"
                                : key === "custom"
                                  ? "Custom"
                                  : key}
                        </Button>
                    ))}
                    {period === "custom" && (
                        <>
                            <Input
                                aria-label="Start date"
                                type="date"
                                className="h-8 w-auto"
                                value={fromDate}
                                onChange={(event) => {
                                    setFromDate(event.target.value);
                                    setLoading(true);
                                }}
                            />
                            <span>to</span>
                            <Input
                                aria-label="End date"
                                type="date"
                                className="h-8 w-auto"
                                value={toDate}
                                onChange={(event) => {
                                    setToDate(event.target.value);
                                    setLoading(true);
                                }}
                            />
                        </>
                    )}
                    <span className="mx-1 border-l" />
                    {(["repository", "releases", "assets"] as const).map(
                        (key) => (
                            <Button
                                key={key}
                                size="sm"
                                variant={mode === key ? "default" : "ghost"}
                                onClick={() => setMode(key)}
                            >
                                {key === "repository"
                                    ? "Repository"
                                    : key === "releases"
                                      ? "Compare releases"
                                      : "Compare assets"}
                            </Button>
                        ),
                    )}
                    <span className="mx-1 border-l" />
                    <Button
                        size="sm"
                        variant={chartType === "bar" ? "default" : "ghost"}
                        onClick={() => setChartType("bar")}
                    >
                        Bars
                    </Button>
                    <Button
                        size="sm"
                        variant={chartType === "line" ? "default" : "ghost"}
                        onClick={() => setChartType("line")}
                    >
                        Lines
                    </Button>
                </div>
                {mode === "releases" && (
                    <div className="flex flex-wrap gap-3">
                        {releases.map((release) => (
                            <label
                                key={release.id}
                                className="flex items-center gap-2 text-sm"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedReleaseIds.includes(
                                        release.id,
                                    )}
                                    onChange={() =>
                                        toggle(
                                            selectedReleaseIds,
                                            setSelectedReleaseIds,
                                            release.id,
                                        )
                                    }
                                />
                                {release.title}
                            </label>
                        ))}
                    </div>
                )}
                {mode === "assets" && (
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm">
                            Release
                            <select
                                className="h-8 rounded-md border bg-background px-2"
                                value={assetReleaseId ?? ""}
                                onChange={(event) => {
                                    const releaseId = Number(
                                        event.target.value,
                                    );
                                    setAssetReleaseId(releaseId);
                                    setSelectedAssetIds(
                                        assets
                                            .filter(
                                                (asset) =>
                                                    asset.releaseId ===
                                                    releaseId,
                                            )
                                            .slice(0, 5)
                                            .map(
                                                (asset) => asset.githubAssetId,
                                            ),
                                    );
                                }}
                            >
                                {releases.map((release) => (
                                    <option key={release.id} value={release.id}>
                                        {release.title}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="flex max-h-28 flex-wrap gap-x-4 gap-y-2 overflow-auto">
                            {assets
                                .filter(
                                    (asset) =>
                                        asset.releaseId === assetReleaseId,
                                )
                                .map((asset) => (
                                    <label
                                        key={asset.githubAssetId}
                                        className="flex items-center gap-2 text-xs"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedAssetIds.includes(
                                                asset.githubAssetId,
                                            )}
                                            onChange={() =>
                                                toggle(
                                                    selectedAssetIds,
                                                    setSelectedAssetIds,
                                                    asset.githubAssetId,
                                                )
                                            }
                                        />
                                        {asset.name}
                                    </label>
                                ))}
                        </div>
                    </div>
                )}
                {loading ? (
                    <div className="flex h-[320px] items-center justify-center text-muted-foreground">
                        Loading snapshot history…
                    </div>
                ) : error ? (
                    <p
                        role="alert"
                        className="py-12 text-center text-sm text-destructive"
                    >
                        {error}
                    </p>
                ) : data.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                        No snapshot intervals are available in this range yet.
                    </p>
                ) : (
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={data}
                                margin={{
                                    top: 8,
                                    right: 12,
                                    left: 4,
                                    bottom: 35,
                                }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="timestamp"
                                    tickFormatter={(value) =>
                                        new Date(value).toLocaleDateString()
                                    }
                                    minTickGap={24}
                                    tick={{ fontSize: 11 }}
                                />
                                <YAxis
                                    tickFormatter={(value: number) =>
                                        value.toLocaleString()
                                    }
                                />
                                <Tooltip
                                    labelFormatter={(value) =>
                                        `Observed at ${new Date(String(value)).toLocaleString()}`
                                    }
                                    formatter={(value, key) => [
                                        value === null
                                            ? "Unknown / no observation"
                                            : Number(value).toLocaleString(),
                                        mode === "assets"
                                            ? (labels.get(
                                                  Number(
                                                      String(key).replace(
                                                          "asset-",
                                                          "",
                                                      ),
                                                  ),
                                              ) ?? key)
                                            : mode === "releases"
                                              ? (labels.get(
                                                    Number(
                                                        String(key).replace(
                                                            "release-",
                                                            "",
                                                        ),
                                                    ),
                                                ) ?? key)
                                              : "Repository interval",
                                    ]}
                                />
                                <Legend />
                                {chartType === "bar"
                                    ? lineKeys.map((key, index) => (
                                          <Bar
                                              key={key}
                                              name={
                                                  mode === "assets"
                                                      ? labels.get(
                                                            Number(
                                                                key.replace(
                                                                    "asset-",
                                                                    "",
                                                                ),
                                                            ),
                                                        )
                                                      : mode === "releases"
                                                        ? labels.get(
                                                              Number(
                                                                  key.replace(
                                                                      "release-",
                                                                      "",
                                                                  ),
                                                              ),
                                                          )
                                                        : "Repository"
                                              }
                                              dataKey={key}
                                              fill={
                                                  palette[
                                                      index % palette.length
                                                  ]
                                              }
                                          />
                                      ))
                                    : lineKeys.map((key, index) => (
                                          <Line
                                              key={key}
                                              name={
                                                  mode === "assets"
                                                      ? labels.get(
                                                            Number(
                                                                key.replace(
                                                                    "asset-",
                                                                    "",
                                                                ),
                                                            ),
                                                        )
                                                      : mode === "releases"
                                                        ? labels.get(
                                                              Number(
                                                                  key.replace(
                                                                      "release-",
                                                                      "",
                                                                  ),
                                                              ),
                                                          )
                                                        : "Repository"
                                              }
                                              type="monotone"
                                              dataKey={key}
                                              stroke={
                                                  palette[
                                                      index % palette.length
                                                  ]
                                              }
                                              dot={false}
                                              connectNulls={false}
                                          />
                                      ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}
                <p className="text-xs text-muted-foreground">
                    Bars are assigned to the later snapshot timestamp and
                    represent the full observed interval. Unknown reset or
                    missing-baseline values are not counted.
                </p>
            </CardContent>
        </Card>
    );
}

export function PlatformCorrection({
    assetId,
    initialPlatform,
    isOverride,
}: {
    assetId: number;
    initialPlatform: string;
    isOverride: boolean;
}) {
    const router = useRouter();
    const [token, setToken] = useState("");
    const [platform, setPlatform] = useState(initialPlatform);
    const [message, setMessage] = useState("");
    async function save(reset = false) {
        const response = await fetch(`/api/admin/assets/${assetId}/platform`, {
            method: reset ? "DELETE" : "PATCH",
            headers: {
                Authorization: `Bearer ${token}`,
                ...(reset ? {} : { "Content-Type": "application/json" }),
            },
            ...(reset ? {} : { body: JSON.stringify({ platform }) }),
        });
        const body = await response.json().catch(() => ({}));
        setMessage(
            response.ok
                ? reset
                    ? "Automatic category restored."
                    : "Platform override saved."
                : body.error || "Could not save override.",
        );
        if (response.ok) router.refresh();
    }
    return (
        <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
                type="password"
                autoComplete="off"
                aria-label="Admin token for platform correction"
                placeholder="Admin token to edit"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="h-8 w-40 text-xs"
            />
            <select
                aria-label={`Platform for ${assetId}`}
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-xs"
            >
                {["Windows", "Linux", "macOS", "Android", "Other"].map(
                    (item) => (
                        <option key={item}>{item}</option>
                    ),
                )}
            </select>
            <Button
                size="sm"
                variant="secondary"
                disabled={!token}
                onClick={() => void save()}
            >
                Save
            </Button>
            {isOverride && (
                <Button
                    size="sm"
                    variant="ghost"
                    disabled={!token}
                    onClick={() => void save(true)}
                >
                    Auto
                </Button>
            )}
            {message && (
                <span role="status" className="text-xs text-muted-foreground">
                    {message}
                </span>
            )}
        </div>
    );
}
