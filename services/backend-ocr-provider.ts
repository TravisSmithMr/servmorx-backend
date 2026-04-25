import {
  BackendApiError,
  getBackendApiBaseUrl,
  isBackendApiConfigured,
  postOcrExtractTextDetailed,
} from '@/services/backend-api';
import type { OcrProvider, OcrProviderResult } from '@/features/equipment/ocr/types';

export const backendOcrProvider: OcrProvider = {
  name: 'backend_ocr_proxy',
  isAvailable: () => isBackendApiConfigured(),
  recognizeText: async (image): Promise<OcrProviderResult> => {
    try {
      const response = await postOcrExtractTextDetailed({
        image: {
          base64: image.base64,
          mimeType: image.mimeType,
          fileName: image.fileName,
        },
        mode: 'equipment_tag',
      });

      return {
        provider: response.data.provider,
        text: response.data.text,
        providerPath: 'backend_proxy',
        providerStatus:
          response.data.providerStatus ?? 'Backend OCR responded without provider status metadata.',
        usedFallback: response.data.usedFallback ?? false,
        backendUrl: response.url,
        httpStatus: response.status,
        rawBackendResponse: response.rawText,
        errorMessage: response.data.errorMessage ?? null,
        openAiError: response.data.openAiError ?? false,
      };
    } catch (error) {
      if (error instanceof BackendApiError) {
        throw new BackendApiError(error.message, {
          status: error.status,
          url: error.url ?? `${getBackendApiBaseUrl() ?? ''}/ocr/extract-text`,
          rawBody: error.rawBody,
        });
      }

      throw error;
    }
  },
};
