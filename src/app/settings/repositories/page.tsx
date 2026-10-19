import { RepositoryManager } from "@/components/repository-manager";
import Link from "next/link";

export const metadata = { title: "Repository Settings | GREV" };

export default function RepositorySettingsPage() {
    return (
        <main className="mx-auto min-h-dvh w-full max-w-4xl p-6 sm:p-10">
            <Link className="text-sm text-muted-foreground underline" href="/">
                ← Back to GREV
            </Link>
            <h1 className="mt-6 text-3xl font-bold">Repository monitoring</h1>
            <p className="mt-2 text-muted-foreground">
                Manage repositories stored by the server. Enter your admin token
                to continue.
            </p>
            <RepositoryManager />
        </main>
    );
}
