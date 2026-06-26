"use client";

import { useState, useEffect, useCallback } from "react";
import type { GenerationWithRuns } from "@/types";

export function useGenerations() {
  const [generations, setGenerations] = useState<GenerationWithRuns[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGenerations = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/generations");
      if (!response.ok) {
        throw new Error("Failed to fetch generations");
      }
      const data = await response.json();
      setGenerations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  return {
    generations,
    isLoading,
    error,
    refetch: fetchGenerations,
  };
}

export function useImageUrl(assetId: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!assetId) {
      setUrl(null);
      return;
    }

    setIsLoading(true);
    fetch(`/api/images/${encodeURIComponent(assetId)}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load image URL");
        }
        return res.json();
      })
      .then((data) => {
        setUrl(data.url);
      })
      .catch(() => {
        setUrl(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [assetId]);

  return { url, isLoading };
}
