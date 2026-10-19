import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

describe("package type stats API validation", () => {
    it("rejects invalid package type filters before reading the database", () => {
        expect(
            GET(
                new NextRequest(
                    "https://grev.example/api/stats/package-types?platform=Solaris",
                ),
            ).status,
        ).toBe(400);
        expect(
            GET(
                new NextRequest(
                    "https://grev.example/api/stats/package-types?assetIds=1,nope",
                ),
            ).status,
        ).toBe(400);
    });
});
