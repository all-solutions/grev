"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    PACKAGE_TYPES_BY_PLATFORM,
    PLATFORMS,
    type Platform,
} from "@/lib/platform";
import {
    packageMetric,
    preparePackageTypeChart,
    type PackageTypeMetric,
    type PackageTypeStat,
} from "@/lib/package-type-chart";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const colors: Record<string, string> = {
    Portable: "#6366f1",
    Installer: "#8b5cf6",
    DEB: "#22c55e",
    RPM: "#84cc16",
    AppImage: "#14b8a6",
    Archive: "#06b6d4",
    DMG: "#0ea5e9",
    PKG: "#0284c7",
    ZIP: "#38bdf8",
    APK: "#f59e0b",
    AAB: "#f97316",
    Other: "#a1a1aa",
};

function usePackageTypes(query: string) {
    const [data, setData] = useState<PackageTypeStat[]>([]);
    const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        fetch(`/api/stats/package-types?${query}`)
            .then(async (response) => {
                const result = await response.json();
                if (!response.ok)
                    throw new Error(
                        result.error || "Could not load package statistics.",
                    );
                if (active) {
                    setData(result.packageTypes);
                    setError("");
                }
            })
            .catch((reason) => {
                if (active)
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : "Could not load package statistics.",
                    );
            })
            .finally(() => {
                if (active) setLoadedQuery(query);
            });
        return () => {
            active = false;
        };
    }, [query]);
    return { data, loading: loadedQuery !== query, error };
}

function PackageBarChart({
    data,
    metric,
}: {
    data: PackageTypeStat[];
    metric: PackageTypeMetric;
}) {
    const chart = useMemo(
        () => preparePackageTypeChart(data, metric),
        [data, metric],
    );
    const series = chart.series;
    if (!chart.rows.length || !series.length)
        return (
            <p className="py-10 text-center text-sm text-muted-foreground">
                No package type statistics available for this selection.
            </p>
        );
    const width = Math.max(640, chart.rows.length * 135);
    return (
        <div className="overflow-x-auto">
            <div className="h-[360px]" style={{ minWidth: width }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chart.rows}
                        margin={{ top: 12, right: 16, left: 4, bottom: 44 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="repository"
                            tickFormatter={(value) =>
                                String(value).split("/").at(-1) ?? String(value)
                            }
                            interval={0}
                            tick={{ fontSize: 11 }}
                            tickMargin={10}
                        />
                        <YAxis
                            tickFormatter={(value: number) =>
                                value.toLocaleString()
                            }
                        />
                        <Tooltip<number, string>
                            labelFormatter={(_label, payload) =>
                                payload?.[0]?.payload?.repository ?? _label
                            }
                            formatter={(value, name, item) => {
                                const complete =
                                    item.payload?.[
                                        `${String(name)}Complete`
                                    ] !== false;
                                const assetCount =
                                    item.payload?.[`${String(name)}Assets`];
                                return [
                                    `${complete ? "" : "≥ "}${Number(value).toLocaleString()} downloads · ${assetCount ?? 0} assets`,
                                    String(name),
                                ];
                            }}
                        />
                        <Legend verticalAlign="bottom" />
                        {series.map(([key, value]) => (
                            <Bar
                                key={key}
                                name={value.label}
                                dataKey={key}
                                stackId="package-type"
                                fill={colors[value.colorKey] ?? colors.Other}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function metricLabel(metric: PackageTypeMetric) {
    return metric === "total" ? "All-time downloads" : `${metric} downloads`;
}

export function PackageTypeComparison({
    repositories,
}: {
    repositories: { id: number; owner: string; name: string }[];
}) {
    const [repositoryId, setRepositoryId] = useState("all");
    const [platform, setPlatform] = useState("all");
    const [metric, setMetric] = useState<PackageTypeMetric>("total");
    const query = useMemo(() => {
        const params = new URLSearchParams();
        if (repositoryId !== "all") params.set("repositoryId", repositoryId);
        if (platform !== "all") params.set("platform", platform);
        return params.toString();
    }, [repositoryId, platform]);
    const { data, loading, error } = usePackageTypes(query);
    const repositoriesById = new Map(
        repositories.map((item) => [item.id, `${item.owner}/${item.name}`]),
    );
    const displayData = data.map((item) => ({
        ...item,
        repository:
            repositoriesById.get(item.repositoryId ?? -1) ?? item.repository,
    }));
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <CardTitle>Package type comparison</CardTitle>
                        <CardDescription>
                            Compare actual downloads by distribution format.
                            Partial values are marked as lower bounds; missing
                            intervals remain unknown.
                        </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select
                            aria-label="Package statistics repository"
                            className="h-8 rounded-md border bg-background px-2 text-sm"
                            value={repositoryId}
                            onChange={(event) =>
                                setRepositoryId(event.target.value)
                            }
                        >
                            <option value="all">All repositories</option>
                            {repositories.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.owner}/{item.name}
                                </option>
                            ))}
                        </select>
                        <select
                            aria-label="Package statistics platform"
                            className="h-8 rounded-md border bg-background px-2 text-sm"
                            value={platform}
                            onChange={(event) =>
                                setPlatform(event.target.value)
                            }
                        >
                            <option value="all">All platforms</option>
                            {PLATFORMS.map((value) => (
                                <option key={value} value={value}>
                                    {value}
                                </option>
                            ))}
                        </select>
                        <select
                            aria-label="Package statistics period"
                            className="h-8 rounded-md border bg-background px-2 text-sm"
                            value={metric}
                            onChange={(event) =>
                                setMetric(
                                    event.target.value as PackageTypeMetric,
                                )
                            }
                        >
                            <option value="total">All-time</option>
                            <option value="24h">Last 24 hours</option>
                            <option value="7d">Last 7 days</option>
                            <option value="30d">Last 30 days</option>
                        </select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                        Loading package statistics…
                    </p>
                ) : error ? (
                    <p
                        role="alert"
                        className="py-10 text-center text-sm text-destructive"
                    >
                        {error}
                    </p>
                ) : displayData.length ? (
                    <PackageBarChart data={displayData} metric={metric} />
                ) : (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                        No package type statistics available.
                    </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                    {metricLabel(metric)}; shares are reported in release
                    details only when the platform totals are complete.
                </p>
            </CardContent>
        </Card>
    );
}

export function RepositoryPackageTypeChart({
    repositoryId,
    releases,
}: {
    repositoryId: number;
    releases: { id: number; title: string }[];
}) {
    const [releaseId, setReleaseId] = useState("all");
    const [platform, setPlatform] = useState<Platform>("Windows");
    const [metric, setMetric] = useState<PackageTypeMetric>("total");
    const query = useMemo(() => {
        const params = new URLSearchParams({
            repositoryId: String(repositoryId),
            platform,
        });
        if (releaseId !== "all") params.set("releaseId", releaseId);
        return params.toString();
    }, [repositoryId, releaseId, platform]);
    const { data, loading, error } = usePackageTypes(query);
    const rows = data.filter((item) => item.platform === platform);
    const keys = PACKAGE_TYPES_BY_PLATFORM[platform];
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                <select
                    aria-label="Package type release"
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                    value={releaseId}
                    onChange={(event) => setReleaseId(event.target.value)}
                >
                    <option value="all">All releases</option>
                    {releases.map((release) => (
                        <option key={release.id} value={release.id}>
                            {release.title}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="Package type platform"
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                    value={platform}
                    onChange={(event) =>
                        setPlatform(event.target.value as Platform)
                    }
                >
                    {PLATFORMS.map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="Package type period"
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                    value={metric}
                    onChange={(event) =>
                        setMetric(event.target.value as PackageTypeMetric)
                    }
                >
                    <option value="total">All-time</option>
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                </select>
            </div>
            {loading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                    Loading package statistics…
                </p>
            ) : error ? (
                <p
                    role="alert"
                    className="py-10 text-center text-sm text-destructive"
                >
                    {error}
                </p>
            ) : rows.length ? (
                <>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={rows.map((item) => ({
                                    ...item,
                                    value: packageMetric(item, metric)
                                        .downloads,
                                    valueComplete: packageMetric(item, metric)
                                        .complete,
                                }))}
                                margin={{
                                    top: 12,
                                    right: 16,
                                    left: 4,
                                    bottom: 24,
                                }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                />
                                <XAxis dataKey="packageType" />
                                <YAxis
                                    tickFormatter={(value: number) =>
                                        value.toLocaleString()
                                    }
                                />
                                <Tooltip
                                    formatter={(value, _name, item) => [
                                        `${item.payload.valueComplete ? "" : "≥ "}${Number(value).toLocaleString()}`,
                                        item.payload.packageType,
                                    ]}
                                />
                                <Bar
                                    name="Downloads"
                                    dataKey="value"
                                    fill="#6366f1"
                                >
                                    {rows.map((item, index) => (
                                        <Cell
                                            key={`${item.packageType}-${index}`}
                                            fill={
                                                colors[item.packageType] ??
                                                colors.Other
                                            }
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 text-xs">
                                <tr>
                                    <th className="p-2">Package type</th>
                                    <th className="p-2">Downloads</th>
                                    <th className="p-2">Platform share</th>
                                    <th className="p-2">Assets</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((item) => {
                                    const selected = packageMetric(
                                        item,
                                        metric,
                                    );
                                    const share = item.share[metric];
                                    return (
                                        <tr
                                            key={item.packageType}
                                            className="border-t"
                                        >
                                            <td className="p-2 font-medium">
                                                {item.packageType}
                                            </td>
                                            <td className="p-2 tabular-nums">
                                                {selected.downloads === null
                                                    ? "Unknown"
                                                    : `${selected.complete ? "" : "≥ "}${selected.downloads.toLocaleString()}`}
                                            </td>
                                            <td className="p-2">
                                                {share.complete &&
                                                share.percent !== null
                                                    ? `${share.percent.toFixed(1)}%`
                                                    : "Incomplete"}
                                            </td>
                                            <td className="p-2 tabular-nums">
                                                {item.assetCount}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                    No {platform} package types in this selection.
                </p>
            )}
            <p className="text-xs text-muted-foreground">
                {metricLabel(metric)}; incomplete sums are lower bounds and
                platform shares are hidden unless both values are complete.
            </p>
            <span className="sr-only">
                Supported package types: {keys.join(", ")}
            </span>
        </div>
    );
}

export function PackageTypeCorrection({
    assetId,
    platform,
    initialPackageType,
    isOverride,
}: {
    assetId: number;
    platform: Platform;
    initialPackageType: string;
    isOverride: boolean;
}) {
    const router = useRouter();
    const [token, setToken] = useState("");
    const [packageType, setPackageType] = useState(initialPackageType);
    const [message, setMessage] = useState("");
    async function save(reset = false) {
        const response = await fetch(
            `/api/admin/assets/${assetId}/package-type`,
            {
                method: reset ? "DELETE" : "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(reset ? {} : { "Content-Type": "application/json" }),
                },
                ...(reset ? {} : { body: JSON.stringify({ packageType }) }),
            },
        );
        const body = await response.json().catch(() => ({}));
        setMessage(
            response.ok
                ? reset
                    ? "Automatic package type restored."
                    : "Package type override saved."
                : body.error || "Could not update package type.",
        );
        if (response.ok) router.refresh();
    }
    return (
        <div className="mt-3 space-y-2 rounded-md border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">
                {isOverride
                    ? "Manual package type override"
                    : "Automatically detected package type"}
            </p>
            <div className="flex flex-wrap gap-2">
                <Input
                    aria-label="Admin token for package type"
                    type="password"
                    autoComplete="off"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="GREV admin token"
                    className="h-8 max-w-xs"
                />
                <select
                    aria-label="Corrected package type"
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                    value={packageType}
                    onChange={(event) => setPackageType(event.target.value)}
                >
                    {PACKAGE_TYPES_BY_PLATFORM[platform].map((value) => (
                        <option key={value} value={value}>
                            {value}
                        </option>
                    ))}
                </select>
                <Button size="sm" onClick={() => void save()} disabled={!token}>
                    Save
                </Button>
                {isOverride && (
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void save(true)}
                        disabled={!token}
                    >
                        Restore automatic
                    </Button>
                )}
            </div>
            {message && (
                <p role="status" className="text-xs text-muted-foreground">
                    {message}
                </p>
            )}
        </div>
    );
}
