const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const OPENAI_CHAT_COMPLETIONS_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

function getServerOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured on the backend.');
  }

  return apiKey;
}

function extractOutputText(payload: unknown) {
  if (payload && typeof payload === 'object' && 'output_text' in payload) {
    const value = payload.output_text;

    if (typeof value === 'string') {
      return value;
    }
  }

  return '';
}

export async function createServerOpenAIResponse(body: Record<string, unknown>) {
  const apiKey = getServerOpenAIKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
    body: JSON.stringify(body),
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI backend request failed: ${response.status} ${errorBody}`);
  }

  return response.json();
}

export async function createServerChatCompletionResponse(body: Record<string, unknown>) {
  const apiKey = getServerOpenAIKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
    body: JSON.stringify(body),
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI backend request failed: ${response.status} ${errorBody}`);
  }

  return response.json();
}

export async function createServerVisionOcrResponse(
  image: {
    base64: string;
    mimeType?: string | null;
  },
  prompt: string
) {
  const payload = await createServerOpenAIResponse({
    model: process.env.OPENAI_OCR_MODEL ?? 'gpt-4.1-mini',
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: prompt,
          },
          {
            type: 'input_image',
            image_url: `data:${image.mimeType ?? 'image/jpeg'};base64,${image.base64}`,
            detail: 'high',
          },
        ],
      },
    ],
  });

  return extractOutputText(payload).trim();
}

export async function createServerTextResponse(prompt: string) {
  const payload = await createServerChatCompletionResponse({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are SERVMORX TECH, an AI HVAC diagnostic copilot for field technicians. Return valid JSON only.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  if (
    payload &&
    typeof payload === 'object' &&
    'choices' in payload &&
    Array.isArray(payload.choices)
  ) {
    const content = payload.choices[0]?.message?.content;

    if (typeof content === 'string') {
      return content.trim();
    }
  }

  return extractOutputText(payload).trim();
}
