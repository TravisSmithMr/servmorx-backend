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
  equipment?: {
    brand: string;
    modelNumber: string;
    serialNumber: string;
    unitType: string;
    type: string;
    capacity: string;
    estimatedAge: string;
    buildDateEstimate?: string;
    buildYearEstimate?: string;
    refrigeration?: {
      refrigerantType?: string;
      factoryCharge?: string;
      additionalChargeNote?: string;
      meteringNote?: string;
      targetSubcooling?: string;
    };
    electrical?: {
      voltage?: string;
      phase?: string;
      mca?: string;
      mocp?: string;
      compressorRla?: string;
      compressorLra?: string;
      fanMotorFla?: string;
      fanMotorHp?: string;
      blowerMotorType?: string;
    };
    warrantyEstimate?: {
      fiveYearDate?: string;
      tenYearDate?: string;
      note?: string;
    };
    ocrDebug?: {
      rawText?: string;
      normalizedText?: string;
      extractedFields?: Record<string, string>;
      confidenceSignals?: string[];
    };
    confidence: number;
    rawOcrText: string;
  };
  usedFallback: boolean;
}
