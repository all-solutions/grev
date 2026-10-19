import { describe, expect, it } from "vitest";
import {
    preparePackageTypeChart,
    type PackageTypeStat,
} from "./package-type-chart";

const item: PackageTypeStat = {
    repositoryId: 1,
    repository: "TVHarbor/TVHarbor",
    platform: "Windows",
    packageType: "Portable",
    assetCount: 2,
    total: { downloads: 54, complete: true, unknownAssets: 0 },
    periods: {
        "24h": { downloads: 8, complete: true, unknownAssets: 0 },
        "7d": { downloads: 20, complete: true, unknownAssets: 0 },
        "30d": { downloads: 40, complete: false, unknownAssets: 1 },
    },
    share: {
        total: { percent: 58, complete: true },
        "24h": { percent: 60, complete: true },
        "7d": { percent: 50, complete: true },
        "30d": { percent: null, complete: false },
    },
};

describe("package type chart preparation", () => {
    it("uses platform/package type series and preserves completeness metadata", () => {
        expect(preparePackageTypeChart([item], "total")).toEqual({
            rows: [
                {
                    repositoryId: 1,
                    repository: "TVHarbor/TVHarbor",
                    "Windows · Portable": 54,
                    "Windows · PortableComplete": true,
                    "Windows · PortableAssets": 2,
                },
            ],
            series: [
                [
                    "Windows · Portable",
                    { label: "Windows · Portable", colorKey: "Portable" },
                ],
            ],
        });
        expect(
            preparePackageTypeChart([item], "30d").rows[0][
                "Windows · PortableComplete"
            ],
        ).toBe(false);
    });
});
