"use client";

import { useState, useCallback, useRef } from "react";
import type {
  Provider,
  FlowStep,
  ActionPlan,
  ThinkingStep,
  GenerationWithRuns,
  SelectedModel,
} from "@/types";

export interface ModelStatus {
  status: "pending" | "running" | "completed" | "failed";
  modelId: string;
  provider: Provider;
  runId?: string;
  assetId?: string;
  b2Key?: string;
  latencyMs?: number;
  width?: number;
  height?: number;
  mime?: string;
  sizeBytes?: number;
  error?: string;
}

export interface StreamState {
  generationId: string | null;
  isRunning: boolean;
  currentStep: string | null;
  steps: FlowStep[];
  userRequest: string | null;
  actionPlan: ActionPlan | null;
  thinkingSteps: ThinkingStep[];
  expandedPrompt: string | null;
  modelStatus: Record<string, ModelStatus>;
  error: string | null;
}

const initialState: StreamState = {
  generationId: null,
  isRunning: false,
  currentStep: null,
  steps: [],
  userRequest: null,
  actionPlan: null,
  thinkingSteps: [],
  expandedPrompt: null,
  modelStatus: {},
  error: null,
};

export function useGenerationStream() {
  const [state, setState] = useState<StreamState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const startGeneration = useCallback(
    async (userRequest: string, models: SelectedModel[], referenceImageIds?: string[], generationId?: string) => {
      // Abort any existing stream
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const abortController = new AbortController();
      abortRef.current = abortController;

      // Initialize state
      setState({
        ...initialState,
        isRunning: true,
        modelStatus: models.reduce(
          (acc, m) => ({
            ...acc,
            [m.modelId]: {
              status: "pending" as const,
              modelId: m.modelId,
              provider: m.provider,
            },
          }),
          {} as StreamState["modelStatus"]
        ),
      });

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userRequest, models, referenceImageIds, generationId }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const chunk of lines) {
            if (!chunk.trim()) continue;

            const eventMatch = chunk.match(/^event: (.+)$/m);
            const dataMatch = chunk.match(/^data: (.+)$/m);

            if (eventMatch && dataMatch) {
              const event = eventMatch[1];
              const data = JSON.parse(dataMatch[1]);
              handleEvent(event, data, setState);
            }
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        setState((s) => ({
          ...s,
          isRunning: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }));
      }
    },
    []
  );

  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState((s) => ({ ...s, isRunning: false }));
  }, []);

  const reset = useCallback(() => {
    stopGeneration();
    setState(initialState);
  }, [stopGeneration]);

  const loadFromGeneration = useCallback((generation: GenerationWithRuns) => {
    // Get the first run to extract flow data (all runs share the same flow data)
    const run = generation.runs[0];

    let actionPlan: ActionPlan | null = null;
    let thinkingSteps: ThinkingStep[] = [];
    let expandedPrompt: string | null = null;

    if (run) {
      if (run.actionPlanJson) {
        try {
          actionPlan = JSON.parse(run.actionPlanJson);
        } catch {}
      }
      if (run.thinkingTrace) {
        try {
          thinkingSteps = JSON.parse(run.thinkingTrace);
        } catch {}
      }
      expandedPrompt = run.expandedPrompt;
    }

    // Build model status from runs
    const modelStatus = generation.runs.reduce((acc, r) => {
      const asset = generation.assets.find(
        (a) => a.runId === r.id && a.role === "output"
      );
      return {
        ...acc,
        [r.model]: {
          status: r.status as "pending" | "running" | "completed" | "failed",
          modelId: r.model,
          provider: r.provider as Provider,
          runId: r.id,
          assetId: asset?.id,
          b2Key: asset?.b2Key,
          latencyMs: r.latencyMs ?? undefined,
          width: asset?.width ?? undefined,
          height: asset?.height ?? undefined,
          mime: asset?.mime ?? undefined,
          sizeBytes: asset?.sizeBytes ?? undefined,
          error: r.error ?? undefined,
        },
      };
    }, {} as StreamState["modelStatus"]);

    // Build completed steps
    const steps: FlowStep[] = [
      { id: "user-request", name: "User Request", status: "completed" },
      { id: "action-plan", name: "Request Analysis", status: "completed" },
      { id: "thinking", name: "Thinking", status: "completed" },
      { id: "prompt-construction", name: "Prompt Construction", status: "completed" },
      { id: "image-generation", name: "Image Generation", status: "completed" },
    ];

    setState({
      generationId: generation.id,
      isRunning: false,
      currentStep: null,
      steps,
      userRequest: generation.userRequest,
      actionPlan,
      thinkingSteps,
      expandedPrompt,
      modelStatus,
      error: null,
    });
  }, []);

  return {
    ...state,
    startGeneration,
    stopGeneration,
    reset,
    loadFromGeneration,
  };
}

function handleEvent(
  event: string,
  data: unknown,
  setState: React.Dispatch<React.SetStateAction<StreamState>>
) {
  switch (event) {
    case "flow:start":
      setState((s) => ({
        ...s,
        generationId: (data as { generationId: string }).generationId,
      }));
      break;

    case "step:start":
      setState((s) => ({
        ...s,
        currentStep: (data as { step: string }).step,
        steps: [
          ...s.steps,
          {
            id: (data as { step: string }).step,
            name: formatStepName((data as { step: string }).step),
            status: "running",
          },
        ],
      }));
      break;

    case "step:progress":
      if ((data as { step: string }).step === "thinking") {
        setState((s) => ({
          ...s,
          thinkingSteps: [...s.thinkingSteps, (data as { data: ThinkingStep }).data],
        }));
      }
      break;

    case "step:complete": {
      const stepData = data as { step: string; data: unknown };
      setState((s) => {
        const newState = { ...s };
        newState.steps = s.steps.map((step) =>
          step.id === stepData.step
            ? { ...step, status: "completed" as const, data: stepData.data }
            : step
        );

        switch (stepData.step) {
          case "user-request":
            newState.userRequest = stepData.data as string;
            break;
          case "action-plan":
            newState.actionPlan = stepData.data as ActionPlan;
            break;
          case "thinking":
            // Already handled in progress
            break;
          case "prompt-construction":
            newState.expandedPrompt = stepData.data as string;
            break;
        }

        return newState;
      });
      break;
    }

    case "model:start": {
      const d = data as { modelId: string; provider: Provider; runId: string };
      setState((s) => ({
        ...s,
        modelStatus: {
          ...s.modelStatus,
          [d.modelId]: {
            ...s.modelStatus[d.modelId],
            status: "running" as const,
            runId: d.runId,
          },
        },
      }));
      break;
    }

    case "model:complete": {
      const d = data as {
        modelId: string;
        assetId: string;
        b2Key: string;
        latencyMs: number;
        width: number;
        height: number;
        mime: string;
        sizeBytes: number;
      };
      setState((s) => ({
        ...s,
        modelStatus: {
          ...s.modelStatus,
          [d.modelId]: {
            ...s.modelStatus[d.modelId],
            status: "completed" as const,
            assetId: d.assetId,
            b2Key: d.b2Key,
            latencyMs: d.latencyMs,
            width: d.width,
            height: d.height,
            mime: d.mime,
            sizeBytes: d.sizeBytes,
          },
        },
      }));
      break;
    }

    case "model:error": {
      const d = data as { modelId: string; error: string };
      setState((s) => ({
        ...s,
        modelStatus: {
          ...s.modelStatus,
          [d.modelId]: {
            ...s.modelStatus[d.modelId],
            status: "failed" as const,
            error: d.error,
          },
        },
      }));
      break;
    }

    case "flow:complete":
      setState((s) => ({ ...s, isRunning: false }));
      break;

    case "flow:error":
      setState((s) => ({
        ...s,
        isRunning: false,
        error: (data as { error: string }).error,
      }));
      break;
  }
}

function formatStepName(step: string): string {
  const names: Record<string, string> = {
    "user-request": "User Request",
    "action-plan": "Request Analysis",
    thinking: "Thinking",
    "prompt-construction": "Prompt Construction",
    "image-generation": "Image Generation",
  };
  return names[step] || step;
}
