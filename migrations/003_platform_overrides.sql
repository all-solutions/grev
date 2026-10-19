CREATE TABLE IF NOT EXISTS asset_platform_overrides (
    github_asset_id INTEGER PRIMARY KEY REFERENCES assets(github_asset_id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('Windows', 'Linux', 'macOS', 'Android', 'Other')),
    updated_at TEXT NOT NULL
);
