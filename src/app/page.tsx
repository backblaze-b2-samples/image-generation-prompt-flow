"use client";

import { useState, useCallback, useEffect } from "react";
import { LeftPanel } from "@/components/layout/left-panel";
import { MiddlePanel } from "@/components/layout/middle-panel";
import { RightPanel } from "@/components/layout/right-panel";
import { useGenerationStream } from "@/hooks/use-generation-stream";
import { useGenerations } from "@/hooks/use-generations";
import type { GenerationWithRuns, SelectedModel } from "@/types";

export default function Home() {
  const [selectedGeneration, setSelectedGeneration] =
    useState<GenerationWithRuns | null>(null);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);

  const stream = useGenerationStream();
  const { generations, isLoading: isLoadingGenerations, refetch } = useGenerations();

  // Refetch generations when stream completes
  useEffect(() => {
    if (!stream.isRunning && stream.generationId) {
      refetch();
    }
  }, [stream.isRunning, stream.generationId, refetch]);

  // Auto-select newly created generation
  useEffect(() => {
    if (stream.generationId && !stream.isRunning) {
      const newGen = generations.find((g) => g.id === stream.generationId);
      if (newGen) {
        setSelectedGeneration(newGen);
      }
    }
  }, [generations, stream.generationId, stream.isRunning]);

  const handleNewGeneration = useCallback(
    (userRequest: string, models: SelectedModel[], referenceImageIds?: string[], generationId?: string) => {
      setSelectedGeneration(null);
      stream.reset();
      stream.startGeneration(userRequest, models, referenceImageIds, generationId);
    },
    [stream]
  );

  const handleSelectGeneration = useCallback(
    (generation: GenerationWithRuns) => {
      if (stream.isRunning) {
        stream.stopGeneration();
      }
      stream.loadFromGeneration(generation);
      setSelectedGeneration(generation);
    },
    [stream]
  );

  const handleToggleLeftPanel = useCallback(() => {
    setIsLeftPanelCollapsed((prev) => !prev);
  }, []);

  // Determine which generation data to show in right panel
  const displayGeneration = stream.isRunning ? null : selectedGeneration;
  const streamModelStatus = stream.isRunning ? stream.modelStatus : undefined;

  // Calculate right panel width based on left panel state
  const rightPanelWidth = isLeftPanelCollapsed ? "w-[780px]" : "w-[520px]";

  return (
    <div className="flex h-screen">
      <LeftPanel
        className={isLeftPanelCollapsed ? "w-12 shrink-0" : "w-80 border-r shrink-0"}
        generations={generations}
        selectedId={stream.generationId || selectedGeneration?.id || null}
        onSelect={handleSelectGeneration}
        onNewGeneration={handleNewGeneration}
        isGenerating={stream.isRunning}
        isLoadingGenerations={isLoadingGenerations}
        isCollapsed={isLeftPanelCollapsed}
        onToggleCollapse={handleToggleLeftPanel}
      />
      <MiddlePanel className="flex-1 border-r min-w-0" streamState={stream} />
      <RightPanel
        className={`${rightPanelWidth} shrink-0 transition-all duration-200`}
        generation={displayGeneration}
        streamModelStatus={streamModelStatus}
      />
    </div>
  );
}
