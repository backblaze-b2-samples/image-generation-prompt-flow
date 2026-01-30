"use client";

import { useState } from "react";
import type { ThinkingStep } from "@/types";
import { Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface StepThinkingProps {
  thinkingSteps: ThinkingStep[];
}

export function StepThinking({ thinkingSteps }: StepThinkingProps) {
  const [visibleSteps, setVisibleSteps] = useState<number>(0);

  if (thinkingSteps.length === 0) {
    return <div className="text-muted-foreground text-sm">Processing...</div>;
  }

  // Show steps progressively as they're added
  const stepsToShow = Math.max(visibleSteps, thinkingSteps.length);

  return (
    <div className="space-y-4">
      {thinkingSteps.slice(0, stepsToShow).map((step, index) => (
        <ThinkingStepItem
          key={index}
          step={step}
          index={index}
          isLast={index === thinkingSteps.length - 1}
          onComplete={() => setVisibleSteps(index + 1)}
        />
      ))}
    </div>
  );
}

function ThinkingStepItem({
  step,
  index,
  isLast,
  onComplete,
}: {
  step: ThinkingStep;
  index: number;
  isLast: boolean;
  onComplete: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <Brain className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold mb-2 text-foreground">{step.step}</p>
        <div className="text-sm prose prose-sm prose-slate max-w-none
          prose-headings:text-foreground prose-headings:font-semibold prose-headings:text-sm prose-headings:mt-4 prose-headings:mb-2
          prose-p:my-2 prose-p:leading-relaxed prose-p:text-muted-foreground
          prose-ul:my-2 prose-li:my-1 prose-li:text-muted-foreground
          prose-strong:text-foreground prose-strong:font-semibold
          prose-hr:my-3 prose-hr:border-border">
          <ReactMarkdown>{step.reasoning}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
