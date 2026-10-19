import { NextResponse } from "next/server";
import db from "@/lib/monitor-db";
import { getRepositoryStats } from "@/lib/stats-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
    _request: Request,
    context: { params: Promise<{ owner: string; repo: string }> },
) {
    const { owner, repo } = await context.params;
    if (
        !/^[A-Za-z0-9-]{1,39}$/.test(owner) ||
        !/^[A-Za-z0-9._-]{1,100}$/.test(repo)
    )
        return NextResponse.json(
            { error: "Invalid repository path." },
            { status: 400 },
        );
    const row = db
        .prepare(
            "SELECT id FROM repositories WHERE owner = ? COLLATE NOCASE AND name = ? COLLATE NOCASE",
        )
        .get(owner, repo) as { id: number } | undefined;
    if (!row)
        return NextResponse.json(
            { error: "Repository not found." },
            { status: 404 },
        );
    return NextResponse.json(getRepositoryStats(db, row.id));
}
