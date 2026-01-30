import { nanoid } from "nanoid";
import { db, schema } from "@/lib/db";
import { generateWithModel } from "@/lib/providers";
import { uploadImage, generateKey } from "@/lib/storage/b2-client";
import {
  generateActionPlan,
  generateThinkingTrace,
  constructPrompt,
} from "./steps";
import type { SSEController } from "./stream";
import type { SelectedModel, ActionPlan, ThinkingStep, Asset } from "@/types";
import { eq, and } from "drizzle-orm";

export interface FlowContext {
  generationId: string;
  userRequest: string;
  models: SelectedModel[];
  referenceImageIds: string[];
}

export async function runFlow(
  ctx: FlowContext,
  sse: SSEController
): Promise<void> {
  const { generationId, userRequest, models, referenceImageIds } = ctx;

  // Step 1: User Request
  sse.send("step:start", { step: "user-request" });
  await sleep(100);
  sse.send("step:complete", { step: "user-request", data: userRequest });

  // Step 2: Request Analysis (with optional image analysis)
  sse.send("step:start", { step: "action-plan" });

  // Fetch reference assets if provided
  let referenceAssets: Asset[] = [];
  if (referenceImageIds.length > 0) {
    referenceAssets = (await db
      .select()
      .from(schema.assets)
      .where(
        and(
          eq(schema.assets.generationId, generationId),
          eq(schema.assets.role, "reference")
        )
      )) as Asset[];
  }

  let actionPlan: ActionPlan;
  try {
    actionPlan = await generateActionPlan(userRequest, referenceAssets);
    await sleep(300);
    sse.send("step:complete", { step: "action-plan", data: actionPlan });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Action plan generation failed:", errorMessage);
    sse.send("step:error", { step: "action-plan", error: errorMessage });
    throw new Error(`Failed to analyze request: ${errorMessage}`);
  }

  // Step 3: Thinking Trace
  sse.send("step:start", { step: "thinking" });
  const thinkingStepsArray: ThinkingStep[] = [];
  try {
    for await (const step of generateThinkingTrace(userRequest, actionPlan)) {
      // Check if this is an error step
      if (step.step === "Error") {
        throw new Error(step.reasoning);
      }
      thinkingStepsArray.push(step);
      sse.send("step:progress", { step: "thinking", data: step });
    }
    sse.send("step:complete", { step: "thinking", data: thinkingStepsArray });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Thinking generation failed:", errorMessage);
    sse.send("step:error", { step: "thinking", error: errorMessage });
    throw new Error(`Failed to generate thinking trace: ${errorMessage}`);
  }

  // Step 4: Prompt Construction
  sse.send("step:start", { step: "prompt-construction" });
  const expandedPrompt = await constructPrompt(userRequest, actionPlan, thinkingStepsArray);
  await sleep(200);
  sse.send("step:complete", { step: "prompt-construction", data: expandedPrompt });

  // Step 5: Image Generation
  sse.send("step:start", { step: "image-generation" });

  // Get version numbers for each model
  const versionMap = await getNextVersions(generationId, models);

  // Create run records
  const runIds: Record<string, string> = {};
  for (const model of models) {
    const runId = nanoid();
    runIds[model.modelId] = runId;
    await db.insert(schema.runs).values({
      id: runId,
      generationId,
      provider: model.provider,
      model: model.modelId,
      version: versionMap[model.modelId],
      status: "running",
      actionPlanJson: JSON.stringify(actionPlan),
      thinkingTrace: JSON.stringify(thinkingStepsArray),
      expandedPrompt,
      createdAt: new Date(),
    });
    sse.send("model:start", {
      modelId: model.modelId,
      provider: model.provider,
      runId,
      version: versionMap[model.modelId],
    });
  }

  // Generate images in parallel
  const results = await Promise.allSettled(
    models.map((model) =>
      generateAndStore(model, runIds[model.modelId], generationId, expandedPrompt, sse)
    )
  );

  // Update run statuses
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const result = results[i];
    const runId = runIds[model.modelId];

    if (result.status === "fulfilled") {
      await db
        .update(schema.runs)
        .set({
          status: "completed",
          latencyMs: result.value.latencyMs,
        })
        .where(eq(schema.runs.id, runId));
    } else {
      await db
        .update(schema.runs)
        .set({
          status: "failed",
          error: result.reason?.message || "Unknown error",
        })
        .where(eq(schema.runs.id, runId));
    }
  }

  sse.send("step:complete", { step: "image-generation" });
  sse.send("flow:complete", { generationId });
}

async function generateAndStore(
  model: SelectedModel,
  runId: string,
  generationId: string,
  prompt: string,
  sse: SSEController
): Promise<{ latencyMs: number; assetId: string }> {
  try {
    const result = await generateWithModel(model.modelId, model.provider, prompt);

    // Upload to B2
    const key = generateKey(generationId, "output", model.modelId, "png");
    await uploadImage(key, result.imageBuffer, result.mime);

    // Create asset record
    const sizeBytes = result.imageBuffer.length;
    const assetId = nanoid();
    await db.insert(schema.assets).values({
      id: assetId,
      generationId,
      runId,
      role: "output",
      provider: model.provider,
      b2Key: key,
      mime: result.mime,
      width: result.width,
      height: result.height,
      sizeBytes,
      createdAt: new Date(),
    });

    sse.send("model:complete", {
      modelId: model.modelId,
      runId,
      assetId,
      b2Key: key,
      latencyMs: result.latencyMs,
      width: result.width,
      height: result.height,
      mime: result.mime,
      sizeBytes,
    });

    return { latencyMs: result.latencyMs, assetId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sse.send("model:error", { modelId: model.modelId, runId, error: message });
    throw error;
  }
}

async function getNextVersions(
  generationId: string,
  models: SelectedModel[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  for (const model of models) {
    const existing = await db
      .select({ version: schema.runs.version })
      .from(schema.runs)
      .where(
        and(
          eq(schema.runs.generationId, generationId),
          eq(schema.runs.model, model.modelId)
        )
      )
      .orderBy(schema.runs.version);

    result[model.modelId] =
      existing.length > 0 ? existing[existing.length - 1].version + 1 : 1;
  }

  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { generateActionPlan, generateThinkingTrace, constructPrompt };
export type { ActionPlan, ThinkingStep };
