import type {
  DiagnosticsCopilotRequest,
  DiagnosticsCopilotResponse,
} from '@/backend/contracts/diagnostics';
import { createServerTextResponse } from '@/backend/lib/openai-server-client';

function extractJsonObject(rawText: string) {
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Backend copilot did not return a JSON object.');
  }

  return JSON.parse(rawText.slice(firstBrace, lastBrace + 1)) as DiagnosticsCopilotResponse;
}

function buildCopilotPrompt(context: DiagnosticsCopilotRequest['context']) {
  return [
    buildSystemRole(),
    buildContextBlock(context),
    buildDiagnosticRules(),
    buildTaskInstruction(),
    buildOutputFormat(),
  ].join('\n\n');
}

function buildSystemRole() {
  return [
    'SYSTEM ROLE',
    'You are a senior HVAC service technician.',
    'You diagnose systems based on real field observations.',
    'You do not guess without evidence.',
    'You prioritize confirming tests before conclusions.',
  ].join('\n');
}

function buildContextBlock(context: DiagnosticsCopilotRequest['context']) {
  const issue = context?.selectedIssue ?? context?.issue ?? 'unknown';
  const equipment = context?.equipment ?? null;
  const followUpAnswers = 'followUpAnswers' in context ? context.followUpAnswers : {};
  const techNotes = 'techNotes' in context ? context.techNotes : [];
  const knownFacts = 'knownFacts' in context ? context.knownFacts : [];
  const unknowns = 'unknowns' in context ? context.unknowns : [];
  const currentStage = context?.currentStage ?? context?.stage ?? 'unknown';
  const latestMessage = 'latestTechnicianMessage' in context ? context.latestTechnicianMessage : 'none';

  return [
    'CONTEXT',
    `Current stage: ${currentStage}`,
    `Issue: ${issue}`,
    `Equipment: ${JSON.stringify(equipment)}`,
    `Follow-up answers: ${JSON.stringify(followUpAnswers)}`,
    `Tech notes: ${JSON.stringify(techNotes)}`,
    `Known facts: ${JSON.stringify(knownFacts)}`,
    `Unknowns: ${JSON.stringify(unknowns)}`,
    `Latest technician message: ${latestMessage}`,
  ].join('\n');
}

function buildDiagnosticRules() {
  return [
    'DIAGNOSTIC RULES',
    '- Do not assume refrigerant issues without pressure/temperature evidence.',
    '- Separate airflow vs electrical vs refrigeration first.',
    '- No cooling + fan only does not automatically mean bad compressor.',
    '- Always suggest the next best test.',
    '- Never condemn major components without confirmation.',
  ].join('\n');
}

function buildTaskInstruction() {
  return [
    'TASK INSTRUCTION',
    'Based on this information:',
    '- explain what is most likely happening',
    '- explain why',
    '- suggest the next best diagnostic step',
    '- ask ONE follow-up question if needed',
    '',
    'Keep responses short: 2-4 sentences, no filler, no generic chatbot language, and sound like a field technician.',
  ].join('\n');
}

function buildOutputFormat() {
  return [
    'OUTPUT FORMAT',
    'Return structured JSON only:',
    '{',
    '  "messageText": string,',
    '  "confidence": number,',
    '  "nextStep": string,',
    '  "followUpQuestion": string | null',
    '}',
    'confidence must be 0-100 based only on confirmed evidence.',
  ].join('\n');
}

export async function handleDiagnosticsCopilot(
  request: DiagnosticsCopilotRequest
): Promise<DiagnosticsCopilotResponse> {
  console.log('[diagnostics/copilot] route hit');
  console.log('[diagnostics/copilot] request body:', JSON.stringify(request));
  console.log(
    `[diagnostics/copilot] OPENAI_API_KEY exists: ${Boolean(process.env.OPENAI_API_KEY?.trim())}`
  );

  try {
    const context = {
      ...request.context,
      latestTechnicianMessage: request.message ?? null,
    };

    console.log('[diagnostics/copilot] AI context:', JSON.stringify(context));
    const rawText = await createServerTextResponse(buildCopilotPrompt(context));
    const parsed = extractJsonObject(rawText);
    console.log('[diagnostics/copilot] AI response JSON:', JSON.stringify(parsed));
    logMissingFields(parsed);
    console.log('[diagnostics/copilot] OpenAI response success');
    const normalized = normalizeCopilotResponse(parsed);

    return {
      ...parsed,
      ...normalized,
    };
  } catch (error) {
    console.error('[diagnostics/copilot] OpenAI response failure:', error);

    return {
      provider: 'backend',
      error: true,
      insight: '',
      quickPrompts: [],
      messageText: 'AI request failed',
    };
  }
}

function normalizeDiagnosisResult(value: unknown) {
  if (!value || typeof value !== 'object' || !('mostLikely' in value)) {
    return undefined;
  }

  const result = value as {
    mostLikely?: { label?: unknown; confidence?: unknown };
    confidence?: unknown;
    secondary?: Array<{ label?: unknown; confidence?: unknown }>;
    reasoning?: unknown;
    nextSteps?: unknown[];
    whatWouldConfirm?: unknown[];
    whatWouldRuleOut?: unknown[];
    missingInfo?: unknown[];
    confidenceLabel?: unknown;
    recommendedActions?: unknown[];
    estimatedRange?: unknown;
  };

  return {
    mostLikely: {
      label: String(result.mostLikely?.label || 'AI diagnosis'),
      confidence: clampConfidence(result.mostLikely?.confidence),
    },
    confidence: clampConfidence(result.confidence ?? result.mostLikely?.confidence),
    secondary: Array.isArray(result.secondary)
      ? result.secondary.slice(0, 3).map((cause) => ({
          label: String(cause.label || 'Secondary cause'),
          confidence: clampConfidence(cause.confidence),
        }))
      : [],
    confidenceLabel:
      result.confidenceLabel === 'High' ||
      result.confidenceLabel === 'Medium' ||
      result.confidenceLabel === 'Low'
        ? result.confidenceLabel
        : 'Medium',
    reasoning: typeof result.reasoning === 'string' ? result.reasoning : '',
    nextSteps: Array.isArray(result.nextSteps) ? result.nextSteps.slice(0, 4).map(String) : [],
    whatWouldConfirm: Array.isArray(result.whatWouldConfirm)
      ? result.whatWouldConfirm.slice(0, 4).map(String)
      : [],
    whatWouldRuleOut: Array.isArray(result.whatWouldRuleOut)
      ? result.whatWouldRuleOut.slice(0, 4).map(String)
      : [],
    missingInfo: Array.isArray(result.missingInfo)
      ? result.missingInfo.slice(0, 4).map(String)
      : [],
    recommendedActions: Array.isArray(result.recommendedActions)
      ? result.recommendedActions.slice(0, 4).map(String)
      : Array.isArray(result.nextSteps)
        ? result.nextSteps.slice(0, 4).map(String)
        : [],
    estimatedRange:
      typeof result.estimatedRange === 'string'
        ? result.estimatedRange
        : 'Estimate unavailable',
  };
}

function normalizeCopilotResponse(parsed: Partial<DiagnosticsCopilotResponse>) {
  const messageText =
    typeof parsed.messageText === 'string'
      ? parsed.messageText
      : "Not enough confirmed data yet. Based on what we know, I'd check the next field measurement.";
  const nextBestCheck =
    typeof parsed.nextStep === 'string'
      ? parsed.nextStep
      : typeof parsed.nextBestCheck === 'string'
        ? parsed.nextBestCheck
        : 'Confirm the next live field measurement before ranking causes.';
  const followUpQuestion =
    typeof parsed.followUpQuestion === 'string'
      ? parsed.followUpQuestion
      : typeof parsed.nextBestQuestion === 'string'
        ? parsed.nextBestQuestion
        : null;
  const confidence = clampConfidence(parsed.confidence);

  return {
    provider: 'openai',
    insight: typeof parsed.insight === 'string' ? parsed.insight : messageText,
    quickPrompts: buildQuickPrompts(nextBestCheck, followUpQuestion),
    messageText,
    reasoningSummary: messageText,
    nextBestQuestion: followUpQuestion || '',
    followUpQuestion,
    nextBestCheck,
    nextStep: nextBestCheck,
    confidence,
    cautions: [],
    diagnosisResult: buildDiagnosisAdapter(parsed, messageText, nextBestCheck, followUpQuestion),
  };
}

function buildQuickPrompts(nextStep: string, followUpQuestion: string | null) {
  return [nextStep, followUpQuestion].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );
}

function buildDiagnosisAdapter(
  parsed: Partial<DiagnosticsCopilotResponse>,
  messageText: string,
  nextStep: string,
  followUpQuestion: string | null
) {
  if (parsed.diagnosisResult) {
    return normalizeDiagnosisResult(parsed.diagnosisResult);
  }

  const confidence = clampConfidence(parsed.confidence);

  return {
    mostLikely: {
      label: 'Diagnostic path needs confirmation',
      confidence,
    },
    confidence,
    secondary: [],
    confidenceLabel: confidence >= 75 ? 'High' : confidence >= 45 ? 'Medium' : 'Low',
    reasoning: messageText,
    nextSteps: [nextStep],
    whatWouldConfirm: [nextStep],
    whatWouldRuleOut: followUpQuestion ? [followUpQuestion] : [],
    missingInfo: followUpQuestion ? [followUpQuestion] : [],
    recommendedActions: [nextStep],
    estimatedRange: 'Estimate unavailable',
  };
}

function clampConfidence(value: unknown) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function logMissingFields(response: Partial<DiagnosticsCopilotResponse>) {
  const missing = [
    'messageText',
    'confidence',
    'nextStep',
    'followUpQuestion',
  ].filter((field) => response[field as keyof DiagnosticsCopilotResponse] === undefined);

  if (missing.length > 0) {
    console.log('[diagnostics/copilot] missing AI fields:', missing.join(', '));
  }

  if (response.diagnosisResult) {
    const diagnosisMissing = [
      'mostLikely',
      'confidence',
      'secondary',
      'reasoning',
      'nextSteps',
      'whatWouldConfirm',
      'whatWouldRuleOut',
      'missingInfo',
    ].filter((field) => {
      const diagnosis = response.diagnosisResult as Record<string, unknown>;
      return diagnosis[field] === undefined;
    });

    if (diagnosisMissing.length > 0) {
      console.log('[diagnostics/copilot] missing diagnosis fields:', diagnosisMissing.join(', '));
    }
  }
}
