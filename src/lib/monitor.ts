import "server-only";
import { Octokit } from "octokit";
import db from "./monitor-db";
import { calculateDownloadDelta } from "./monitor-core";
import { runCollector } from "./collector";

export { calculateDownloadDelta, parseRepositoryInput } from "./monitor-core";

export type Repository = {
    id: number;
    owner: string;
    name: string;
    enabled: boolean;
    created_at: string;
    last_polled_at: string | null;
    last_error: string | null;
};

export function listRepositories(): Repository[] {
    const rows = db
        .prepare(
            "SELECT * FROM repositories ORDER BY owner COLLATE NOCASE, name COLLATE NOCASE",
        )
        .all() as (Omit<Repository, "enabled"> & { enabled: number })[];
    return rows.map((r) => ({
        ...r,
        enabled: Boolean(r.enabled),
        // Older database versions may contain verbose API errors. Only expose
        // the bounded generic messages written by the current collector.
        last_error:
            r.last_error &&
            !/^(GitHub collection failed|GitHub API request failed \(HTTP \d{3}\))$/.test(
                r.last_error,
            )
                ? "Previous collection error (details hidden)"
                : r.last_error,
    }));
}

export async function verifyRepository(owner: string, name: string) {
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
        userAgent: "grev-monitor",
    });
    await octokit.rest.repos.get({
        owner,
        repo: name,
        request: { timeout: 10_000 },
    });
}

export function addRepository(owner: string, name: string): Repository {
    const now = new Date().toISOString();
    db.prepare(
        "INSERT INTO repositories(owner, name, enabled, created_at) VALUES (?, ?, 1, ?) ON CONFLICT(owner COLLATE NOCASE, name COLLATE NOCASE) DO NOTHING",
    ).run(owner, name, now);
    return db
        .prepare(
            "SELECT * FROM repositories WHERE owner = ? COLLATE NOCASE AND name = ? COLLATE NOCASE",
        )
        .get(owner, name) as Repository;
}

export function changeRepository(id: number, enabled: boolean) {
    return (
        db
            .prepare("UPDATE repositories SET enabled = ? WHERE id = ?")
            .run(enabled ? 1 : 0, id).changes > 0
    );
}

export function removeRepository(id: number) {
    return (
        db.prepare("DELETE FROM repositories WHERE id = ?").run(id).changes > 0
    );
}

export async function collectRepository(
    repositoryId?: number,
): Promise<{ processed: number; failed: number }> {
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
        userAgent: "grev-monitor",
        request: { timeout: 20_000 },
        throttle: {
            onRateLimit: (retryAfter, options) => {
                console.warn(
                    `GitHub rate limit; retrying ${options.method} ${options.url} after ${retryAfter}s`,
                );
                return true;
            },
            onSecondaryRateLimit: (retryAfter) => {
                console.warn(
                    `GitHub secondary rate limit; retrying after ${retryAfter}s`,
                );
                return true;
            },
        },
    });
    return runCollector(
        { db, octokit, onError: (message) => console.error(message) },
        repositoryId,
    );
}

export function assetDownloadDelta(
    assetId: number,
    since: string,
): ReturnType<typeof calculateDownloadDelta> {
    const samples = db
        .prepare(
            "SELECT timestamp, download_count FROM snapshots WHERE asset_id = ? AND timestamp >= ? ORDER BY timestamp",
        )
        .all(assetId, since) as { timestamp: string; download_count: number }[];
    return calculateDownloadDelta(samples);
}
