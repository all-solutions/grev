CREATE TABLE IF NOT EXISTS asset_package_type_overrides (
    github_asset_id INTEGER PRIMARY KEY REFERENCES assets(github_asset_id) ON DELETE CASCADE,
    package_type TEXT NOT NULL CHECK (package_type IN (
        'Portable', 'Installer',
        'DEB', 'RPM', 'AppImage', 'Archive',
        'DMG', 'PKG', 'ZIP',
        'APK', 'AAB',
        'Other'
    )),
    updated_at TEXT NOT NULL
);
