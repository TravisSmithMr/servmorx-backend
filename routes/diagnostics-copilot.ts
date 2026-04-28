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
    '- Low confidence means ask the next best question instead of ranking a cause.',
    '- Medium confidence means give the likely path and ask a confirming question.',
    '- High confidence means give the likely cause and the next confirming check.',
    '- Ask only ONE question at a time.',
    '- For Not Cooling with unknown outdoor operation, first ask whether the outdoor unit, compressor, or condenser fan is running.',
    '- For Not Cooling with suspected refrigeration behavior, ask for one pressure/temperature reading: suction pressure, liquid/head pressure, outdoor ambient, return/supply temp, suction line temp, or liquid line temp.',
    '- For airflow-related issues, ask blower running, filter restriction, or whether weak airflow is at all vents or one area.',
  ].join('\n');
}

function buildTaskInstruction() {
  return [
    'TASK INSTRUCTION',
    'Based on this information:',
    '- decide whether there is enough confirmed evidence to name a likely cause',
    '- if evidence is insufficient, say so and ask the single next best diagnostic question',
    '- if evidence is medium confidence, describe the likely path and ask one confirming question',
    '- if evidence is high confidence, give the likely cause and the next confirming check',
    '- suggest the next best diagnostic step',
    '',
    'Do not confidently rank causes when required data is missing.',
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
    '  "nextBestQuestion": string | null,',
    '  "missingInfo": string[],',
    '  "quickPrompts": string[]',
    '}',
    'confidence must be 0-100 based only on confirmed evidence.',
    "If confidence is below 45, messageText must not name a likely failed part. It should say: Not enough confirmed data yet. Based on what we know, I'd check ___ next.",
    'quickPrompts must directly answer or capture nextBestQuestion, not generic chat suggestions.',
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
  const rawMessageText = typeof parsed.messageText === 'string' ? parsed.messageText : '';
  const nextBestCheck =
    typeof parsed.nextStep === 'string'
      ? parsed.nextStep
      : typeof parsed.nextBestCheck === 'string'
        ? parsed.nextBestCheck
        : 'Confirm the next live field measurement before ranking causes.';
  const followUpQuestion =
    typeof parsed.nextBestQuestion === 'string'
      ? parsed.nextBestQuestion
      : typeof parsed.followUpQuestion === 'string'
        ? parsed.followUpQuestion
        : null;
  const confidence = clampConfidence(parsed.confidence);
  const messageText =
    confidence < 45
      ? `Not enough confirmed data yet. Based on what we know, I'd check ${nextBestCheck} next.`
      : rawMessageText ||
        "Not enough confirmed data yet. Based on what we know, I'd check the next field measurement.";
  const missingInfo = Array.isArray(parsed.missingInfo)
    ? parsed.missingInfo.slice(0, 5).map(String)
    : followUpQuestion
      ? [followUpQuestion]
      : [];
  const quickPrompts = normalizeQuickPrompts(parsed.quickPrompts, nextBestCheck, followUpQuestion);

  return {
    provider: 'openai',
    insight: typeof parsed.insight === 'string' ? parsed.insight : messageText,
    quickPrompts,
    messageText,
    reasoningSummary: messageText,
    nextBestQuestion: followUpQuestion || '',
    followUpQuestion,
    missingInfo,
    nextBestCheck,
    nextStep: nextBestCheck,
    confidence,
    cautions: [],
    diagnosisResult: buildDiagnosisAdapter(
      parsed,
      messageText,
      nextBestCheck,
      followUpQuestion,
      missingInfo
    ),
  };
}

function normalizeQuickPrompts(
  prompts: unknown,
  nextStep: string,
  followUpQuestion: string | null
) {
  if (Array.isArray(prompts) && prompts.length > 0) {
    return prompts.slice(0, 4).map(String);
  }

  return buildQuestionChips(followUpQuestion, nextStep);
}

function buildQuestionChips(question: string | null, nextStep: string) {
  const text = `${question || ''} ${nextStep || ''}`.toLowerCase();

  if (/\b(condenser fan|fan running|fan)\b/.test(text)) {
    return ['Yes', 'No', 'Fan only', 'Not sure'];
  }

  if (/\b(outdoor unit|outdoor section)\b/.test(text)) {
    return ['Yes', 'No', 'Fan only', 'Not sure'];
  }

  if (/\bcompressor\b/.test(text)) {
    return ['Running', 'Humming', 'Off', 'Not sure'];
  }

  if (/\b(suction pressure|pressure)\b/.test(text)) {
    return ['Add suction pressure'];
  }

  if (/\b(liquid|head pressure)\b/.test(text)) {
    return ['Add liquid pressure'];
  }

  if (/\bambient|outdoor temp\b/.test(text)) {
    return ['Add outdoor ambient'];
  }

  if (/\breturn|supply\b/.test(text)) {
    return ['Add return/supply temp'];
  }

  if (/\bfilter\b/.test(text)) {
    return ['Clean', 'Dirty', 'Restrictive', 'Not sure'];
  }

  if (/\bblower\b/.test(text)) {
    return ['Blower running', 'Blower off', 'Weak', 'Not sure'];
  }

  return [nextStep].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );
}

function buildDiagnosisAdapter(
  parsed: Partial<DiagnosticsCopilotResponse>,
  messageText: string,
  nextStep: string,
  followUpQuestion: string | null,
  missingInfo: string[]
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
    missingInfo,
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
    'nextBestQuestion',
    'missingInfo',
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
