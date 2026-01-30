import OpenAI from "openai";
import type { GenerateResult } from "./types";
import { getModelConfig } from "@/lib/models";
import { getImageDimensions } from "./image-utils";

export async function generateOpenAIImage(
  modelId: string,
  prompt: string
): Promise<GenerateResult> {
  const startTime = Date.now();

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const config = getModelConfig(modelId);

  if (config?.type === "multimodal") {
    return generateWithGptImage(client, modelId, prompt, startTime);
  } else {
    return generateWithDalle(client, modelId, prompt, startTime);
  }
}

async function generateWithGptImage(
  client: OpenAI,
  modelId: string,
  prompt: string,
  startTime: number
): Promise<GenerateResult> {
  // gpt-image-1 always returns b64_json - don't pass response_format
  const response = await client.images.generate({
    model: modelId,
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "high",
  });

  const imageData = response.data?.[0];
  if (!imageData?.b64_json) {
    throw new Error("No image data returned from gpt-image-1");
  }

  const imageBuffer = Buffer.from(imageData.b64_json, "base64");
  const { width, height } = getImageDimensions(imageBuffer);

  return {
    imageBuffer,
    mime: "image/png",
    width,
    height,
    latencyMs: Date.now() - startTime,
  };
}

async function generateWithDalle(
  client: OpenAI,
  modelId: string,
  prompt: string,
  startTime: number
): Promise<GenerateResult> {
  const response = await client.images.generate({
    model: modelId,
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "hd",
    response_format: "b64_json",
  });

  const imageData = response.data?.[0];
  if (!imageData?.b64_json) {
    throw new Error("No image data returned from DALL-E");
  }

  const imageBuffer = Buffer.from(imageData.b64_json, "base64");
  const { width, height } = getImageDimensions(imageBuffer);

  return {
    imageBuffer,
    mime: "image/png",
    width,
    height,
    latencyMs: Date.now() - startTime,
  };
}
