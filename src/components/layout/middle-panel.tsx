"use client";

import { cn } from "@/lib/utils";
import { FlowContainer } from "@/components/prompt-flow/flow-container";
import type { StreamState } from "@/hooks/use-generation-stream";

interface MiddlePanelProps {
  className?: string;
  streamState: StreamState;
}

export function MiddlePanel({ className, streamState }: MiddlePanelProps) {
  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <div className="p-4 border-b">
        <h2 className="font-semibold">Prompt Flow</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Real-time generation steps
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <FlowContainer state={streamState} />
      </div>
    </div>
  );
}
