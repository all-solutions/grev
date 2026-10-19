import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/monitor-db";
import { getTimeseries } from "@/lib/stats-core";
import { parsePositiveInteger, parseTimeRange } from "@/lib/stats-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const repositoryId = parsePositiveInteger(
        params.get("repositoryId"),
        "repositoryId",
    );
    const releaseId = parsePositiveInteger(
        params.get("releaseId"),
        "releaseId",
    );
    const assetId = parsePositiveInteger(params.get("assetId"), "assetId");
    for (const value of [repositoryId, releaseId, assetId])
        if (typeof value === "object" && value !== null && "error" in value)
            return NextResponse.json(value, { status: 400 });
    if (!repositoryId && !releaseId && !assetId)
        return NextResponse.json(
            { error: "Provide repositoryId, releaseId, or assetId." },
            { status: 400 },
        );
    const range = parseTimeRange(params);
    if ("error" in range) return NextResponse.json(range, { status: 400 });
    const series = getTimeseries(
        db,
        {
            repositoryId:
                typeof repositoryId === "number" ? repositoryId : undefined,
            releaseId: typeof releaseId === "number" ? releaseId : undefined,
            assetId: typeof assetId === "number" ? assetId : undefined,
        },
        range.from,
        range.to,
    );
    return NextResponse.json({ range, series });
}
