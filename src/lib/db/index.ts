import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

const dbPath = process.env.DATABASE_URL || "./data/sqlite.db";

// Ensure data directory exists
const dir = dirname(dbPath);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    user_request TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    generation_id TEXT NOT NULL REFERENCES generations(id),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    version INTEGER NOT NULL,
    status TEXT NOT NULL,
    action_plan_json TEXT,
    thinking_trace TEXT,
    expanded_prompt TEXT,
    latency_ms INTEGER,
    error TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    generation_id TEXT NOT NULL REFERENCES generations(id),
    run_id TEXT REFERENCES runs(id),
    role TEXT NOT NULL,
    provider TEXT,
    b2_key TEXT NOT NULL,
    mime TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    size_bytes INTEGER,
    created_at INTEGER NOT NULL
  );
`);

// Add size_bytes column if it doesn't exist (for existing databases)
try {
  sqlite.exec(`ALTER TABLE assets ADD COLUMN size_bytes INTEGER;`);
} catch (error) {
  // Column already exists, ignore error
}

export { schema };
