"use client";

import { cn } from "@/lib/utils";
import { ModelComparison } from "@/components/image-viewer/model-comparison";
import type { GenerationWithRuns } from "@/types";
import type { ModelStatus } from "@/hooks/use-generation-stream";

interface RightPanelProps {
  className?: string;
  generation: GenerationWithRuns | null;
  streamModelStatus?: Record<string, ModelStatus>;
}

export function RightPanel({
  className,
  generation,
  streamModelStatus,
}: RightPanelProps) {
  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <ModelComparison
        generation={generation}
        streamModelStatus={streamModelStatus}
      />
    </div>
  );
}
