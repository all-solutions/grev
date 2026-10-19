import { DownloadOverview } from "@/components/download-overview";

export const dynamic = "force-dynamic";
export const metadata = {
    title: "GREV · Downloads",
    description: "Download overview for all monitored GitHub repositories.",
};

export default function Home() {
    return (
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Downloads</h1>
                <p className="mt-1 text-muted-foreground">
                    Releases und Asset-Downloads deiner überwachten
                    Repositories.
                </p>
            </div>
            <DownloadOverview />
        </main>
    );
}
