export interface ImageProvider {
  name: string;
  model: string;
  generate(prompt: string, options?: GenerateOptions): Promise<GenerateResult>;
}

export interface GenerateOptions {
  width?: number;
  height?: number;
  referenceImage?: Buffer;
}

export interface GenerateResult {
  imageBuffer: Buffer;
  mime: string;
  width: number;
  height: number;
  latencyMs: number;
}
