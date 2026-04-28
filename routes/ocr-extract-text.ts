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
      equipment: parseEquipmentIdentity(text),
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
      equipment: parseEquipmentIdentity(fallback.text),
      usedFallback: true,
    };
  }
}

function parseEquipmentIdentity(rawText: string) {
  const lines = rawText
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const brand = extractBrand(rawText);
  const modelNumber = extractLabeledValue(lines, ['model', 'model no', 'model number', 'mdl', 'm/n']);
  const serialNumber = extractLabeledValue(lines, ['serial', 'serial no', 'serial number', 'ser', 's/n']);
  const unitType = extractUnitType(rawText);
  const confidence = Math.max(
    0.1,
    Math.min(0.95, [brand, modelNumber, serialNumber, unitType].filter(Boolean).length / 4)
  );

  return {
    brand,
    modelNumber,
    serialNumber,
    unitType,
    type: unitType,
    capacity: 'Unknown',
    estimatedAge: 'Unknown',
    confidence,
    rawOcrText: rawText,
  };
}

function extractBrand(text: string) {
  const brands = [
    'Trane',
    'Carrier',
    'Lennox',
    'Goodman',
    'Rheem',
    'Ruud',
    'York',
    'American Standard',
    'Bryant',
    'Daikin',
    'Amana',
    'Tempstar',
    'ICP',
    'Payne',
    'Mitsubishi',
    'Bosch',
  ];
  const lowerText = text.toLowerCase();

  return brands.find((brand) => lowerText.includes(brand.toLowerCase())) ?? '';
}

function extractLabeledValue(lines: string[], labels: string[]) {
  for (const line of lines) {
    const compactLine = line.replace(/\s+/g, ' ');

    for (const label of labels) {
      const pattern = new RegExp(
        `\\b${escapeRegex(label)}\\b\\s*(?:#|no\\.?|number|:|-)?\\s*([A-Z0-9][A-Z0-9_.\\-/]{2,})`,
        'i'
      );
      const match = compactLine.match(pattern);

      if (match?.[1]) {
        return match[1].replace(/^[#:\-\s]+/, '').replace(/[,\s;]+$/, '').trim();
      }
    }
  }

  return '';
}

function extractUnitType(text: string) {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('package unit') || lowerText.includes('packaged unit')) {
    return 'Package Unit';
  }

  if (lowerText.includes('split system') || lowerText.includes('split-system')) {
    return 'Split System';
  }

  if (lowerText.includes('heat pump')) {
    return 'Heat Pump';
  }

  if (lowerText.includes('air conditioner') || lowerText.includes('condensing unit')) {
    return 'Air Conditioner';
  }

  if (lowerText.includes('furnace')) {
    return 'Furnace';
  }

  if (lowerText.includes('air handler')) {
    return 'Air Handler';
  }

  return '';
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
