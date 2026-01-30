import type { Provider } from "@/types";

export interface ModelConfig {
  id: string;
  provider: Provider;
  type: "imagen" | "multimodal" | "dalle";
}

export const IMAGE_MODELS: ModelConfig[] = [
  {
    id: "gemini-3-pro-image-preview",
    provider: "gemini",
    type: "multimodal",
  },
  {
    id: "imagen-4.0-generate-001",
    provider: "gemini",
    type: "imagen",
  },
  {
    id: "gpt-image-1",
    provider: "openai",
    type: "multimodal",
  },
  {
    id: "dall-e-3",
    provider: "openai",
    type: "dalle",
  },
];

export function getModelConfig(modelId: string): ModelConfig | undefined {
  return IMAGE_MODELS.find((m) => m.id === modelId);
}
