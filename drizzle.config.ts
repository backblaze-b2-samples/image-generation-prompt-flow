import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  driver: "better-sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || "./data/sqlite.db",
  },
} satisfies Config;
