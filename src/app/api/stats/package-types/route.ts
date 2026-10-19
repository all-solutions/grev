import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/monitor-db";
import { getPackageTypeBreakdown } from "@/lib/stats-core";
import { parsePackageTypeFilters } from "@/lib/stats-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
    const filters = parsePackageTypeFilters(request.nextUrl.searchParams);
    if ("error" in filters) return NextResponse.json(filters, { status: 400 });
    return NextResponse.json({
        packageTypes: getPackageTypeBreakdown(db, filters),
    });
}
