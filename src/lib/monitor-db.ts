import Database from "better-sqlite3";
import { openMonitorDatabase } from "./monitor-db-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export { openMonitorDatabase } from "./monitor-db-core";

const databasePath = resolve(
    process.env.GREV_DATABASE_PATH || "./data/grev.sqlite",
);
mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });

const globalForDb = globalThis as typeof globalThis & {
    grevDb?: Database.Database;
};
const db = globalForDb.grevDb ?? openMonitorDatabase(databasePath);
if (process.env.NODE_ENV !== "production") globalForDb.grevDb = db;

db.pragma("secure_delete = ON");

export default db;
