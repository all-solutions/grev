import { NextRequest, NextResponse } from "next/server";
import {
    addRepository,
    listRepositories,
    parseRepositoryInput,
    verifyRepository,
} from "@/lib/monitor";
import { authorizeAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    if (!authorizeAdmin(request))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({
        repositories: listRepositories(),
        tokenRequired: true,
        githubTokenConfigured: Boolean(process.env.GITHUB_TOKEN),
    });
}

export async function POST(request: NextRequest) {
    if (!authorizeAdmin(request))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const body = await request.json();
        const { owner, name } = parseRepositoryInput(
            String(body.repository ?? ""),
        );
        await verifyRepository(owner, name);
        return NextResponse.json(
            { repository: addRepository(owner, name) },
            { status: 201 },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const status = message.startsWith("Repository must")
            ? 400
            : (error as { status?: number })?.status === 404
              ? 404
              : 502;
        return NextResponse.json(
            {
                error:
                    status === 404
                        ? "Repository not found"
                        : status === 400
                          ? message
                          : "Could not verify repository with GitHub",
            },
            { status },
        );
    }
}
