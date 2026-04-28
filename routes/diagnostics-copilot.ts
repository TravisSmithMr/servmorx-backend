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
    `Latest technician message: ${latestMessage}`,
  ].join('\n');
}

function buildDiagnosticRules() {
  return [
    'DIAGNOSTIC RULES',
    '- This is a diagnostic state machine, not a chatbot.',
    '- The app controls stage progression. You interpret evidence and choose/prioritize one candidate question inside the current diagnostic stage.',
    '- Prefer nextQuestionId from Candidate questions for this stage. If none fit, return null and suggest the next stage.',
    '- Never repeat a question id already present in Answered questions or Asked question ids.',
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
    '- Not Cooling sequence: first separate indoor blower, outdoor unit, compressor, and condenser fan operation.',
    '- If refrigeration path is plausible, ask for suction pressure, then head/liquid pressure, then outdoor ambient, then superheat or subcooling if available, then coil frozen/airflow condition.',
    '- Prefer superheat and subcooling over raw suction/liquid line temperature unless the app is calculating SH/SC.',
    '- If suction_pressure is already answered, acknowledge it and move to head_pressure or outdoor_ambient. Do not ask suction_pressure again.',
    '- If only one pressure value is known, do not diagnose low refrigerant confidently.',
    '- For airflow-related issues, ask blower running, filter restriction, or whether weak airflow is at all vents or one area.',
    '- Do not ask questions already listed in Previous questions asked.',
    '- Do not ask question ids already present in Answered questions or Asked question ids unless the user says the value changed.',
    '- If answerType is groupedMeasurementSet, it may request a small set of related measurements; otherwise ask one question only.',
  ].join('\n');
}

function buildTaskInstruction() {
  return [
    'TASK INSTRUCTION',
    'Based on this information:',
    '- interpret the latest answer against the current diagnostic stage',
    '- choose the single most useful next diagnostic question from Candidate questions for this stage',
    '- suggest a stage only if the current stage has enough evidence or no useful candidates remain',
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
    '  "interpretation": string,',
    '  "nextQuestionId": "indoor_blower_status" | "outdoor_unit_status" | "compressor_status" | "condenser_fan_status" | "suction_pressure" | "head_pressure" | "outdoor_ambient" | "superheat" | "subcooling" | "coil_frozen" | "airflow_status" | "filter_status" | "vent_distribution" | "freeze_location" | "run_time" | "other_detail" | null,',
    '  "nextQuestion": string | null,',
    '  "confidence": number,',
    '  "suggestedStage": "initial" | "operation_check" | "airflow_check" | "electrical_check" | "refrigeration_check" | "verification" | "diagnosis",',
    '  "likelyPath": string,',
    '  "nextBestQuestion": string | null,',
    '  "answerType": "singleChoice" | "yesNo" | "numeric" | "freeText" | "groupedMeasurementSet",',
    '  "answerOptions": string[],',
    '  "missingInfo": string[],',
    '  "stopAndDiagnose": boolean',
    '}',
    'confidence must be 0-100 based only on confirmed evidence.',
    'suggestedStage must be the current stage unless enough evidence supports moving forward.',
    "If confidence is below 45, messageText must not name a likely failed part. It should say: Not enough confirmed data yet. Based on what we know, I'd check ___ next.",
    'nextQuestion must match nextQuestionId and answerOptions must directly answer nextQuestion. Use [] for freeText or numeric unless short choices are useful.',
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
    confidence < 45
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
  const suggestedStage = normalizeDiagnosticStage(parsed.suggestedStage);

  return {
    provider: 'openai',
    insight: typeof parsed.insight === 'string' ? parsed.insight : messageText,
    quickPrompts: answerOptions,
    messageText,
    interpretation,
    reasoningSummary: interpretation,
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
}

function normalizeQuestionId(value: unknown) {
  const knownIds = [
    'indoor_blower_status',
    'outdoor_unit_status',
    'compressor_status',
    'condenser_fan_status',
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
    'interpretation',
    'confidence',
    'nextQuestionId',
    'nextQuestion',
    'suggestedStage',
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
