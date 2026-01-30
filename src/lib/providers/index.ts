import type { GenerateResult } from "./types";
import { generateGeminiImage } from "./gemini";
import { generateOpenAIImage } from "./openai";
import type { Provider } from "@/types";

export async function generateWithModel(
  modelId: string,
  provider: Provider,
  prompt: string
): Promise<GenerateResult> {
  switch (provider) {
    case "gemini":
      return generateGeminiImage(modelId, prompt);
    case "openai":
      return generateOpenAIImage(modelId, prompt);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export type { GenerateResult, GenerateOptions } from "./types";
