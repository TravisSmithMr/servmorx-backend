import {
  buildScanDebugData,
  parseEquipmentText,
} from '@/features/equipment/services/parse-equipment-tag-text';
import { extractTextFromImage, extractTextWithMetadata } from '@/services/ocr-service';

export interface EquipmentTagImage {
  base64: string | null;
  mimeType?: string | null;
  fileName?: string | null;
}

export interface EquipmentExtractionResult {
  brand: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  detectedUnitType: string | null;
  detectedSystemType: import('@/types/diagnostic').SystemTypeId | null;
  extractionConfidence: number | null;
  ocrText: string | null;
  ocrProvider: string | null;
  scanDebug: import('@/types/diagnostic').ScanDebugData;
}

export async function extractEquipmentTag(
  image: EquipmentTagImage
): Promise<EquipmentExtractionResult> {
  if (!image.base64) {
    throw new Error('Captured image did not include base64 data for OCR.');
  }

  const extraction = await extractTextWithMetadata({
    base64: image.base64,
    mimeType: image.mimeType,
    fileName: image.fileName,
  });
  const parsed = parseEquipmentText(extraction.text);
  const extractionConfidence =
    extraction.usedFallback || extraction.provider === 'mock_unavailable'
      ? Math.min(parsed.extractionConfidence, 0.22)
      : parsed.extractionConfidence;
  const scanDebug = buildScanDebugData(
    parsed.debug,
    extraction.providerPath,
    extraction.providerStatus,
    {
      backendUrl: extraction.backendUrl,
      httpStatus: extraction.httpStatus,
      rawBackendResponse: extraction.rawBackendResponse,
      errorMessage: extraction.errorMessage,
      openAiError: extraction.openAiError,
    }
  );

  console.debug('[scan][ocr][request]', {
    backendUrl: extraction.backendUrl,
    httpStatus: extraction.httpStatus,
    provider: extraction.provider,
    providerPath: extraction.providerPath,
    providerStatus: extraction.providerStatus,
    usedFallback: extraction.usedFallback,
    openAiError: extraction.openAiError,
    errorMessage: extraction.errorMessage,
    rawBackendResponse: extraction.rawBackendResponse,
  });
  console.debug('[scan][ocr][normalized]', parsed.debug.normalizedText);
  console.debug('[scan][parser]', {
    backendUrl: extraction.backendUrl,
    httpStatus: extraction.httpStatus,
    provider: extraction.provider,
    providerPath: extraction.providerPath,
    providerStatus: extraction.providerStatus,
    usedFallback: extraction.usedFallback,
    errorMessage: extraction.errorMessage,
    openAiError: extraction.openAiError,
    rawBackendResponse: extraction.rawBackendResponse,
    rawOcrText: extraction.text,
    normalizedOcrText: parsed.debug.normalizedText,
    brandCandidates: scanDebug.brandCandidates,
    modelCandidates: scanDebug.modelCandidates,
    serialCandidates: scanDebug.serialCandidates,
    confidenceSignals: scanDebug.confidenceSignals,
    failureReason: scanDebug.failureReason,
  });

  return {
    brand: parsed.brand,
    modelNumber: parsed.modelNumber,
    serialNumber: parsed.serialNumber,
    detectedUnitType: parsed.detectedUnitType,
    detectedSystemType: parsed.detectedSystemType,
    extractionConfidence,
    ocrText: extraction.text,
    ocrProvider: extraction.provider,
    scanDebug,
  };
}

export { extractTextFromImage, extractTextWithMetadata } from '@/services/ocr-service';
export { parseEquipmentText } from '@/features/equipment/services/parse-equipment-tag-text';
