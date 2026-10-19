import Database from "better-sqlite3";
import { chmodSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function openMonitorDatabase(databasePath: string) {
    const resolvedPath = resolve(databasePath);
    mkdirSync(dirname(resolvedPath), { recursive: true, mode: 0o700 });
    const database = new Database(resolvedPath, {
        timeout: 10_000,
        fileMustExist: false,
    });
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");
    database.pragma("busy_timeout = 10000");
    database.exec(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    for (const file of readdirSync(resolve(process.cwd(), "migrations"))
        .filter((name) => /^\d+_.*\.sql$/.test(name))
        .sort()) {
        const version = file.replace(/\.sql$/, "");
        if (
            database
                .prepare("SELECT 1 FROM schema_migrations WHERE version = ?")
                .get(version)
        )
            continue;
        database.transaction(() => {
            database.exec(
                readFileSync(
                    resolve(process.cwd(), "migrations", file),
                    "utf8",
                ),
            );
            database
                .prepare(
                    "INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)",
                )
                .run(version, new Date().toISOString());
        })();
    }
    chmodSync(resolvedPath, 0o600);
    return database;
}
