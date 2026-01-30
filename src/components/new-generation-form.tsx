"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { IMAGE_MODELS } from "@/lib/models";
import type { SelectedModel } from "@/types";
import { Sparkles, Upload, X } from "lucide-react";
import { nanoid } from "nanoid";

interface NewGenerationFormProps {
  onSubmit: (userRequest: string, models: SelectedModel[], referenceImageIds?: string[], generationId?: string) => void;
  isDisabled: boolean;
}

interface UploadedImage {
  id: string;
  url: string;
  file: File;
}

export function NewGenerationForm({ onSubmit, isDisabled }: NewGenerationFormProps) {
  const [userRequest, setUserRequest] = useState("");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(
    IMAGE_MODELS.map((m) => m.id)
  );
  const [referenceImages, setReferenceImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [generationId] = useState(() => nanoid());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRequest.trim() || selectedModelIds.length === 0 || isUploading) return;

    const models: SelectedModel[] = selectedModelIds
      .map((id) => {
        const model = IMAGE_MODELS.find((m) => m.id === id);
        return model ? { modelId: model.id, provider: model.provider } : null;
      })
      .filter((m): m is SelectedModel => m !== null);

    const referenceImageIds = referenceImages.map((img) => img.id);
    onSubmit(userRequest.trim(), models, referenceImageIds.length > 0 ? referenceImageIds : undefined, referenceImages.length > 0 ? generationId : undefined);
    setUserRequest("");
    setReferenceImages([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("generationId", generationId);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const data = await response.json();
        return {
          id: data.id,
          url: URL.createObjectURL(file),
          file,
        };
      });

      const uploaded = await Promise.all(uploadPromises);
      setReferenceImages((prev) => [...prev, ...uploaded]);
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = (id: string) => {
    setReferenceImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) {
        URL.revokeObjectURL(img.url);
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const toggleModel = (modelId: string) => {
    setSelectedModelIds((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border-b">
      <div>
        <Textarea
          placeholder="Describe the image you want to generate..."
          value={userRequest}
          onChange={(e) => setUserRequest(e.target.value)}
          disabled={isDisabled}
          rows={3}
          className="resize-none"
        />
      </div>

      <div>
        <Label className="text-sm mb-2 block">Reference Images (Optional)</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={isDisabled || isUploading}
          className="hidden"
          id="file-upload"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled || isUploading}
          className="w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          {isUploading ? "Uploading..." : "Upload Reference Images"}
        </Button>
        {referenceImages.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {referenceImages.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.url}
                  alt="Reference"
                  className="w-16 h-16 object-cover rounded border"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {IMAGE_MODELS.map((model) => (
          <div key={model.id} className="flex items-center gap-2">
            <Checkbox
              id={model.id}
              checked={selectedModelIds.includes(model.id)}
              onCheckedChange={() => toggleModel(model.id)}
              disabled={isDisabled}
            />
            <Label htmlFor={model.id} className="text-sm cursor-pointer font-mono">
              {model.id}
            </Label>
          </div>
        ))}
      </div>

      <Button
        type="submit"
        disabled={isDisabled || isUploading || !userRequest.trim() || selectedModelIds.length === 0}
        className="w-full"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Generate
      </Button>
    </form>
  );
}
