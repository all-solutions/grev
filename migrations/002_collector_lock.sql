CREATE TABLE IF NOT EXISTS collector_lock (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    pid INTEGER NOT NULL,
    started_at TEXT NOT NULL
);
