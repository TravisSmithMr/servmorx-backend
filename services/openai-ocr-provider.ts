import type { OcrImageInput, OcrProvider, OcrProviderResult } from '@/features/equipment/ocr/types';

const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-4.1-mini';

function extractOutputText(payload: unknown) {
  if (payload && typeof payload === 'object' && 'output_text' in payload) {
    const value = payload.output_text;

    if (typeof value === 'string') {
      return value;
    }
  }

  return '';
}

async function createOpenAIVisionResponse(image: OcrImageInput) {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_OPENAI_API_KEY is not configured.');
  }

  const response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.EXPO_PUBLIC_OCR_MODEL ?? DEFAULT_MODEL,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text:
                'Read this HVAC equipment data tag and return the visible OCR text exactly as text with line breaks. Preserve model numbers, serial numbers, voltages, and brand names.',
            },
            {
              type: 'input_image',
              image_url: `data:${image.mimeType ?? 'image/jpeg'};base64,${image.base64}`,
              detail: 'high',
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OCR request failed: ${response.status} ${body}`);
  }

  return response.json();
}

export const openAIOcrProvider: OcrProvider = {
  name: 'openai_client_fallback',
  isAvailable: () =>
    __DEV__ &&
    process.env.EXPO_PUBLIC_ENABLE_CLIENT_OCR_FALLBACK === 'true' &&
    Boolean(process.env.EXPO_PUBLIC_OPENAI_API_KEY),
  recognizeText: async (image: OcrImageInput): Promise<OcrProviderResult> => {
    const payload = await createOpenAIVisionResponse(image);
    const text = extractOutputText(payload).trim();

    if (!text) {
      throw new Error('OCR provider returned no readable text.');
    }

    return {
      provider: 'openai',
      text,
      providerPath: 'real_provider',
      providerStatus:
        'Client-side OpenAI OCR fallback was used. This should stay disabled in production.',
      usedFallback: false,
    };
  },
};
