import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/monitor-db";
import { getPlatformBreakdown } from "@/lib/stats-core";
import { parsePositiveInteger } from "@/lib/stats-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
    const value = parsePositiveInteger(
        request.nextUrl.searchParams.get("repositoryId"),
        "repositoryId",
    );
    if (value !== null && typeof value !== "number")
        return NextResponse.json(value, { status: 400 });
    return NextResponse.json({
        platforms: getPlatformBreakdown(
            db,
            typeof value === "number" ? value : undefined,
        ),
    });
}
