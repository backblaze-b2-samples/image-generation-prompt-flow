"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { NewGenerationForm } from "@/components/new-generation-form";
import { GenerationList } from "@/components/generation-list";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import type { GenerationWithRuns, SelectedModel } from "@/types";

interface LeftPanelProps {
  className?: string;
  generations: GenerationWithRuns[];
  selectedId: string | null;
  onSelect: (generation: GenerationWithRuns) => void;
  onNewGeneration: (userRequest: string, models: SelectedModel[], referenceImageIds?: string[], generationId?: string) => void;
  isGenerating: boolean;
  isLoadingGenerations: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function LeftPanel({
  className,
  generations,
  selectedId,
  onSelect,
  onNewGeneration,
  isGenerating,
  isLoadingGenerations,
  isCollapsed,
  onToggleCollapse,
}: LeftPanelProps) {
  if (isCollapsed) {
    return (
      <div className={cn("flex flex-col h-full bg-background border-r", className)}>
        <div className="flex flex-col items-center gap-2 p-2">
          <a
            href="https://www.backblaze.com/cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=promptflow"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/backblaze-favicon.png"
              alt="Backblaze"
              width={24}
              height={24}
            />
          </a>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <a
            href="https://www.backblaze.com/cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=promptflow"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/backblaze-logo.svg"
              alt="Backblaze"
              width={110}
              height={25}
              priority
            />
          </a>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="h-8 w-8"
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        </div>
        <h1 className="font-bold text-lg">Image Generator</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Multi-provider comparison
        </p>
      </div>
      <NewGenerationForm onSubmit={onNewGeneration} isDisabled={isGenerating} />
      <div className="flex-1 overflow-hidden">
        <GenerationList
          generations={generations}
          selectedId={selectedId}
          onSelect={onSelect}
          isLoading={isLoadingGenerations}
        />
      </div>
    </div>
  );
}
