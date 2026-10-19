import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/monitor-db";
import { authorizeAdmin } from "@/lib/admin-auth";
import { PLATFORMS } from "@/lib/platform";

export const runtime = "nodejs";

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    if (!authorizeAdmin(request))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1)
        return NextResponse.json(
            { error: "Invalid asset id." },
            { status: 400 },
        );
    const body = (await request.json().catch(() => null)) as {
        platform?: unknown;
    } | null;
    if (
        !body ||
        !PLATFORMS.includes(body.platform as (typeof PLATFORMS)[number])
    )
        return NextResponse.json(
            { error: "Invalid platform." },
            { status: 400 },
        );
    const exists = db
        .prepare("SELECT 1 FROM assets WHERE github_asset_id = ?")
        .get(id);
    if (!exists)
        return NextResponse.json(
            { error: "Asset not found." },
            { status: 404 },
        );
    db.prepare(
        "INSERT INTO asset_platform_overrides(github_asset_id, platform, updated_at) VALUES (?, ?, ?) ON CONFLICT(github_asset_id) DO UPDATE SET platform = excluded.platform, updated_at = excluded.updated_at",
    ).run(id, body.platform, new Date().toISOString());
    return NextResponse.json({ ok: true });
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    if (!authorizeAdmin(request))
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1)
        return NextResponse.json(
            { error: "Invalid asset id." },
            { status: 400 },
        );
    db.prepare(
        "DELETE FROM asset_platform_overrides WHERE github_asset_id = ?",
    ).run(id);
    return NextResponse.json({ ok: true });
}
