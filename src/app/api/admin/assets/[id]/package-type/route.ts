import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/monitor-db";
import { authorizeAdmin } from "@/lib/admin-auth";
import {
    classifyPlatform,
    isPackageTypeForPlatform,
    type Platform,
} from "@/lib/platform";

export const runtime = "nodejs";

async function getAsset(id: number) {
    return db
        .prepare(
            "SELECT a.name, o.platform FROM assets a LEFT JOIN asset_platform_overrides o ON o.github_asset_id = a.github_asset_id WHERE a.github_asset_id = ?",
        )
        .get(id) as { name: string; platform: Platform | null } | undefined;
}

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
        packageType?: unknown;
    } | null;
    if (typeof body?.packageType !== "string")
        return NextResponse.json(
            { error: "Invalid package type." },
            { status: 400 },
        );
    const asset = await getAsset(id);
    if (!asset)
        return NextResponse.json(
            { error: "Asset not found." },
            { status: 404 },
        );
    const platform = asset.platform ?? classifyPlatform(asset.name);
    if (!isPackageTypeForPlatform(platform, body.packageType))
        return NextResponse.json(
            { error: `Package type is not valid for ${platform}.` },
            { status: 400 },
        );
    db.prepare(
        "INSERT INTO asset_package_type_overrides(github_asset_id, package_type, updated_at) VALUES (?, ?, ?) ON CONFLICT(github_asset_id) DO UPDATE SET package_type = excluded.package_type, updated_at = excluded.updated_at",
    ).run(id, body.packageType, new Date().toISOString());
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
        "DELETE FROM asset_package_type_overrides WHERE github_asset_id = ?",
    ).run(id);
    return NextResponse.json({ ok: true });
}
