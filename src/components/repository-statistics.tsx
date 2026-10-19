"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
    ArrowLeft,
    ExternalLink,
    Package,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    DownloadTrendChart,
    PlatformCorrection,
    RepositoryPlatformChart,
    StatCard,
} from "@/components/stats-dashboard";

type WindowMetric = {
    downloads: number | null;
    complete: boolean;
    unknownAssets: number;
};
type Asset = {
    githubAssetId: number;
    releaseId: number;
    releaseName: string;
    name: string;
    size: number;
    contentType: string | null;
    deletedAt: string | null;
    total: number | null;
    platform: string;
    override: boolean;
    periods: Record<"24h" | "7d" | "30d", WindowMetric>;
};
type Release = {
    id: number;
    tag_name: string;
    name: string | null;
    published_at: string | null;
    prerelease: number;
    draft: number;
    assets: Asset[];
    metrics: {
        total: WindowMetric;
        "24h": WindowMetric;
        "7d": WindowMetric;
        "30d": WindowMetric;
    };
};
type Repository = {
    id: number;
    owner: string;
    name: string;
    last_polled_at: string | null;
    last_error: string | null;
    metrics: {
        total: WindowMetric;
        "24h": WindowMetric;
        "7d": WindowMetric;
        "30d": WindowMetric;
        releaseCount: number;
    };
    assets: Asset[];
    releases: Release[];
    platforms: {
        platform: string;
        repositoryId: number;
        repository: string;
        total: { downloads: number; complete: boolean; unknownAssets: number };
        "30d": WindowMetric;
    }[];
};

function value(metric: WindowMetric) {
    return metric.downloads === null
        ? "Unknown"
        : `${metric.complete ? "" : "≥ "}${metric.downloads.toLocaleString()}`;
}
function date(timestamp: string | null) {
    return timestamp ? new Date(timestamp).toLocaleString() : "—";
}
function formatSize(size: number) {
    if (!size) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(
        Math.floor(Math.log(size) / Math.log(1024)),
        units.length - 1,
    );
    return `${(size / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function RepositoryStatistics({
    repository,
}: {
    repository: Repository;
}) {
    const [selectedRelease, setSelectedRelease] = useState<number | null>(
        repository.releases[0]?.id ?? null,
    );
    const [editingAsset, setEditingAsset] = useState<number | null>(null);
    const releases = repository.releases;
    const selected =
        releases.find((release) => release.id === selectedRelease) ??
        releases[0];
    const assets = selected?.assets ?? [];
    const chartReleases = useMemo(
        () =>
            releases.map((release) => ({
                id: release.id,
                title: release.name || release.tag_name,
            })),
        [releases],
    );

    return (
        <main className="mx-auto min-h-dvh w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <Button variant="ghost" asChild className="mb-3 -ml-3">
                        <Link href="/">
                            <ArrowLeft />
                            Dashboard
                        </Link>
                    </Button>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                        Repository statistics
                    </p>
                    <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
                        {repository.owner}/{repository.name}
                    </h1>
                    <a
                        className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground underline"
                        href={`https://github.com/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Open on GitHub <ExternalLink className="size-3" />
                    </a>
                </div>
                <div className="text-sm text-muted-foreground">
                    Last successful update
                    <br />
                    <span className="font-medium text-foreground">
                        {date(repository.last_polled_at)}
                    </span>
                    {repository.last_error && (
                        <p className="mt-1 text-destructive">
                            {repository.last_error}
                        </p>
                    )}
                </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="All-time downloads"
                    value={value(repository.metrics.total)}
                    detail={`${repository.metrics.total.unknownAssets} assets unknown`}
                    icon={Package}
                />
                <StatCard
                    label="Last 24 hours"
                    value={value(repository.metrics["24h"])}
                    detail={`${repository.metrics["24h"].unknownAssets} incomplete intervals`}
                    icon={TrendingUp}
                />
                <StatCard
                    label="Last 7 days"
                    value={value(repository.metrics["7d"])}
                    detail={`${repository.metrics["7d"].unknownAssets} incomplete intervals`}
                    icon={TrendingUp}
                />
                <StatCard
                    label="Last 30 days"
                    value={value(repository.metrics["30d"])}
                    detail={`${repository.metrics["30d"].unknownAssets} incomplete intervals`}
                    icon={TrendingDown}
                />
            </div>

            <DownloadTrendChart
                repositoryId={repository.id}
                releases={chartReleases}
                assets={repository.assets}
            />
            <RepositoryPlatformChart platforms={repository.platforms} />

            <Card>
                <CardHeader>
                    <CardTitle>Releases</CardTitle>
                    <CardDescription>
                        {repository.metrics.releaseCount} releases stored from
                        the collector snapshot history.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {releases.length === 0 ? (
                        <p className="py-8 text-center text-muted-foreground">
                            No releases collected yet.
                        </p>
                    ) : (
                        releases.map((release) => (
                            <button
                                key={release.id}
                                type="button"
                                onClick={() => setSelectedRelease(release.id)}
                                className={`w-full rounded-lg border p-4 text-left transition ${selected?.id === release.id ? "border-primary bg-primary/5" : "hover:bg-accent/40"}`}
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2 font-semibold">
                                            {release.name || release.tag_name}
                                            <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-normal">
                                                {release.tag_name}
                                            </span>
                                            {Boolean(release.prerelease) && (
                                                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
                                                    Prerelease
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Published{" "}
                                            {date(release.published_at)}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs sm:grid-cols-4">
                                        {[
                                            ["Total", release.metrics.total],
                                            ["24h", release.metrics["24h"]],
                                            ["7d", release.metrics["7d"]],
                                            ["30d", release.metrics["30d"]],
                                        ].map(([label, metric]) => (
                                            <div key={String(label)}>
                                                <span className="text-muted-foreground">
                                                    {String(label)}{" "}
                                                </span>
                                                <b>
                                                    {value(
                                                        metric as WindowMetric,
                                                    )}
                                                </b>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </CardContent>
            </Card>

            {selected && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="size-5" />
                            Assets · {selected.name || selected.tag_name}
                        </CardTitle>
                        <CardDescription>
                            Asset identity and history are keyed by GitHub asset
                            ID. Deleted files remain visible in stored history.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {assets.length === 0 ? (
                                <p className="py-8 text-center text-muted-foreground">
                                    This release has no assets.
                                </p>
                            ) : (
                                assets.map((asset) => (
                                    <article
                                        key={asset.githubAssetId}
                                        className="rounded-lg border p-4"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h3 className="break-all font-medium">
                                                    {asset.name}
                                                </h3>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {formatSize(asset.size)} ·{" "}
                                                    {asset.contentType ||
                                                        "Unknown type"}{" "}
                                                    · {asset.platform}
                                                    {asset.override
                                                        ? " · manual"
                                                        : " · detected"}
                                                    {asset.deletedAt
                                                        ? ` · deleted ${date(asset.deletedAt)}`
                                                        : ""}
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                                                {[
                                                    [
                                                        "Total",
                                                        asset.total === null
                                                            ? null
                                                            : {
                                                                  downloads:
                                                                      asset.total,
                                                                  complete: true,
                                                                  unknownAssets: 0,
                                                              },
                                                    ],
                                                    [
                                                        "24h",
                                                        asset.periods["24h"],
                                                    ],
                                                    ["7d", asset.periods["7d"]],
                                                    [
                                                        "30d",
                                                        asset.periods["30d"],
                                                    ],
                                                ].map(([label, metric]) => (
                                                    <div key={String(label)}>
                                                        <span className="text-xs text-muted-foreground">
                                                            {String(label)}
                                                        </span>
                                                        <p className="font-semibold tabular-nums">
                                                            {metric === null
                                                                ? "Unknown"
                                                                : value(
                                                                      metric as WindowMetric,
                                                                  )}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <Button
                                            variant="link"
                                            size="sm"
                                            className="mt-2 h-auto px-0"
                                            onClick={() =>
                                                setEditingAsset(
                                                    editingAsset ===
                                                        asset.githubAssetId
                                                        ? null
                                                        : asset.githubAssetId,
                                                )
                                            }
                                        >
                                            {editingAsset ===
                                            asset.githubAssetId
                                                ? "Close platform editor"
                                                : "Correct platform category"}
                                        </Button>
                                        {editingAsset ===
                                            asset.githubAssetId && (
                                            <PlatformCorrection
                                                assetId={asset.githubAssetId}
                                                initialPlatform={asset.platform}
                                                isOverride={asset.override}
                                            />
                                        )}
                                    </article>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </main>
    );
}
