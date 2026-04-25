import type { OcrExtractTextRequest, OcrExtractTextResponse } from '@/backend/contracts/ocr';
import { createServerVisionOcrResponse } from '@/backend/lib/openai-server-client';
import { mockOcrProvider } from '@/features/equipment/ocr/providers/mock-ocr-provider';

export async function handleOcrExtractText(
  request: OcrExtractTextRequest
): Promise<OcrExtractTextResponse> {
  try {
    const text = await createServerVisionOcrResponse(
      {
        base64: request.image.base64,
        mimeType: request.image.mimeType,
      },
      'Read this HVAC equipment data tag and return the visible OCR text exactly as text with line breaks. Preserve model numbers, serial numbers, voltages, and brand names.'
    );

    if (!text) {
      throw new Error('Backend OCR provider returned no readable text.');
    }

    return {
      provider: 'openai',
      providerPath: 'backend_proxy',
      providerStatus: 'Backend OCR provider succeeded.',
      text,
      usedFallback: false,
    };
  } catch (error) {
    const fallback = await mockOcrProvider.recognizeText({
      base64: request.image.base64,
      mimeType: request.image.mimeType,
      fileName: request.image.fileName,
    });

    return {
      provider: fallback.provider,
      providerPath: 'backend_proxy',
      providerStatus:
        error instanceof Error
          ? `Backend OCR proxy fallback used: ${error.message}`
          : 'Backend OCR proxy fallback used.',
      text: fallback.text,
      usedFallback: true,
    };
  }
}
