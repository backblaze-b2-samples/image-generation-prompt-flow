"use client";

import type { ActionPlan } from "@/types";
import { Target, Image } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { TypingText } from "@/components/ui/typing-text";

interface StepActionPlanProps {
  actionPlan: ActionPlan | null;
}

export function StepActionPlan({ actionPlan }: StepActionPlanProps) {
  if (!actionPlan) {
    return <div className="text-muted-foreground text-sm">Analyzing request...</div>;
  }

  return (
    <div className="space-y-4">
      {actionPlan.referenceAnalysis && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Image className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Reference Images Analysis
            </span>
          </div>
          {actionPlan.referenceAnalysis.toLowerCase().includes("unable to analyze") ? (
            <div className="text-sm leading-relaxed text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-3">
              <p className="font-medium mb-1">⚠️ Analysis Unavailable</p>
              <p className="text-xs">{actionPlan.referenceAnalysis}</p>
            </div>
          ) : (
            <div className="text-sm prose prose-sm prose-slate max-w-none
              prose-headings:text-foreground prose-headings:font-semibold prose-headings:text-sm prose-headings:mt-4 prose-headings:mb-2
              prose-p:my-2 prose-p:leading-relaxed prose-p:text-muted-foreground
              prose-ul:my-2 prose-li:my-1 prose-li:text-muted-foreground
              prose-strong:text-foreground prose-strong:font-semibold
              prose-hr:my-3 prose-hr:border-border">
              <ReactMarkdown>{actionPlan.referenceAnalysis}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-green-500" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Request Analysis
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <TypingText text={actionPlan.summary} speed={15} />
        </p>
      </div>
    </div>
  );
}

