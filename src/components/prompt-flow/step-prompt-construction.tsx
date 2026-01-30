"use client";

import { FileText } from "lucide-react";
import { TypingText } from "@/components/ui/typing-text";

interface StepPromptConstructionProps {
  expandedPrompt: string | null;
}

export function StepPromptConstruction({
  expandedPrompt,
}: StepPromptConstructionProps) {
  if (!expandedPrompt) {
    return (
      <div className="text-muted-foreground text-sm">Constructing prompt...</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <FileText className="w-4 h-4 text-emerald-500" />
        <span>Final Prompt</span>
      </div>
      <div className="bg-muted/30 border border-border rounded-lg p-4">
        <p className="text-sm font-mono leading-relaxed text-foreground whitespace-pre-wrap">
          <TypingText text={expandedPrompt} speed={8} />
        </p>
      </div>
    </div>
  );
}
