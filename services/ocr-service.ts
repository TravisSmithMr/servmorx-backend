import { mockOcrProvider } from '@/features/equipment/ocr/providers/mock-ocr-provider';
import { resolveOcrProvider } from '@/features/equipment/ocr/resolve-ocr-provider';
import type { OcrImageInput } from '@/features/equipment/ocr/types';
import { BackendApiError, getBackendApiBaseUrl } from '@/services/backend-api';
import type { OcrProviderPath } from '@/types/diagnostic';

export interface ImageTextExtraction {
  provider: string;
  providerPath: OcrProviderPath;
  providerStatus: string;
  text: string;
  usedFallback: boolean;
  backendUrl: string | null;
  httpStatus: number | null;
  rawBackendResponse: string | null;
  errorMessage: string | null;
  openAiError: boolean | null;
}

export async function extractTextWithMetadata(
  image: OcrImageInput
): Promise<ImageTextExtraction> {
  const provider = resolveOcrProvider();

  if (provider) {
    try {
      const result = await provider.recognizeText(image);
      const providerPath = result.providerPath ?? 'real_provider';
      const providerStatus =
        result.providerStatus ??
        `${provider.name} OCR configured and used successfully.`;
      const usedFallback = result.usedFallback ?? false;
      console.debug('[scan][ocr][raw]', result.text);
      console.debug('[scan][ocr][meta]', {
        provider: result.provider,
        providerPath,
        providerStatus,
        usedFallback,
        textPreview: result.text.slice(0, 240),
      });

      return {
        provider: result.provider,
        providerPath,
        providerStatus,
        text: result.text,
        usedFallback,
        backendUrl: result.backendUrl ?? getBackendApiBaseUrl(),
        httpStatus: result.httpStatus ?? null,
        rawBackendResponse: result.rawBackendResponse ?? null,
        errorMessage: result.errorMessage ?? null,
        openAiError: result.openAiError ?? null,
      };
    } catch (error) {
      const fallback = await mockOcrProvider.recognizeText(image);
      const backendError = error instanceof BackendApiError ? error : null;
      const providerStatus =
        error instanceof Error
          ? `${provider.name} OCR failed: ${error.message}`
          : `${provider.name} OCR failed and fallback text was used.`;
      console.debug('[scan][ocr][raw]', fallback.text);
      console.debug('[scan][ocr][meta]', {
        provider: fallback.provider,
        providerPath: 'fallback_provider',
        providerStatus,
        usedFallback: true,
        backendUrl: backendError?.url ?? getBackendApiBaseUrl(),
        httpStatus: backendError?.status ?? null,
        rawBackendResponse: backendError?.rawBody ?? null,
        errorMessage: error instanceof Error ? error.message : 'Unknown OCR provider failure.',
        openAiError:
          providerStatus.toLowerCase().includes('openai') ||
          (backendError?.rawBody ?? '').toLowerCase().includes('openai'),
        textPreview: fallback.text.slice(0, 240),
      });

      return {
        provider: fallback.provider,
        providerPath: 'fallback_provider',
        providerStatus,
        text: fallback.text,
        usedFallback: true,
        backendUrl: backendError?.url ?? getBackendApiBaseUrl(),
        httpStatus: backendError?.status ?? null,
        rawBackendResponse: backendError?.rawBody ?? null,
        errorMessage: error instanceof Error ? error.message : 'Unknown OCR provider failure.',
        openAiError:
          providerStatus.toLowerCase().includes('openai') ||
          (backendError?.rawBody ?? '').toLowerCase().includes('openai'),
      };
    }
  }

  const fallback = await mockOcrProvider.recognizeText(image);
  const providerStatus =
    'No backend OCR endpoint is configured. Set EXPO_PUBLIC_API_BASE_URL to enable the backend proxy path.';
  console.debug('[scan][ocr][raw]', fallback.text);
  console.debug('[scan][ocr][meta]', {
    provider: fallback.provider,
    providerPath: 'mock_provider',
    providerStatus,
    usedFallback: true,
    textPreview: fallback.text.slice(0, 240),
  });

  return {
    provider: fallback.provider,
    providerPath: 'mock_provider',
    providerStatus,
    text: fallback.text,
    usedFallback: true,
    backendUrl: getBackendApiBaseUrl(),
    httpStatus: null,
    rawBackendResponse: null,
    errorMessage: 'No backend OCR endpoint is configured.',
    openAiError: null,
  };
}

export async function extractTextFromImage(image: OcrImageInput): Promise<string> {
  const result = await extractTextWithMetadata(image);
  return result.text;
}
