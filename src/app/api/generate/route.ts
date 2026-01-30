import { nanoid } from "nanoid";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { runFlow } from "@/lib/flow/engine";
import { createSSEStream, sseResponse } from "@/lib/flow/stream";
import { IMAGE_MODELS } from "@/lib/models";
import type { GenerateRequest } from "@/types";

export async function POST(req: Request) {
  const body = (await req.json()) as GenerateRequest;
  const { userRequest, models, referenceImageIds = [], generationId: providedGenerationId } = body;

  if (!userRequest || !models || models.length === 0) {
    return Response.json(
      { error: "userRequest and models are required" },
      { status: 400 }
    );
  }

  // Validate models
  const validModelIds = IMAGE_MODELS.map((m) => m.id);
  for (const m of models) {
    if (!validModelIds.includes(m.modelId)) {
      return Response.json(
        { error: `Invalid model: ${m.modelId}` },
        { status: 400 }
      );
    }
  }

  // Create or update generation record
  const generationId = providedGenerationId || nanoid();

  if (providedGenerationId) {
    // Update existing generation (from reference image upload)
    await db
      .update(schema.generations)
      .set({ userRequest })
      .where(eq(schema.generations.id, generationId));
  } else {
    // Create new generation
    await db.insert(schema.generations).values({
      id: generationId,
      userRequest,
      createdAt: new Date(),
    });
  }

  // Create SSE stream
  const { stream, controller } = createSSEStream();

  // Send initial event
  controller.send("flow:start", { generationId });

  // Run flow in background
  runFlow(
    {
      generationId,
      userRequest,
      models,
      referenceImageIds,
    },
    controller
  )
    .catch((error) => {
      controller.send("flow:error", {
        generationId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    })
    .finally(() => {
      controller.close();
    });

  return sseResponse(stream);
}
