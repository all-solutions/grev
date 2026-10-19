PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS repositories (
    id INTEGER PRIMARY KEY,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at TEXT NOT NULL,
    last_polled_at TEXT,
    last_error TEXT,
    UNIQUE (owner COLLATE NOCASE, name COLLATE NOCASE)
);

CREATE TABLE IF NOT EXISTS releases (
    id INTEGER PRIMARY KEY,
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    github_release_id INTEGER NOT NULL UNIQUE,
    tag_name TEXT NOT NULL,
    name TEXT,
    published_at TEXT,
    prerelease INTEGER NOT NULL,
    draft INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS releases_repository_id_idx ON releases(repository_id);

CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY,
    release_id INTEGER NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
    github_asset_id INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    content_type TEXT,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS assets_release_id_idx ON assets(release_id);

CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,
    download_count INTEGER NOT NULL CHECK (download_count >= 0),
    UNIQUE (asset_id, timestamp)
);
CREATE INDEX IF NOT EXISTS snapshots_asset_timestamp_idx ON snapshots(asset_id, timestamp);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
);
