"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Repo = {
    id: number;
    owner: string;
    name: string;
    enabled: boolean;
    last_polled_at: string | null;
    last_error: string | null;
};

export function RepositoryManager() {
    const [token, setToken] = useState("");
    const [repos, setRepos] = useState<Repo[]>([]);
    const [value, setValue] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const api = useCallback(
        async (path: string, method = "GET", body?: unknown) => {
            const response = await fetch(path, {
                method,
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(body ? { "Content-Type": "application/json" } : {}),
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            });
            const data = response.status === 204 ? {} : await response.json();
            if (!response.ok)
                throw new Error(
                    data.error || `Request failed (${response.status})`,
                );
            return data;
        },
        [token],
    );
    const refresh = useCallback(async () => {
        const data = await api("/api/admin/repositories");
        setRepos(data.repositories);
    }, [api]);
    useEffect(() => {
        if (token) refresh().catch((error) => setMessage(error.message));
    }, [token, refresh]);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        try {
            await api("/api/admin/repositories", "POST", { repository: value });
            setValue("");
            await refresh();
            setMessage("Repository added.");
        } catch (error) {
            setMessage(
                error instanceof Error ? error.message : "Request failed",
            );
        } finally {
            setBusy(false);
        }
    }
    async function run(action: () => Promise<void>) {
        setBusy(true);
        setMessage("");
        try {
            await action();
            await refresh();
        } catch (error) {
            setMessage(
                error instanceof Error ? error.message : "Request failed",
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="mt-8 space-y-6">
            <label className="block space-y-2">
                <span className="text-sm font-medium">Admin token</span>
                <Input
                    type="password"
                    autoComplete="off"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                />
            </label>
            {token && (
                <>
                    <Button
                        variant="link"
                        className="px-0"
                        onClick={() => {
                            setToken("");
                            setRepos([]);
                            setMessage("");
                        }}
                    >
                        Forget admin token
                    </Button>
                    <form
                        onSubmit={submit}
                        className="flex flex-col gap-3 sm:flex-row"
                    >
                        <Input
                            placeholder="owner/repository or GitHub URL"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            required
                        />
                        <Button disabled={busy}>Add repository</Button>
                    </form>
                    <div className="divide-y rounded-lg border">
                        {repos.map((repo) => (
                            <article
                                key={repo.id}
                                className="flex flex-wrap items-center justify-between gap-3 p-4"
                            >
                                <div>
                                    <div className="font-semibold">
                                        {repo.owner}/{repo.name}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {repo.last_polled_at
                                            ? `Last successful poll: ${new Date(repo.last_polled_at).toLocaleString()}`
                                            : "Not collected yet"}
                                        {repo.last_error
                                            ? ` · Error: ${repo.last_error}`
                                            : ""}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        disabled={busy}
                                        onClick={() =>
                                            run(async () => {
                                                await api(
                                                    "/api/admin/collector",
                                                    "POST",
                                                    { repositoryId: repo.id },
                                                );
                                            })
                                        }
                                    >
                                        Poll
                                    </Button>
                                    <Button
                                        variant="secondary"
                                        disabled={busy}
                                        onClick={() =>
                                            run(async () => {
                                                await api(
                                                    `/api/admin/repositories/${repo.id}`,
                                                    "PATCH",
                                                    { enabled: !repo.enabled },
                                                );
                                            })
                                        }
                                    >
                                        {repo.enabled ? "Disable" : "Enable"}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        disabled={busy}
                                        onClick={() =>
                                            run(async () => {
                                                await api(
                                                    `/api/admin/repositories/${repo.id}`,
                                                    "DELETE",
                                                );
                                            })
                                        }
                                    >
                                        Remove
                                    </Button>
                                </div>
                            </article>
                        ))}
                    </div>
                </>
            )}
            {message && (
                <p role="status" className="text-sm text-muted-foreground">
                    {message}
                </p>
            )}
        </section>
    );
}
