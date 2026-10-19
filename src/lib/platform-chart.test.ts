import { describe, expect, it } from "vitest";
import { preparePlatformChartData } from "./platform-chart";

const platformRows = [
    {
        platform: "Windows",
        repositoryId: 1,
        repository: "TVHarbor/TVHarbor",
        total: { downloads: 264, complete: true, unknownAssets: 0 },
        "30d": { downloads: 40, complete: true, unknownAssets: 0 },
    },
    {
        platform: "Linux",
        repositoryId: 1,
        repository: "TVHarbor/TVHarbor",
        total: { downloads: 80, complete: true, unknownAssets: 0 },
        "30d": { downloads: 12, complete: false, unknownAssets: 1 },
    },
    {
        platform: "macOS",
        repositoryId: 1,
        repository: "TVHarbor/TVHarbor",
        total: { downloads: 25, complete: true, unknownAssets: 0 },
        "30d": { downloads: null, complete: false, unknownAssets: 1 },
    },
];

describe("platform chart data", () => {
    it("maps positive platform totals to the exact Recharts data keys", () => {
        expect(preparePlatformChartData(platformRows)).toEqual([
            {
                repositoryId: 1,
                repository: "TVHarbor/TVHarbor",
                Windows: 264,
                WindowsComplete: true,
                Linux: 80,
                LinuxComplete: true,
                macOS: 25,
                macOSComplete: true,
            },
        ]);
    });

    it("preserves missing and incomplete historical data instead of marking it complete", () => {
        expect(preparePlatformChartData(platformRows, "30d")).toEqual([
            {
                repositoryId: 1,
                repository: "TVHarbor/TVHarbor",
                Windows: 40,
                WindowsComplete: true,
                Linux: 12,
                LinuxComplete: false,
                macOS: null,
                macOSComplete: false,
            },
        ]);
    });
});
