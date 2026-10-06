import type { Provider } from "@/types";

export interface ModelConfig {
  id: string;
  provider: Provider;
  type: "imagen" | "multimodal" | "dalle";
}

export const IMAGE_MODELS: ModelConfig[] = [
  {
    id: "gemini-3-pro-image",
    provider: "gemini",
    type: "multimodal",
  },
  {
    id: "gemini-3.1-flash-image",
    provider: "gemini",
    type: "multimodal",
  },
  {
    id: "gpt-image-1",
    provider: "openai",
    type: "multimodal",
  },
  {
    id: "gpt-image-2",
    provider: "openai",
    type: "multimodal",
  },
];

export function getModelConfig(modelId: string): ModelConfig | undefined {
  return IMAGE_MODELS.find((m) => m.id === modelId);
}
