import { describe, expect, it } from "vitest";
import { classifyPackageType, isPackageTypeForPlatform } from "./platform";

describe("package type classification", () => {
    it.each([
        ["Windows", "TVHarbor-portable.EXE", "Portable"],
        ["Windows", "TVHarbor-setup.exe", "Installer"],
        ["Windows", "installer.msi", "Installer"],
        ["Windows", "app.msix", "Installer"],
        ["Windows", "app.msixbundle", "Installer"],
        ["Windows", "app.exe", "Other"],
        ["Linux", "app.deb", "DEB"],
        ["Linux", "app.RPM", "RPM"],
        ["Linux", "app.AppImage", "AppImage"],
        ["Linux", "app.tar.gz", "Archive"],
        ["Linux", "app.tar.xz", "Archive"],
        ["Linux", "app.tgz", "Archive"],
        ["macOS", "app.dmg", "DMG"],
        ["macOS", "app.pkg", "PKG"],
        ["macOS", "app.zip", "ZIP"],
        ["Android", "app.apk", "APK"],
        ["Android", "app.aab", "AAB"],
        ["Android", "app.unknown", "Other"],
        ["Other", "app.deb", "Other"],
    ] as const)(
        "classifies %s asset %s as %s",
        (platform, filename, expected) => {
            expect(classifyPackageType(platform, filename)).toBe(expected);
        },
    );

    it("only accepts manual package types compatible with the effective platform", () => {
        expect(isPackageTypeForPlatform("Windows", "Portable")).toBe(true);
        expect(isPackageTypeForPlatform("Windows", "DEB")).toBe(false);
        expect(isPackageTypeForPlatform("macOS", "ZIP")).toBe(true);
    });
});
