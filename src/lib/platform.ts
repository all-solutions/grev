export const PLATFORMS = [
    "Windows",
    "Linux",
    "macOS",
    "Android",
    "Other",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PACKAGE_TYPES_BY_PLATFORM = {
    Windows: ["Portable", "Installer", "Other"],
    Linux: ["DEB", "RPM", "AppImage", "Archive", "Other"],
    macOS: ["DMG", "PKG", "ZIP", "Other"],
    Android: ["APK", "AAB", "Other"],
    Other: ["Other"],
} as const;
export type PackageType =
    (typeof PACKAGE_TYPES_BY_PLATFORM)[keyof typeof PACKAGE_TYPES_BY_PLATFORM][number];

export function classifyPackageType(
    platform: Platform,
    filename: string,
): PackageType {
    const name = filename.toLowerCase();
    switch (platform) {
        case "Windows":
            if (/portable/.test(name)) return "Portable";
            if (
                /setup|installer/.test(name) ||
                /\.(msi|msix|msixbundle)$/.test(name)
            )
                return "Installer";
            return "Other";
        case "Linux":
            if (/\.deb$/.test(name)) return "DEB";
            if (/\.rpm$/.test(name)) return "RPM";
            if (/\.appimage$/.test(name)) return "AppImage";
            if (/\.(tar\.gz|tar\.xz|tgz)$/.test(name)) return "Archive";
            return "Other";
        case "macOS":
            if (/\.dmg$/.test(name)) return "DMG";
            if (/\.pkg$/.test(name)) return "PKG";
            if (/\.zip$/.test(name)) return "ZIP";
            return "Other";
        case "Android":
            if (/\.apk$/.test(name)) return "APK";
            if (/\.aab$/.test(name)) return "AAB";
            return "Other";
        case "Other":
            return "Other";
    }
}

export function isPackageTypeForPlatform(
    platform: Platform,
    packageType: string,
): packageType is PackageType {
    return (PACKAGE_TYPES_BY_PLATFORM[platform] as readonly string[]).includes(
        packageType,
    );
}

export function classifyPlatform(filename: string): Platform {
    const name = filename.toLowerCase();
    if (/\.(apk|aab)$/.test(name) || /(^|[._ -])android([._ -]|$)/.test(name))
        return "Android";
    if (
        /\.(exe|msi|msix|msixbundle)$/.test(name) ||
        /(^|[._ -])(windows?|win|win32|win64)([._ -]|$)/.test(name)
    )
        return "Windows";
    if (
        /\.(deb|rpm|appimage)$/.test(name) ||
        /(^|[._ -])(linux|ubuntu|debian|fedora|arch)([._ -]|$)/.test(name)
    )
        return "Linux";
    if (
        /\.(dmg|pkg)$/.test(name) ||
        /(^|[._ -])(macos|mac|darwin|osx)([._ -]|$)/.test(name)
    )
        return "macOS";
    return "Other";
}
