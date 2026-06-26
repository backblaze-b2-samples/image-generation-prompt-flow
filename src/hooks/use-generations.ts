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
  const normalizedAssetId = assetId ?? null;
  const [state, setState] = useState({
    assetId: normalizedAssetId,
    url: null as string | null,
    isLoading: Boolean(normalizedAssetId),
  });

  useEffect(() => {
    if (!assetId) {
      setState({ assetId: null, url: null, isLoading: false });
      return;
    }

    let active = true;
    const controller = new AbortController();

    setState({ assetId, url: null, isLoading: true });
    fetch(`/api/images/${encodeURIComponent(assetId)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load image URL");
        }
        return res.json();
      })
      .then((data) => {
        if (active) {
          setState({ assetId, url: data.url ?? null, isLoading: false });
        }
      })
      .catch((error) => {
        const aborted =
          error instanceof DOMException && error.name === "AbortError";
        if (active && !aborted) {
          setState({ assetId, url: null, isLoading: false });
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [assetId]);

  if (state.assetId !== normalizedAssetId) {
    return { url: null, isLoading: Boolean(normalizedAssetId) };
  }

  return { url: state.url, isLoading: state.isLoading };
}
