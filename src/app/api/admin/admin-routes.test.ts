import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/monitor", () => ({
    addRepository: vi.fn(),
    changeRepository: vi.fn(),
    collectRepository: vi.fn(),
    listRepositories: vi.fn(),
    parseRepositoryInput: vi.fn(),
    removeRepository: vi.fn(),
    verifyRepository: vi.fn(),
}));

import {
    GET as getRepositories,
    POST as addRepository,
} from "./repositories/route";
import {
    DELETE as deleteRepository,
    PATCH as patchRepository,
} from "./repositories/[id]/route";
import { GET as getCollector, POST as postCollector } from "./collector/route";

const request = (method: string) =>
    new Request("https://grev.internal/api/admin", {
        method,
        headers: { host: "grev.internal" },
    }) as never;

describe("admin routes deny unauthenticated access", () => {
    it("protects repository reads and writes", async () => {
        expect((await getRepositories(request("GET"))).status).toBe(401);
        expect((await addRepository(request("POST"))).status).toBe(401);
        const context = { params: Promise.resolve({ id: "1" }) };
        expect((await patchRepository(request("PATCH"), context)).status).toBe(
            401,
        );
        expect(
            (await deleteRepository(request("DELETE"), context)).status,
        ).toBe(401);
    });
    it("protects collector status and trigger", async () => {
        expect((await getCollector(request("GET"))).status).toBe(401);
        expect((await postCollector(request("POST"))).status).toBe(401);
    });
});
