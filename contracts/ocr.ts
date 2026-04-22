import type { OcrProviderPath } from '@/types/diagnostic';

export interface OcrExtractTextRequest {
  image: {
    base64: string;
    mimeType?: string | null;
    fileName?: string | null;
  };
  mode: 'equipment_tag';
}

export interface OcrExtractTextResponse {
  provider: string;
  providerPath: OcrProviderPath;
  providerStatus: string;
  text: string;
  usedFallback: boolean;
}
