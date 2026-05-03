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
    'You are a senior HVAC service technician guiding another tech in the field.',
    'Think from confirmed field observations first, not from a generic checklist.',
    'Known facts override unknowns.',
    'Unknowns are only useful when they separate the remaining likely diagnostic paths.',
    'You do not guess without evidence, and you do not condemn major parts without confirmation.',
  ].join('\n');
}

function buildContextBlock(context: DiagnosticsCopilotRequest['context']) {
  const issue = context?.selectedIssue ?? context?.issue ?? 'unknown';
  const equipment = context?.equipment ?? null;
  const job = 'job' in context ? context.job : {};
  const followUpAnswers = 'followUpAnswers' in context ? context.followUpAnswers : {};
  const techNotes = 'techNotes' in context ? context.techNotes : [];
  const knownFacts = 'knownFacts' in context ? context.knownFacts : [];
  const unknowns = 'unknowns' in context ? context.unknowns : [];
  const currentStage = context?.currentStage ?? context?.stage ?? 'unknown';
  const previousQuestionsAsked =
    'previousQuestionsAsked' in context ? context.previousQuestionsAsked : [];
  const askedQuestions = 'askedQuestions' in context ? context.askedQuestions : [];
  const answeredQuestions = 'answeredQuestions' in context ? context.answeredQuestions : {};
  const candidateQuestions = 'candidateQuestions' in context ? context.candidateQuestions : [];
  const currentQuestionId = 'currentQuestionId' in context ? context.currentQuestionId : null;
  const measurementValues = 'measurementValues' in context ? context.measurementValues : {};
  const measurements = 'measurements' in context ? context.measurements : {};
  const currentConfidence =
    'currentConfidence' in context ? context.currentConfidence : null;
  const likelyPath = 'likelyPath' in context ? context.likelyPath : 'unknown';
  const latestMessage = 'latestTechnicianMessage' in context ? context.latestTechnicianMessage : 'none';
  const diagnosticStage = context?.diagnosticStage ?? 'initial';

  return [
    'CONTEXT',
    `UI screen: ${currentStage}`,
    `Diagnostic stage: ${diagnosticStage}`,
    `Issue: ${issue}`,
    `Equipment: ${JSON.stringify(equipment)}`,
    `Job placeholders: ${JSON.stringify(job)}`,
    `Follow-up answers: ${JSON.stringify(followUpAnswers)}`,
    `Tech notes: ${JSON.stringify(techNotes)}`,
    `Current confidence: ${JSON.stringify(currentConfidence)}`,
    `Current likely path: ${JSON.stringify(likelyPath)}`,
    `Known facts: ${JSON.stringify(knownFacts)}`,
    `Unknowns: ${JSON.stringify(unknowns)}`,
    `Previous questions asked: ${JSON.stringify(previousQuestionsAsked)}`,
    `Asked question ids: ${JSON.stringify(askedQuestions)}`,
    `Answered questions: ${JSON.stringify(answeredQuestions)}`,
    `Candidate questions for this stage: ${JSON.stringify(candidateQuestions)}`,
    `Current question id: ${JSON.stringify(currentQuestionId)}`,
    `Measurement values: ${JSON.stringify(measurementValues)}`,
    `Measurements: ${JSON.stringify(measurements)}`,
    `Latest technician message: ${latestMessage}`,
  ].join('\n');
}

function buildDiagnosticRules() {
  return [
    'DIAGNOSTIC RULES',
    '- This is adaptive field reasoning, not a decision tree and not a generic chatbot.',
    '- Maintain 2-4 live hypotheses, eliminate hypotheses contradicted by known facts, then ask the one question that best separates what remains.',
    '- Apply this hierarchy in order: 1. system operation state, 2. electrical/control path, 3. airflow only when the system is operating, 4. refrigeration only when the compressor is running, 5. diagnosis, 6. repair recommendation.',
    '- Known facts, follow-up answers, tech notes, and measurements are stronger than unknowns or candidate question ordering.',
    '- Candidate questions are suggestions, not commands. Prefer a candidate only when it fits the best diagnostic separator. If the best field question is not in the candidates, still return the best nextQuestionId and question.',
    '- Never repeat currentQuestionId, Previous questions asked, Asked question ids, or Answered questions unless the technician explicitly says the value changed.',
    '- Ask only ONE question at a time unless answerType is groupedMeasurementSet for tightly related measurements.',
    '- Do not assume refrigerant issues without pressure/temperature evidence and a running compressor.',
    '- Do not ask airflow questions until operation state and electrical/control path allow airflow to matter.',
    '- Do not ask refrigerant pressure, suggest charge, or suggest a frozen coil when the compressor is not running or compressor amps are 0.',
    '- HARD RULE - FAN ONLY / COMPRESSOR OFF: If condenser fan is running and compressor is not running or compressor amps are 0, stay on the compressor electrical path. Ask capacitor_check or compressor_voltage next unless already answered; then ask overload, wiring, contactor/load-side voltage, or compressor terminal checks.',
    '- In fan-only/compressor-off cases, likelyPath must be compressor electrical/control path and nextQuestionId must be capacitor_check or compressor_voltage unless both are already answered.',
    '- SHORT CYCLING: Do not diagnose from runtime alone. First separate what shuts off, what keeps running, whether the contactor drops out or stays pulled in, amp behavior, and safeties.',
    '- For Not Cooling with unknown outdoor operation, first separate indoor blower, outdoor unit, compressor, and condenser fan operation.',
    '- If refrigeration path is actually plausible, ask for suction pressure, then head/liquid pressure, then outdoor ambient, then superheat or subcooling if available.',
    '- Prefer superheat and subcooling over raw suction/liquid line temperature unless the app is calculating SH/SC.',
    '- If only one pressure value is known, do not diagnose low refrigerant confidently.',
  ].join('\n');
}

function buildTaskInstruction() {
  return [
    'TASK INSTRUCTION',
    'Based on this information:',
    '- summarize the known facts that control the path',
    '- keep 2-4 possible hypotheses in mind, but do not list more than 2 in messageText',
    '- eliminate generic branches contradicted by confirmed operation state',
    '- choose the single most useful next diagnostic question, meaning the question that best separates remaining possibilities',
    '- set missingInfo to only the information needed for the active path, not every unknown',
    '- use nextQuestionId from Candidate questions when it fits; otherwise use the field-accurate id required by the evidence',
    '- suggest a stage only if the current stage has enough evidence or no useful checks remain',
    '',
    'Confidence rules:',
    '- 0-35%: ask a broad separator and do not name a likely failed part.',
    '- 36-65%: state the likely path and ask a confirming question.',
    '- 66-85%: state a strong path and ask the final confirmation.',
    '- 86-100%: use only with direct proof.',
    'Keep responses short: 2-4 sentences, no filler, no generic chatbot language, and sound like a field technician.',
  ].join('\n');
}

function buildOutputFormat() {
  return [
    'OUTPUT FORMAT',
    'Return structured JSON only:',
    '{',
    '  "messageText": string,',
    '  "reasoningSummary": string,',
    '  "confidence": number,',
    '  "likelyPath": string,',
    '  "nextBestQuestion": string | null,',
    '  "nextQuestionId": "indoor_blower_status" | "outdoor_unit_status" | "compressor_status" | "condenser_fan_status" | "capacitor_check" | "compressor_voltage" | "compressor_overload" | "compressor_wiring" | "contactor_state" | "compressor_amps" | "suction_pressure" | "head_pressure" | "outdoor_ambient" | "superheat" | "subcooling" | "coil_frozen" | "airflow_status" | "filter_status" | "vent_distribution" | "freeze_location" | "run_time" | "safety_status" | "other_detail" | null,',
    '  "answerOptions": string[],',
    '  "missingInfo": string[],',
    '  "stopAndDiagnose": boolean',
    '}',
    'You may also include legacy fields interpretation, nextQuestion, suggestedStage, and answerType for compatibility, but do not omit the fields above.',
    'confidence must be 0-100 based only on confirmed evidence.',
    'suggestedStage must be the current stage unless enough evidence supports moving forward.',
    'If confidence is below 36, messageText must not name a likely failed part.',
    'nextBestQuestion must match nextQuestionId and answerOptions must directly answer nextBestQuestion. Use [] for freeText or numeric unless short choices are useful.',
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
    const normalized = normalizeCopilotResponse(parsed, context);

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

function normalizeCopilotResponse(
  parsed: Partial<DiagnosticsCopilotResponse>,
  context: DiagnosticsCopilotRequest['context']
) {
  const rawMessageText = typeof parsed.messageText === 'string' ? parsed.messageText : '';
  const nextQuestion =
    typeof parsed.nextQuestion === 'string'
      ? parsed.nextQuestion
      : typeof parsed.nextBestQuestion === 'string'
        ? parsed.nextBestQuestion
        : typeof parsed.followUpQuestion === 'string'
          ? parsed.followUpQuestion
          : null;
  const nextQuestionId = normalizeQuestionId(parsed.nextQuestionId);
  const candidateQuestion = findCandidateQuestion(context, nextQuestionId);
  const nextBestCheck =
    typeof parsed.nextStep === 'string'
      ? parsed.nextStep
      : typeof parsed.nextBestCheck === 'string'
        ? parsed.nextBestCheck
        : nextQuestion
          ? nextQuestion
          : 'Confirm the next live field measurement before ranking causes.';
  const followUpQuestion = nextQuestion;
  const confidence = clampConfidence(parsed.confidence);
  const messageText =
    confidence < 36
      ? `Not enough confirmed data yet. Based on what we know, I'd check ${nextBestCheck} next.`
      : rawMessageText ||
        "Not enough confirmed data yet. Based on what we know, I'd check the next field measurement.";
  const missingInfo = Array.isArray(parsed.missingInfo)
    ? parsed.missingInfo.slice(0, 5).map(String)
    : followUpQuestion
      ? [followUpQuestion]
      : [];
  const answerOptions = Array.isArray(parsed.answerOptions)
    ? parsed.answerOptions.slice(0, 6).map(String)
    : Array.isArray(candidateQuestion?.answerOptions)
      ? candidateQuestion.answerOptions.slice(0, 6).map(String)
      : [];
  const answerType = normalizeAnswerType(parsed.answerType || candidateQuestion?.answerType);
  const interpretation =
    typeof parsed.interpretation === 'string' ? parsed.interpretation : messageText;
  const reasoningSummary =
    typeof parsed.reasoningSummary === 'string' ? parsed.reasoningSummary : interpretation;
  const suggestedStage = normalizeDiagnosticStage(parsed.suggestedStage);

  const normalized = {
    provider: 'openai',
    insight: typeof parsed.insight === 'string' ? parsed.insight : messageText,
    quickPrompts: answerOptions,
    messageText,
    interpretation,
    reasoningSummary,
    nextQuestion: followUpQuestion || '',
    nextBestQuestion: followUpQuestion || '',
    nextQuestionId,
    followUpQuestion,
    likelyPath: typeof parsed.likelyPath === 'string' ? parsed.likelyPath : '',
    answerType,
    answerOptions,
    missingInfo,
    nextBestCheck,
    nextStep: nextBestCheck,
    confidence,
    suggestedStage,
    cautions: [],
    stopAndDiagnose: parsed.stopAndDiagnose === true,
    diagnosisResult: buildDiagnosisAdapter(
      parsed,
      messageText,
      nextBestCheck,
      followUpQuestion,
      missingInfo
    ),
  };

  return applyHardDiagnosticGuards(normalized, context);
}

function applyHardDiagnosticGuards(
  response: DiagnosticsCopilotResponse,
  context: DiagnosticsCopilotRequest['context']
) {
  if (!isFanOnlyCompressorOff(context)) {
    return response;
  }

  const nextQuestionId =
    chooseUnaskedQuestionId(context, [
      'capacitor_check',
      'compressor_voltage',
      'compressor_overload',
      'compressor_wiring',
    ]) || 'compressor_voltage';
  const nextBestQuestion = getElectricalQuestionText(nextQuestionId);
  const answerOptions = getElectricalAnswerOptions(nextQuestionId);
  const confidence = response.confidence && response.confidence > 0
    ? Math.min(response.confidence, 65)
    : 55;
  const messageText = [
    'Condenser fan is running and the compressor is off or at 0 amps, so this stays on the compressor electrical path.',
    `Two paths are still live: start circuit/capacitor vs voltage, overload, or wiring. ${nextBestQuestion}`,
  ].join(' ');

  return {
    ...response,
    insight: messageText,
    quickPrompts: answerOptions,
    messageText,
    interpretation: messageText,
    reasoningSummary:
      'Known outdoor fan operation with compressor off or 0 amps eliminates airflow and refrigeration checks for now; the next separator is in the compressor electrical/start circuit.',
    nextQuestion: nextBestQuestion,
    nextBestQuestion,
    nextQuestionId,
    followUpQuestion: nextBestQuestion,
    likelyPath: 'compressor electrical/control path',
    answerType: 'singleChoice' as const,
    answerOptions,
    missingInfo: ['capacitor condition', 'compressor terminal voltage', 'overload/wiring status'],
    nextBestCheck: nextBestQuestion,
    nextStep: nextBestQuestion,
    confidence,
    suggestedStage: 'electrical_check',
    stopAndDiagnose: false,
  };
}

function isFanOnlyCompressorOff(context: DiagnosticsCopilotRequest['context']) {
  const signals = JSON.stringify({
    followUpAnswers: context.followUpAnswers || {},
    answeredQuestions: context.answeredQuestions || {},
    knownFacts: context.knownFacts || [],
    measurements: context.measurements || {},
    measurementValues: context.measurementValues || {},
    techNotes: context.techNotes || [],
  }).toLowerCase();
  const fanRunning =
    /(?:condenser|outdoor)[^{}\[\],.;]{0,50}fan[^{}\[\],.;]{0,50}(?:running|runs|on|operating)/.test(signals) ||
    /fan[^{}\[\],.;]{0,50}(?:running|runs|on|operating)[^{}\[\],.;]{0,50}(?:condenser|outdoor)/.test(signals);
  const compressorOff =
    /compressor[^{}\[\],.;]{0,60}(?:not running|not_running|off|stopped|not on|0 amps|zero amps|0a)/.test(signals) ||
    /compressor[^{}\[\],.;]{0,40}amps[^0-9-]{0,20}0(?:\.0+)?\b/.test(signals);

  return fanRunning && compressorOff;
}

function chooseUnaskedQuestionId(
  context: DiagnosticsCopilotRequest['context'],
  ids: string[]
) {
  const asked = new Set(
    [
      context.currentQuestionId,
      ...(Array.isArray(context.askedQuestions) ? context.askedQuestions : []),
      ...(Array.isArray(context.previousQuestionsAsked) ? context.previousQuestionsAsked : []),
      ...Object.keys(context.answeredQuestions || {}),
    ].filter(Boolean)
  );

  return ids.find((id) => !asked.has(id));
}

function getElectricalQuestionText(questionId: string) {
  if (questionId === 'capacitor_check') {
    return 'Has the run capacitor been tested against its rated microfarads?';
  }

  if (questionId === 'compressor_overload') {
    return 'Is the compressor overload open or is the compressor body too hot to reset?';
  }

  if (questionId === 'compressor_wiring') {
    return 'Are the compressor terminal wires and plugs tight with no burned or open connection?';
  }

  return 'Do you have proper voltage at the compressor terminals while the contactor is pulled in?';
}

function getElectricalAnswerOptions(questionId: string) {
  if (questionId === 'capacitor_check') {
    return ['Within rating', 'Weak/open', 'Not checked yet'];
  }

  if (questionId === 'compressor_overload') {
    return ['Overload closed', 'Overload open/hot', 'Not checked yet'];
  }

  if (questionId === 'compressor_wiring') {
    return ['Connections good', 'Loose/burned/open', 'Not checked yet'];
  }

  return ['Rated voltage present', 'No/low voltage', 'Not checked yet'];
}

function normalizeQuestionId(value: unknown) {
  const knownIds = [
    'indoor_blower_status',
    'outdoor_unit_status',
    'compressor_status',
    'condenser_fan_status',
    'capacitor_check',
    'compressor_voltage',
    'compressor_overload',
    'compressor_wiring',
    'contactor_state',
    'compressor_amps',
    'suction_pressure',
    'head_pressure',
    'outdoor_ambient',
    'superheat',
    'subcooling',
    'coil_frozen',
    'airflow_status',
    'filter_status',
    'vent_distribution',
    'freeze_location',
    'run_time',
    'safety_status',
    'other_detail',
  ];

  return knownIds.includes(value as string) ? (value as string) : undefined;
}

function normalizeAnswerType(value: unknown) {
  if (
    value === 'singleChoice' ||
    value === 'yesNo' ||
    value === 'numeric' ||
    value === 'freeText' ||
    value === 'groupedMeasurementSet'
  ) {
    return value;
  }

  return 'freeText';
}

function normalizeDiagnosticStage(value: unknown) {
  const knownStages = [
    'initial',
    'operation_check',
    'airflow_check',
    'electrical_check',
    'refrigeration_check',
    'verification',
    'diagnosis',
  ];

  return knownStages.includes(value as string) ? (value as string) : undefined;
}

function findCandidateQuestion(
  context: DiagnosticsCopilotRequest['context'],
  questionId: string | undefined
) {
  if (!questionId || !Array.isArray(context?.candidateQuestions)) {
    return undefined;
  }

  return context.candidateQuestions.find((question) => question.questionId === questionId);
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
    'reasoningSummary',
    'confidence',
    'nextQuestionId',
    'likelyPath',
    'nextBestQuestion',
    'answerOptions',
    'missingInfo',
    'stopAndDiagnose',
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
