import type { OcrProviderPath } from '@/types/diagnostic';

export interface OcrImageInput {
  base64: string;
  mimeType?: string | null;
  fileName?: string | null;
}

export interface OcrProviderResult {
  provider: string;
  text: string;
  providerPath?: OcrProviderPath;
  providerStatus?: string;
  usedFallback?: boolean;
  backendUrl?: string | null;
  httpStatus?: number | null;
  rawBackendResponse?: string | null;
  errorMessage?: string | null;
  openAiError?: boolean | null;
}

export interface OcrProvider {
  name: string;
  isAvailable: () => boolean;
  recognizeText: (image: OcrImageInput) => Promise<OcrProviderResult>;
}
