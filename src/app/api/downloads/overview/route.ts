import { NextResponse } from "next/server";
import db from "@/lib/monitor-db";
import { getDownloadOverview } from "@/lib/download-overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
    return NextResponse.json({ repositories: getDownloadOverview(db) });
}
