import { StatsDashboard } from "@/components/stats-dashboard";
import db from "@/lib/monitor-db";
import { getPlatformBreakdown, getSummary } from "@/lib/stats-core";

export const dynamic = "force-dynamic";
export const metadata = {
    title: "GREV · Release download monitor",
    description:
        "Historical download statistics for monitored GitHub releases.",
};

export default function Home() {
    const summary = getSummary(db);
    const platforms = getPlatformBreakdown(db, undefined);
    return <StatsDashboard summary={summary} platforms={platforms} />;
}
