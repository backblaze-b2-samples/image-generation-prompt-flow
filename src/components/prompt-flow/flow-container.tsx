"use client";

import { useState, useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StepUserRequest } from "./step-user-request";
import { StepActionPlan } from "./step-action-plan";
import { StepThinking } from "./step-thinking";
import { StepPromptConstruction } from "./step-prompt-construction";
import { StepImageGeneration } from "./step-image-generation";
import type { StreamState } from "@/hooks/use-generation-stream";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface FlowContainerProps {
  state: StreamState;
}

export function FlowContainer({ state }: FlowContainerProps) {
  const {
    steps,
    currentStep,
    userRequest,
    actionPlan,
    thinkingSteps,
    expandedPrompt,
    modelStatus,
    error,
  } = state;

  const [openSteps, setOpenSteps] = useState<string[]>([]);

  // Auto-open steps that are running or completed
  useEffect(() => {
    const activeSteps = steps
      .filter((s) => s.status === "running" || s.status === "completed")
      .map((s) => s.id);

    setOpenSteps((prev) => {
      // Merge with existing open steps to maintain user's manual toggles
      const combined = new Set([...prev, ...activeSteps]);
      return Array.from(combined);
    });
  }, [steps]);

  if (!state.isRunning && steps.length === 0 && !userRequest) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-lg">Create a new generation to see the flow</p>
        <p className="text-sm mt-1">
          The prompt flow will appear here in real-time
        </p>
      </div>
    );
  }

  const getStepStatus = (stepId: string) => {
    const step = steps.find((s) => s.id === stepId);
    if (!step) return "pending";
    return step.status;
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-destructive mb-1">Generation Error</h3>
                <p className="text-sm text-destructive/90 leading-relaxed">{error}</p>
                {error.toLowerCase().includes("quota") && (
                  <div className="mt-3 pt-3 border-t border-destructive/20">
                    <p className="text-xs text-muted-foreground mb-2">Helpful resources:</p>
                    <ul className="text-xs space-y-1">
                      <li>
                        <a
                          href="https://ai.google.dev/gemini-api/docs/rate-limits"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-destructive hover:underline inline-flex items-center gap-1"
                        >
                          Learn about rate limits
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://ai.google.dev/pricing"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-destructive hover:underline inline-flex items-center gap-1"
                        >
                          View pricing and upgrade options
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <Accordion
          type="multiple"
          value={openSteps}
          onValueChange={setOpenSteps}
          className="space-y-2"
        >
          <FlowStep
            id="user-request"
            title="User Request"
            status={getStepStatus("user-request")}
          >
            <StepUserRequest userRequest={userRequest} />
          </FlowStep>

          <FlowStep
            id="action-plan"
            title="Request Analysis"
            status={getStepStatus("action-plan")}
          >
            <StepActionPlan actionPlan={actionPlan} />
          </FlowStep>

          <FlowStep
            id="thinking"
            title="Thinking"
            status={getStepStatus("thinking")}
          >
            <StepThinking thinkingSteps={thinkingSteps} />
          </FlowStep>

          <FlowStep
            id="prompt-construction"
            title="Prompt Construction"
            status={getStepStatus("prompt-construction")}
          >
            <StepPromptConstruction expandedPrompt={expandedPrompt} />
          </FlowStep>

          <FlowStep
            id="image-generation"
            title="Image Generation"
            status={getStepStatus("image-generation")}
          >
            <StepImageGeneration modelStatus={modelStatus} />
          </FlowStep>
        </Accordion>
      </div>
    </ScrollArea>
  );
}

interface FlowStepProps {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "failed";
  children: React.ReactNode;
}

function FlowStep({ id, title, status, children }: FlowStepProps) {
  return (
    <AccordionItem value={id} className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3">
          <StepIcon status={status} />
          <span className="font-medium">{title}</span>
          <StepBadge status={status} />
        </div>
      </AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case "running":
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case "failed":
      return <Circle className="w-5 h-5 text-red-500" />;
    default:
      return <Circle className="w-5 h-5 text-muted-foreground" />;
  }
}

function StepBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Badge variant="success">Complete</Badge>;
    case "running":
      return <Badge variant="default">Running</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return null;
  }
}
