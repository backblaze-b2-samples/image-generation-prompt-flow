"use client";

import { cn, formatDate, truncate } from "@/lib/utils";
import type { GenerationWithRuns } from "@/types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GenerationListProps {
  generations: GenerationWithRuns[];
  selectedId: string | null;
  onSelect: (generation: GenerationWithRuns) => void;
  isLoading: boolean;
}

export function GenerationList({
  generations,
  selectedId,
  onSelect,
  isLoading,
}: GenerationListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
        <p>No generations yet</p>
        <p className="text-xs mt-1">Create one to get started</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {generations.map((gen) => (
          <GenerationItem
            key={gen.id}
            generation={gen}
            isSelected={gen.id === selectedId}
            onClick={() => onSelect(gen)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface GenerationItemProps {
  generation: GenerationWithRuns;
  isSelected: boolean;
  onClick: () => void;
}

function GenerationItem({ generation, isSelected, onClick }: GenerationItemProps) {
  const completedRuns = generation.runs.filter((r) => r.status === "completed");
  const outputAssets = generation.assets.filter((a) => a.role === "output");

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-colors",
        isSelected
          ? "bg-accent border-accent-foreground/20"
          : "hover:bg-muted border-transparent"
      )}
    >
      <p className="text-sm font-medium truncate">
        {truncate(generation.userRequest, 40)}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-muted-foreground">
          {formatDate(new Date(generation.createdAt))}
        </span>
        {completedRuns.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {outputAssets.length} images
          </Badge>
        )}
      </div>
    </button>
  );
}
