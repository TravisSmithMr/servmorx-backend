import { backendOcrProvider } from '@/services/backend-ocr-provider';
import { openAIOcrProvider } from '@/services/openai-ocr-provider';
import type { OcrProvider } from '@/features/equipment/ocr/types';

const providers: OcrProvider[] = [backendOcrProvider, openAIOcrProvider];

export function resolveOcrProvider() {
  return providers.find((provider) => provider.isAvailable()) ?? null;
}
