import type { OcrImageInput, OcrProvider, OcrProviderResult } from '@/features/equipment/ocr/types';

export const mockOcrProvider: OcrProvider = {
  name: 'mock_unavailable',
  isAvailable: () => true,
  recognizeText: async (_image: OcrImageInput): Promise<OcrProviderResult> => {
    return {
      provider: 'mock_unavailable',
      text: 'OCR fallback active. No reliable text extracted from this image.',
    };
  },
};
