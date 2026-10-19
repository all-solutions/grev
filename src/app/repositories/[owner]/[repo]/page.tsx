import { notFound } from "next/navigation";
import { RepositoryStatistics } from "@/components/repository-statistics";
import db from "@/lib/monitor-db";
import {
    getPlatformBreakdown,
    getRepositoryStatsByName,
} from "@/lib/stats-core";

export const dynamic = "force-dynamic";

export default async function RepositoryPage({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}) {
    const { owner, repo } = await params;
    const repository = getRepositoryStatsByName(db, owner, repo);
    if (!repository) notFound();
    return (
        <RepositoryStatistics
            repository={{
                ...repository,
                platforms: getPlatformBreakdown(db, repository.id),
            }}
        />
    );
}
