import type {
  DiagnosticsContextPayload,
  DiagnosticsCopilotRequest,
  DiagnosticsCopilotResponse,
} from '@/backend/contracts/diagnostics';
import { createServerTextResponse } from '@/backend/lib/openai-server-client';
import { localCopilotProvider } from '@/features/copilot/providers/local-copilot-provider';
import type { DiagnosticRouteId } from '@/types/diagnostic';

function buildFallbackContext(context: DiagnosticsContextPayload) {
  return {
    hash: JSON.stringify(context),
    issue: context.issue,
    route: context.route,
    equipment: context.equipment,
    gateAnswers: context.gateAnswers,
    diagAnswers: context.diagAnswers,
    likelyCauses: context.likelyCauses,
    routeConfidence: context.routeConfidence,
    resultConfidence: context.resultConfidence,
    routeReasons: context.routeReasons,
    contradictions: context.contradictions,
    missingDataFlags: context.missingDataFlags,
    analytics: context.analytics,
    result:
      context.route && context.likelyCauses.length > 0
        ? {
            route: context.route as DiagnosticRouteId,
            summary: context.routeReasons[0] ?? 'Structured route selected.',
            routeReasons: context.routeReasons,
            confidenceLevel: context.resultConfidence ?? 'medium',
            likelyCauses: context.likelyCauses,
            nextChecks: context.likelyCauses.map((cause) => cause.nextCheck),
          }
        : null,
  };
}

function extractJsonObject(rawText: string) {
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Backend copilot did not return a JSON object.');
  }

  return JSON.parse(rawText.slice(firstBrace, lastBrace + 1)) as DiagnosticsCopilotResponse;
}

function buildCopilotPrompt(request: DiagnosticsCopilotRequest) {
  return [
    'You are an HVAC diagnostic copilot assisting a field technician.',
    'Use the structured route as source of truth. Do not override it.',
    'Return strict JSON with keys: provider, insight, quickPrompts, messageText.',
    'insight must include summary, direction, followUpQuestion, nextBestTests.',
    'Tone: professional, concise, experienced-tech level.',
    '',
    `User message: ${request.message ?? 'Passive update only.'}`,
    '',
    'Diagnostic context JSON:',
    JSON.stringify(request.context, null, 2),
  ].join('\n');
}

export async function handleDiagnosticsCopilot(
  request: DiagnosticsCopilotRequest
): Promise<DiagnosticsCopilotResponse> {
  try {
    const rawText = await createServerTextResponse(buildCopilotPrompt(request));
    const parsed = extractJsonObject(rawText);

    return {
      ...parsed,
      provider: parsed.provider || 'openai_backend',
    };
  } catch {
    const fallbackContext = buildFallbackContext(request.context);
    const response = request.message
      ? localCopilotProvider.buildReply(fallbackContext, request.message)
      : localCopilotProvider.buildAutoResponse(fallbackContext);

    return {
      provider: 'backend_local_fallback',
      insight: response.insight,
      quickPrompts: response.quickPrompts,
      messageText: response.messageText,
    };
  }
}
