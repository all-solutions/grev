import { NextResponse } from "next/server";
import db from "@/lib/monitor-db";
import { getSummary } from "@/lib/stats-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
    return NextResponse.json(getSummary(db));
}
