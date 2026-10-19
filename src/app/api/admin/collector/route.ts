import { NextRequest, NextResponse } from "next/server";
import { collectRepository, listRepositories } from "@/lib/monitor";
import { authorizeAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
    if (!authorizeAdmin(request))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ repositories: listRepositories() });
}

export async function POST(request: NextRequest) {
    if (!authorizeAdmin(request))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const repositoryId =
        body.repositoryId === undefined ? undefined : Number(body.repositoryId);
    if (repositoryId !== undefined && !Number.isSafeInteger(repositoryId))
        return NextResponse.json(
            { error: "Invalid repository id" },
            { status: 400 },
        );
    try {
        const result = await collectRepository(repositoryId);
        return NextResponse.json(result, { status: result.failed ? 207 : 200 });
    } catch (error) {
        const busy =
            error instanceof Error &&
            error.message === "A collector is already running.";
        return NextResponse.json(
            { error: busy ? error.message : "Collector could not be started" },
            { status: busy ? 409 : 500 },
        );
    }
}
