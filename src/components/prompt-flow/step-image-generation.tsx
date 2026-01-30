"use client";

import { Badge } from "@/components/ui/badge";
import type { ModelStatus } from "@/hooks/use-generation-stream";
import { Image, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface StepImageGenerationProps {
  modelStatus: Record<string, ModelStatus>;
}

export function StepImageGeneration({ modelStatus }: StepImageGenerationProps) {
  const modelIds = Object.keys(modelStatus);

  if (modelIds.length === 0) {
    return (
      <div className="text-muted-foreground text-sm">
        Waiting for image generation...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {modelIds.map((modelId) => {
        const status = modelStatus[modelId];
        return <ModelCard key={modelId} modelId={modelId} status={status} />;
      })}
    </div>
  );
}

interface ModelCardProps {
  modelId: string;
  status: ModelStatus;
}

function ModelCard({ modelId, status }: ModelCardProps) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <StatusIcon status={status.status} />
        <div>
          <p className="text-sm font-mono">{modelId}</p>
          {status.status === "completed" && status.latencyMs && (
            <p className="text-xs text-muted-foreground">
              {(status.latencyMs / 1000).toFixed(1)}s
            </p>
          )}
          {status.status === "failed" && status.error && (
            <p className="text-xs text-destructive truncate max-w-[200px]">
              {status.error}
            </p>
          )}
        </div>
      </div>
      <StatusBadge status={status.status} />
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case "running":
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case "failed":
      return <XCircle className="w-5 h-5 text-red-500" />;
    default:
      return <Image className="w-5 h-5 text-muted-foreground" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Badge variant="success">Done</Badge>;
    case "running":
      return <Badge variant="default">Generating</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">Pending</Badge>;
  }
}
