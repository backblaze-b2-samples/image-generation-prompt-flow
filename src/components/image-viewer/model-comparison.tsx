"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ImageDisplay } from "./image-display";
import type { GenerationWithRuns } from "@/types";
import type { ModelStatus } from "@/hooks/use-generation-stream";
import { Grid2x2, Rows3 } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface ModelComparisonProps {
  generation: GenerationWithRuns | null;
  streamModelStatus?: Record<string, ModelStatus>;
}

export function ModelComparison({
  generation,
  streamModelStatus,
}: ModelComparisonProps) {
  const [viewMode, setViewMode] = useState<"stacked" | "grid">("stacked");
  const [selectedVersions, setSelectedVersions] = useState<Record<string, number>>({});

  if (!generation && !streamModelStatus) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>No images to display</p>
        <p className="text-sm mt-1">Generate images to see them here</p>
      </div>
    );
  }

  // Get model IDs from generation or stream
  const modelIds: string[] = generation
    ? Array.from(new Set(generation.runs.map((r) => r.model)))
    : streamModelStatus
      ? Object.keys(streamModelStatus)
      : [];

  if (modelIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p>No models selected</p>
      </div>
    );
  }

  const getImageKey = (modelId: string): string | undefined => {
    // Check stream first for live updates
    if (streamModelStatus?.[modelId]?.b2Key) {
      return streamModelStatus[modelId].b2Key;
    }

    // Fall back to stored generation
    if (generation) {
      const version = selectedVersions[modelId] || 1;
      const run = generation.runs.find(
        (r) => r.model === modelId && r.version === version
      );
      if (run) {
        const asset = generation.assets.find(
          (a) => a.runId === run.id && a.role === "output"
        );
        return asset?.b2Key;
      }
    }

    return undefined;
  };

  const getModelStatus = (modelId: string) => {
    if (streamModelStatus?.[modelId]) {
      return streamModelStatus[modelId].status;
    }
    if (generation) {
      const run = generation.runs.find(
        (r) => r.model === modelId && r.version === (selectedVersions[modelId] || 1)
      );
      return run?.status || "pending";
    }
    return "pending";
  };

  const getModelDetails = (modelId: string) => {
    // Check stream first for live updates
    if (streamModelStatus?.[modelId]) {
      const s = streamModelStatus[modelId];
      return {
        width: s.width,
        height: s.height,
        sizeBytes: s.sizeBytes,
        latencyMs: s.latencyMs,
      };
    }

    // Fall back to stored generation
    if (generation) {
      const version = selectedVersions[modelId] || 1;
      const run = generation.runs.find(
        (r) => r.model === modelId && r.version === version
      );
      if (run) {
        const asset = generation.assets.find(
          (a) => a.runId === run.id && a.role === "output"
        );
        return {
          width: asset?.width ?? undefined,
          height: asset?.height ?? undefined,
          sizeBytes: asset?.sizeBytes ?? undefined,
          latencyMs: run.latencyMs ?? undefined,
        };
      }
    }

    return {};
  };

  const getVersionsForModel = (modelId: string): number[] => {
    if (!generation) return [1];
    const versions = generation.runs
      .filter((r) => r.model === modelId)
      .map((r) => r.version)
      .sort((a, b) => a - b);
    return versions.length > 0 ? versions : [1];
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">Results</h2>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => v && setViewMode(v as "stacked" | "grid")}
          size="sm"
        >
          <ToggleGroupItem value="stacked" aria-label="Stacked view">
            <Rows3 className="w-4 h-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <Grid2x2 className="w-4 h-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className={viewMode === "stacked" ? "grid grid-cols-1 gap-4" : "grid grid-cols-2 gap-4"}>
          {modelIds.map((modelId) => {
            const details = getModelDetails(modelId);
            return (
              <ModelPanel
                key={modelId}
                modelId={modelId}
                b2Key={getImageKey(modelId)}
                status={getModelStatus(modelId)}
                versions={getVersionsForModel(modelId)}
                selectedVersion={selectedVersions[modelId] || 1}
                onVersionChange={(v) =>
                  setSelectedVersions((s) => ({ ...s, [modelId]: v }))
                }
                {...details}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ModelPanelProps {
  modelId: string;
  b2Key: string | undefined;
  status: string;
  versions: number[];
  selectedVersion: number;
  onVersionChange: (version: number) => void;
  width?: number;
  height?: number;
  sizeBytes?: number;
  latencyMs?: number;
}

function ModelPanel({
  modelId,
  b2Key,
  status,
  versions,
  selectedVersion,
  onVersionChange,
  width,
  height,
  sizeBytes,
  latencyMs,
}: ModelPanelProps) {
  const hasDetails = status === "completed" && (sizeBytes || width || latencyMs);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-muted/50">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-mono text-sm truncate">{modelId}</span>
          {hasDetails && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {width && height && <span>{width}×{height}</span>}
              {sizeBytes && <span>{formatBytes(sizeBytes)}</span>}
              {latencyMs && <span>{(latencyMs / 1000).toFixed(1)}s</span>}
            </div>
          )}
        </div>
        {versions.length > 1 && (
          <Tabs
            value={String(selectedVersion)}
            onValueChange={(v) => onVersionChange(Number(v))}
          >
            <TabsList className="h-8">
              {versions.map((v) => (
                <TabsTrigger key={v} value={String(v)} className="text-xs px-2">
                  v{v}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>
      <div className="aspect-square bg-muted/20">
        <ImageDisplay b2Key={b2Key} status={status} modelId={modelId} />
      </div>
    </div>
  );
}
