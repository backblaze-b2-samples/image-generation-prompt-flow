export type Provider = 'gemini' | 'openai';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export type AssetRole = 'reference' | 'output';

export interface Generation {
  id: string;
  userRequest: string;
  createdAt: Date;
}

export interface Run {
  id: string;
  generationId: string;
  provider: Provider;
  model: string;
  version: number;
  status: RunStatus;
  actionPlanJson: string | null;
  thinkingTrace: string | null;
  expandedPrompt: string | null;
  latencyMs: number | null;
  error: string | null;
  createdAt: Date;
}

export interface Asset {
  id: string;
  generationId: string;
  runId: string | null;
  role: AssetRole;
  provider: Provider | null;
  b2Key: string;
  mime: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  createdAt: Date;
}

export interface ActionPlan {
  summary: string; // Natural language summary for display
  intent: string;
  subjects: string[];
  style: string;
  composition: string;
  mood: string;
  technicalNotes: string[];
  referenceAnalysis?: string;
}

export interface ThinkingStep {
  step: string;
  reasoning: string;
}

export interface FlowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  data?: unknown;
  error?: string;
}

export interface SSEEvent {
  event: string;
  data: unknown;
}

export interface SelectedModel {
  modelId: string;
  provider: Provider;
}

export interface GenerateRequest {
  userRequest: string;
  models: SelectedModel[];
  referenceImageIds?: string[];
  generationId?: string;
}

export interface GenerateResult {
  imageBuffer: Buffer;
  mime: string;
  width: number;
  height: number;
  latencyMs: number;
}

export interface GenerationWithRuns extends Generation {
  runs: Run[];
  assets: Asset[];
}
