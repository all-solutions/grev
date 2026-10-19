import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateDownloadDelta, parseRepositoryInput } from "./monitor-core";

describe("repository input validation", () => {
    it("accepts owner/repository and GitHub URLs", () => {
        expect(parseRepositoryInput("owner/repo")).toEqual({
            owner: "owner",
            name: "repo",
        });
        expect(parseRepositoryInput("https://github.com/owner/repo")).toEqual({
            owner: "owner",
            name: "repo",
        });
    });
    it("rejects malformed, foreign-host, and extra path inputs", () => {
        for (const input of [
            "",
            "owner",
            "owner/repo/issues",
            "https://evil.test/owner/repo",
            "-bad/repo",
        ])
            expect(() => parseRepositoryInput(input)).toThrow();
    });
});

describe("snapshot deltas", () => {
    it("needs multiple samples and reports observed sample times", () => {
        expect(
            calculateDownloadDelta([
                { timestamp: "2026-01-01T00:00:00Z", download_count: 3 },
            ]),
        ).toMatchObject({
            downloads: null,
            unknown: true,
            sampledTo: "2026-01-01T00:00:00Z",
        });
        expect(
            calculateDownloadDelta([
                { timestamp: "a", download_count: 4 },
                { timestamp: "b", download_count: 9 },
            ]),
        ).toEqual({
            downloads: 5,
            sampledFrom: "a",
            sampledTo: "b",
            reset: false,
            unknown: false,
        });
    });
    it("handles a decreasing cumulative counter as a reset, never negative", () => {
        expect(
            calculateDownloadDelta([
                { timestamp: "a", download_count: 14 },
                { timestamp: "b", download_count: 2 },
            ]),
        ).toEqual({
            downloads: null,
            sampledFrom: "a",
            sampledTo: "b",
            reset: true,
            unknown: true,
        });
        expect(
            calculateDownloadDelta([
                { timestamp: "a", download_count: 10 },
                { timestamp: "b", download_count: 2 },
                { timestamp: "c", download_count: 12 },
            ]),
        ).toEqual({
            downloads: null,
            sampledFrom: "a",
            sampledTo: "c",
            reset: true,
            unknown: true,
        });
    });
});

describe("admin authorization", () => {
    afterEach(() => {
        vi.resetModules();
        delete process.env.GREV_ADMIN_TOKEN;
    });
    it("fails closed without a configured token and checks bearer token and origin", async () => {
        process.env.GREV_ADMIN_TOKEN = "x".repeat(40);
        const { authorizeAdmin } = await import("./admin-auth");
        const make = (authorization?: string, origin?: string) =>
            new Request("https://internal.test/api/admin", {
                headers: {
                    ...(authorization ? { authorization } : {}),
                    ...(origin ? { origin } : {}),
                    host: "internal.test",
                },
            });
        expect(authorizeAdmin(make() as never)).toBe(false);
        expect(
            authorizeAdmin(
                make(
                    `Bearer ${process.env.GREV_ADMIN_TOKEN}`,
                    "https://attacker.test",
                ) as never,
            ),
        ).toBe(false);
        const unsafeNoOrigin = new Request("https://internal.test/api/admin", {
            method: "POST",
            headers: {
                authorization: `Bearer ${process.env.GREV_ADMIN_TOKEN}`,
                host: "internal.test",
            },
        });
        expect(authorizeAdmin(unsafeNoOrigin as never)).toBe(false);
        const unsafeSameOrigin = new Request(
            "https://internal.test/api/admin",
            {
                method: "POST",
                headers: {
                    authorization: `Bearer ${process.env.GREV_ADMIN_TOKEN}`,
                    host: "internal.test",
                    "sec-fetch-site": "same-origin",
                },
            },
        );
        expect(authorizeAdmin(unsafeSameOrigin as never)).toBe(true);
        expect(
            authorizeAdmin(
                make(
                    `Bearer ${process.env.GREV_ADMIN_TOKEN}`,
                    "https://internal.test",
                ) as never,
            ),
        ).toBe(true);
        const cronRequest = new Request("https://internal.test/api/admin", {
            method: "POST",
            headers: {
                authorization: `Bearer ${process.env.GREV_ADMIN_TOKEN}`,
                host: "internal.test",
            },
        });
        expect(authorizeAdmin(cronRequest as never)).toBe(false);
    });
});
