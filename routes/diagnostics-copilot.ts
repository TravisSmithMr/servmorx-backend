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

function buildCopilotPrompt(request: DiagnosticsCopilotRequest) {
  const issue = request.context?.selectedIssue ?? request.context?.issue ?? 'unknown';
  const equipment = request.context?.equipment ?? null;
  const followUpAnswers = 'followUpAnswers' in request.context ? request.context.followUpAnswers : {};
  const techNotes = 'techNotes' in request.context ? request.context.techNotes : [];
  const knownFacts = 'knownFacts' in request.context ? request.context.knownFacts : [];
  const unknowns = 'unknowns' in request.context ? request.context.unknowns : [];
  const contradictions = 'contradictions' in request.context ? request.context.contradictions : [];
  const currentStage = request.context?.currentStage ?? request.context?.stage ?? 'unknown';

  return [
    'Build the next SERVMORX TECH diagnostic response from this context.',
    'Reason from knownFacts first. Treat unknowns as missing data, not evidence.',
    "If there is not enough confirmed data, use this wording in messageText: Not enough confirmed data yet. Based on what we know, I'd check ___ next.",
    'Return strict JSON only. No markdown. No prose outside JSON.',
    'Required top-level shape:',
    '{ provider, insight, messageText, reasoningSummary, nextBestQuestion, nextBestCheck, confidence, cautions, quickPrompts, diagnosisResult }',
    'provider must be exactly "openai".',
    'confidence must be Low, Medium, or High.',
    'messageText must be 2-4 short sentences.',
    'quickPrompts must be 0-3 short field checks.',
    'cautions must list unsupported claims or safety cautions, if any.',
    'For Diagnosis or Result, include diagnosisResult. If evidence is weak, keep confidence low and missingInfo populated.',
    'diagnosisResult shape: { mostLikely: { label, confidence }, confidence, secondary: [{ label, confidence }], reasoning, nextSteps, whatWouldConfirm, whatWouldRuleOut, missingInfo, confidenceLabel, recommendedActions, estimatedRange }.',
    'recommendedActions should mirror the practical nextSteps so the existing app repair screen can display them.',
    '',
    `User message: ${request.message ?? 'Passive update only.'}`,
    `Current stage: ${currentStage}`,
    `Issue: ${issue}`,
    `Equipment: ${JSON.stringify(equipment)}`,
    `Follow-up answers: ${JSON.stringify(followUpAnswers)}`,
    `Tech notes: ${JSON.stringify(techNotes)}`,
    `Known facts: ${JSON.stringify(knownFacts)}`,
    `Unknowns: ${JSON.stringify(unknowns)}`,
    `Contradictions: ${JSON.stringify(contradictions)}`,
    '',
    'Diagnostic context JSON:',
    JSON.stringify(request.context, null, 2),
    '',
    'If analytics.symptoms exists, treat those boolean symptom fields as normalized technician observations.',
  ].join('\n');
}

export function buildDiagnosticsSystemPrompt() {
  return [
    'You are SERVMORX TECH, a senior HVAC service technician assisting another tech in the field.',
    'Do not act like customer support. Do not over-explain basic HVAC concepts.',
    'Do not guess from one symptom. Separate confirmed facts from assumptions.',
    'Prioritize live field observations, measurements, and technician notes over common failures.',
    'Never say a part is bad without naming the confirming check.',
    'When confidence is low, ask one sharp next question and give one next best field check.',
    'Every response must include nextBestCheck.',
    'Use likely path language, not absolute diagnosis language.',
    'HVAC reasoning rules:',
    '- No cooling plus fan only does not automatically mean bad compressor.',
    '- Fan running with compressor off should first separate capacitor, compressor overload, contactor/output, and safety/control path.',
    '- Low charge should not be suggested strongly without pressure/temp evidence or icing behavior.',
    '- Airflow issues should be considered before charge when airflow symptoms exist.',
    '- Electrical/control issues should be checked before condemning major components.',
    '- Check capacitor MFD before condemning compressor when start/run behavior points electrical.',
    '- Verify 24V at the contactor coil before assuming an outdoor unit component has failed.',
    '- Confirm compressor amp draw before leaning into compressor mechanical failure.',
    'Return valid JSON only.',
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
    console.log('[diagnostics/copilot] AI context:', JSON.stringify(request.context));
    const rawText = await createServerTextResponse(buildCopilotPrompt(request));
    const parsed = extractJsonObject(rawText);
    console.log('[diagnostics/copilot] AI response JSON:', JSON.stringify(parsed));
    logMissingFields(parsed);
    console.log('[diagnostics/copilot] OpenAI response success');

    return {
      ...parsed,
      provider: 'openai',
      insight: typeof parsed.insight === 'string' ? parsed.insight : '',
      quickPrompts: Array.isArray(parsed.quickPrompts) ? parsed.quickPrompts : [],
      messageText:
        typeof parsed.messageText === 'string'
          ? parsed.messageText
          : "Not enough confirmed data yet. Based on what we know, I'd check the next field measurement.",
      reasoningSummary:
        typeof parsed.reasoningSummary === 'string' ? parsed.reasoningSummary : '',
      nextBestQuestion:
        typeof parsed.nextBestQuestion === 'string' ? parsed.nextBestQuestion : '',
      nextBestCheck:
        typeof parsed.nextBestCheck === 'string'
          ? parsed.nextBestCheck
          : 'Confirm the next live field measurement before ranking causes.',
      confidence: normalizeConfidenceLabel(parsed.confidence),
      cautions: Array.isArray(parsed.cautions) ? parsed.cautions.map(String).slice(0, 3) : [],
      diagnosisResult: normalizeDiagnosisResult(parsed.diagnosisResult),
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

function normalizeConfidenceLabel(value: unknown) {
  return value === 'High' || value === 'Medium' || value === 'Low' ? value : 'Low';
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
    'reasoningSummary',
    'nextBestQuestion',
    'nextBestCheck',
    'confidence',
    'cautions',
    'quickPrompts',
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
