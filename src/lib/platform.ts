export const PLATFORMS = [
    "Windows",
    "Linux",
    "macOS",
    "Android",
    "Other",
] as const;
export type Platform = (typeof PLATFORMS)[number];

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
