import { NextResponse } from "next/server";
import db from "@/lib/monitor-db";
import { getAssetStats } from "@/lib/stats-core";
import { parsePositiveInteger } from "@/lib/stats-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> },
) {
    const { id: raw } = await context.params;
    const id = parsePositiveInteger(raw, "assetId");
    if (id === null || typeof id !== "number")
        return NextResponse.json(
            { error: "Invalid asset id." },
            { status: 400 },
        );
    const result = getAssetStats(db, id);
    return result
        ? NextResponse.json(result)
        : NextResponse.json({ error: "Asset not found." }, { status: 404 });
}
