import type { DiagnosticsAnalyzeSystemRequest, DiagnosticsAnalyzeSystemResponse, DiagnosticsCopilotRequest, DiagnosticsCopilotResponse } from '@/backend/contracts/diagnostics';
import type { OcrExtractTextRequest, OcrExtractTextResponse } from '@/backend/contracts/ocr';

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function getBackendApiBaseUrl() {
  const value = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  return value ? trimTrailingSlash(value) : null;
}

export function isBackendApiConfigured() {
  return Boolean(getBackendApiBaseUrl());
}

export class BackendApiError extends Error {
  status: number | null;
  url: string | null;
  rawBody: string | null;

  constructor(message: string, options?: { status?: number | null; url?: string | null; rawBody?: string | null }) {
    super(message);
    this.name = 'BackendApiError';
    this.status = options?.status ?? null;
    this.url = options?.url ?? null;
    this.rawBody = options?.rawBody ?? null;
  }
}

async function postJsonDetailed<TRequest, TResponse>(
  path: string,
  payload: TRequest
): Promise<{ data: TResponse; status: number; url: string; rawText: string }> {
  const baseUrl = getBackendApiBaseUrl();

  if (!baseUrl) {
    throw new BackendApiError('EXPO_PUBLIC_API_BASE_URL is not configured.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const url = `${baseUrl}${path}`;

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await response.text();

  if (!response.ok) {
    throw new BackendApiError(`Backend request failed: ${response.status} ${rawText}`, {
      status: response.status,
      url,
      rawBody: rawText,
    });
  }

  try {
    return {
      data: JSON.parse(rawText) as TResponse,
      status: response.status,
      url,
      rawText,
    };
  } catch (error) {
    throw new BackendApiError(
      error instanceof Error
        ? `Backend returned invalid JSON: ${error.message}`
        : 'Backend returned invalid JSON.',
      {
        status: response.status,
        url,
        rawBody: rawText,
      }
    );
  }
}

async function postJson<TRequest, TResponse>(path: string, payload: TRequest): Promise<TResponse> {
  const response = await postJsonDetailed<TRequest, TResponse>(path, payload);
  return response.data;
}

export function postOcrExtractText(payload: OcrExtractTextRequest) {
  return postJson<OcrExtractTextRequest, OcrExtractTextResponse>('/ocr/extract-text', payload);
}

export function postOcrExtractTextDetailed(payload: OcrExtractTextRequest) {
  return postJsonDetailed<OcrExtractTextRequest, OcrExtractTextResponse>(
    '/ocr/extract-text',
    payload
  );
}

export function postDiagnosticsCopilot(payload: DiagnosticsCopilotRequest) {
  return postJson<DiagnosticsCopilotRequest, DiagnosticsCopilotResponse>(
    '/diagnostics/copilot',
    payload
  );
}

export function postDiagnosticsAnalyzeSystem(payload: DiagnosticsAnalyzeSystemRequest) {
  return postJson<DiagnosticsAnalyzeSystemRequest, DiagnosticsAnalyzeSystemResponse>(
    '/diagnostics/analyze-system',
    payload
  );
}
