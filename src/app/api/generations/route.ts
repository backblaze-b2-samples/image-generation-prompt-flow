import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import type { GenerationWithRuns } from "@/types";

export async function GET() {
  const generations = await db
    .select()
    .from(schema.generations)
    .orderBy(desc(schema.generations.createdAt));

  const result: GenerationWithRuns[] = [];

  for (const gen of generations) {
    const runs = await db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.generationId, gen.id))
      .orderBy(schema.runs.version);

    const assets = await db
      .select()
      .from(schema.assets)
      .where(eq(schema.assets.generationId, gen.id));

    result.push({
      id: gen.id,
      userRequest: gen.userRequest,
      createdAt: gen.createdAt,
      runs: runs.map((r) => ({
        ...r,
        provider: r.provider as "gemini" | "openai",
        status: r.status as "pending" | "running" | "completed" | "failed",
      })),
      assets: assets.map((a) => ({
        ...a,
        role: a.role as "reference" | "output",
        provider: a.provider as "gemini" | "openai" | null,
      })),
    });
  }

  return Response.json(result);
}
