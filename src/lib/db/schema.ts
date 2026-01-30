import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const generations = sqliteTable("generations", {
  id: text("id").primaryKey(),
  userRequest: text("user_request").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  generationId: text("generation_id")
    .notNull()
    .references(() => generations.id),
  provider: text("provider").notNull(), // 'gemini' | 'openai'
  model: text("model").notNull(),
  version: integer("version").notNull(),
  status: text("status").notNull(), // 'pending' | 'running' | 'completed' | 'failed'
  actionPlanJson: text("action_plan_json"),
  thinkingTrace: text("thinking_trace"),
  expandedPrompt: text("expanded_prompt"),
  latencyMs: integer("latency_ms"),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  generationId: text("generation_id")
    .notNull()
    .references(() => generations.id),
  runId: text("run_id").references(() => runs.id),
  role: text("role").notNull(), // 'reference' | 'output'
  provider: text("provider"),
  b2Key: text("b2_key").notNull(),
  mime: text("mime").notNull(),
  width: integer("width"),
  height: integer("height"),
  sizeBytes: integer("size_bytes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type GenerationRow = typeof generations.$inferSelect;
export type RunRow = typeof runs.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
