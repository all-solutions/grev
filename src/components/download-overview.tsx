"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { DownloadRepository } from "@/lib/download-overview";
import { reconcileReleaseSelections } from "@/lib/download-overview";

function count(value: number, complete: boolean) {
    return `${complete ? "" : "≥ "}${new Intl.NumberFormat("en").format(value)}`;
}

function date(value: string | null) {
    if (!value) return "Noch keine erfolgreiche Aktualisierung";
    return new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

export function DownloadOverview() {
    const [repositories, setRepositories] = useState<
        DownloadRepository[] | null
    >(null);
    const [selection, setSelection] = useState<Record<number, number>>({});
    const [error, setError] = useState<string | null>(null);
    const [refresh, setRefresh] = useState(0);
    const load = useCallback(async (signal: AbortSignal) => {
        try {
            const response = await fetch("/api/downloads/overview", {
                signal,
                cache: "no-store",
            });
            if (!response.ok)
                throw new Error(
                    "Die Downloadübersicht konnte nicht geladen werden.",
                );
            const data = (await response.json()) as {
                repositories: DownloadRepository[];
            };
            setRepositories(data.repositories);
            setSelection((previous) =>
                reconcileReleaseSelections(previous, data.repositories),
            );
            setError(null);
        } catch (cause) {
            if (cause instanceof Error && cause.name === "AbortError") return;
            setError(
                cause instanceof Error
                    ? cause.message
                    : "Ein unbekannter Fehler ist aufgetreten.",
            );
        }
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [load, refresh]);

    if (!repositories && !error)
        return (
            <p
                role="status"
                className="py-16 text-center text-muted-foreground"
            >
                Downloadübersicht wird geladen …
            </p>
        );
    if (error && !repositories)
        return (
            <div role="alert" className="py-16 text-center">
                <p>{error}</p>
                <button
                    className="mt-3 underline"
                    onClick={() => setRefresh((value) => value + 1)}
                >
                    Erneut versuchen
                </button>
            </div>
        );
    if (!repositories?.length)
        return (
            <section className="rounded-xl border bg-card p-8 text-center">
                <h2 className="text-xl font-semibold">
                    Keine Repositories aktiviert
                </h2>
                <p className="mt-2 text-muted-foreground">
                    Füge ein Repository hinzu oder aktiviere es in der
                    Verwaltung.
                </p>
            </section>
        );

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button
                    className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => setRefresh((value) => value + 1)}
                >
                    <RefreshCw className="size-4" /> Aktualisieren
                </button>
            </div>
            {error && (
                <p
                    role="alert"
                    className="rounded-md border border-destructive/40 p-3 text-sm"
                >
                    {error} Die angezeigten Daten stammen aus dem letzten
                    erfolgreichen Abruf.
                </p>
            )}
            {repositories.map((repository) => {
                const selectedId =
                    selection[repository.id] ?? repository.releases[0]?.id;
                const selected = repository.releases.find(
                    (release) => release.id === selectedId,
                );
                return (
                    <section
                        key={repository.id}
                        className="overflow-hidden rounded-xl border bg-card shadow-sm"
                    >
                        <header className="flex flex-wrap items-center justify-between gap-4 border-b p-4 sm:p-5">
                            <div>
                                <a
                                    className="inline-flex items-center gap-2 text-lg font-semibold hover:underline"
                                    href={`https://github.com/${repository.owner}/${repository.name}`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {repository.owner}/{repository.name}
                                    <ExternalLink className="size-4" />
                                </a>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {repository.releaseCount} Releases · Letzte
                                    erfolgreiche Aktualisierung:{" "}
                                    {date(repository.lastSuccessfulUpdate)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                    Gesamtdownloads
                                </p>
                                <p className="text-2xl font-bold tabular-nums">
                                    {count(
                                        repository.downloads,
                                        repository.complete,
                                    )}
                                </p>
                            </div>
                        </header>
                        {repository.releases.length ? (
                            <div className="grid md:grid-cols-[minmax(15rem,0.85fr)_minmax(0,1.15fr)]">
                                <div className="border-b md:border-b-0 md:border-r">
                                    <h2 className="px-4 pt-4 text-sm font-semibold">
                                        Releases
                                    </h2>
                                    <ul className="max-h-[26rem] space-y-1 overflow-y-auto p-3">
                                        {repository.releases.map((release) => (
                                            <li key={release.id}>
                                                <button
                                                    aria-pressed={
                                                        release.id ===
                                                        selectedId
                                                    }
                                                    onClick={() =>
                                                        setSelection(
                                                            (previous) => ({
                                                                ...previous,
                                                                [repository.id]:
                                                                    release.id,
                                                            }),
                                                        )
                                                    }
                                                    className={`w-full rounded-lg border p-3 text-left transition-colors ${release.id === selectedId ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"}`}
                                                >
                                                    <span className="flex items-start justify-between gap-3">
                                                        <span className="min-w-0">
                                                            <span className="block truncate font-medium">
                                                                {release.name}
                                                            </span>
                                                            <span className="block truncate text-xs text-muted-foreground">
                                                                {release.tag}
                                                                {release.publishedAt
                                                                    ? ` · ${new Intl.DateTimeFormat("de-DE").format(new Date(release.publishedAt))}`
                                                                    : ""}
                                                            </span>
                                                        </span>
                                                        <span className="shrink-0 font-semibold tabular-nums">
                                                            {count(
                                                                release.downloads,
                                                                release.complete,
                                                            )}
                                                        </span>
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h2 className="px-4 pt-4 text-sm font-semibold">
                                        {selected
                                            ? `Assets · ${selected.name}`
                                            : "Assets"}
                                    </h2>
                                    {selected?.assets.length ? (
                                        <ul className="max-h-[26rem] divide-y overflow-y-auto px-4">
                                            {selected.assets.map((asset) => (
                                                <li
                                                    key={asset.id}
                                                    className="flex items-center justify-between gap-4 py-3"
                                                >
                                                    <span className="min-w-0 break-all text-sm">
                                                        {asset.name}
                                                    </span>
                                                    <span className="shrink-0 font-semibold tabular-nums">
                                                        {asset.downloads ===
                                                        null
                                                            ? "Unbekannt"
                                                            : new Intl.NumberFormat(
                                                                  "en",
                                                              ).format(
                                                                  asset.downloads,
                                                              )}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="p-4 text-sm text-muted-foreground">
                                            Dieses Release enthält keine Assets.
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="p-5 text-sm text-muted-foreground">
                                Für dieses Repository wurden noch keine Releases
                                gesammelt.
                            </p>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
