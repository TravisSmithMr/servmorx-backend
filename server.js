const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    message: "SERVMORX backend is running"
  });
});

app.post("/ocr/extract-text", async (req, res) => {
  const hasKey = Boolean(process.env.OPENAI_API_KEY);

  res.json({
    provider: hasKey ? "backend-openai" : "missing-openai-key",
    providerPath: "backend",
    providerStatus: hasKey ? "configured" : "not_configured",
    text: "",
    usedFallback: !hasKey
  });
});

app.post("/diagnostics/copilot", async (req, res) => {
  const payload = req.body || {};
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  console.log("[diagnostics/copilot] route hit");
  console.log("[diagnostics/copilot] request body:", JSON.stringify(payload));
  console.log(`[diagnostics/copilot] OPENAI_API_KEY exists: ${hasOpenAIKey}`);

  try {
    const response = await createCopilotAiResponse(payload);
    console.log("[diagnostics/copilot] OpenAI response success");
    res.json(response);
  } catch (error) {
    console.error("[diagnostics/copilot] OpenAI response failure:", error);
    res.status(500).json({
      provider: "backend",
      error: true,
      insight: "",
      quickPrompts: [],
      messageText: "AI request failed"
    });
  }
});

app.post("/diagnostics/analyze-system", async (req, res) => {
  res.json({
    analytics: {
      status: "connected",
      notes: ["Analyze-system endpoint is live."]
    }
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on http://0.0.0.0:${PORT}`);
});

async function createCopilotAiResponse(payload) {
  const context = {
    ...(payload.context || {}),
    latestTechnicianMessage: payload.message || null
  };
  console.log("[diagnostics/copilot] AI context:", JSON.stringify(context));
  const rawJson = await createServerJsonResponse(buildCopilotPrompt(context));
  console.log("[diagnostics/copilot] AI response JSON:", JSON.stringify(rawJson));
  logMissingFields(rawJson);
  return normalizeCopilotResponse(rawJson);
}

async function createServerJsonResponse(prompt) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    signal: controller.signal,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a senior HVAC service technician. You diagnose systems based on real field observations. You do not guess without evidence. You prioritize confirming tests before conclusions. Return valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("OpenAI returned an empty copilot response.");
  }

  return JSON.parse(content);
}

function buildCopilotPrompt(context) {
  return [
    buildSystemRole(),
    buildContextBlock(context),
    buildDiagnosticRules(),
    buildTaskInstruction(),
    buildOutputFormat()
  ].join("\n\n");
}

function buildSystemRole() {
  return [
    "SYSTEM ROLE",
    "You are a senior HVAC service technician.",
    "You diagnose systems based on real field observations.",
    "You do not guess without evidence.",
    "You prioritize confirming tests before conclusions."
  ].join("\n");
}

function buildContextBlock(context) {
  const issue = context?.selectedIssue || context?.issue || "unknown";
  const equipment = context?.equipment || null;
  const followUpAnswers = context?.followUpAnswers || {};
  const techNotes = Array.isArray(context?.techNotes) ? context.techNotes : [];
  const knownFacts = Array.isArray(context?.knownFacts) ? context.knownFacts : [];
  const unknowns = Array.isArray(context?.unknowns) ? context.unknowns : [];
  const previousQuestionsAsked = Array.isArray(context?.previousQuestionsAsked)
    ? context.previousQuestionsAsked
    : [];
  const askedQuestions = Array.isArray(context?.askedQuestions) ? context.askedQuestions : [];
  const answeredQuestions = context?.answeredQuestions || {};
  const currentQuestionId = context?.currentQuestionId || null;
  const measurementValues = context?.measurementValues || {};
  const currentConfidence =
    typeof context?.currentConfidence === "number" ? context.currentConfidence : null;
  const likelyPath = context?.likelyPath || "unknown";
  const currentStage = context?.currentStage || context?.stage || "unknown";
  const latestMessage = context?.latestTechnicianMessage || "none";

  return [
    "CONTEXT",
    `Current stage: ${currentStage}`,
    `Issue: ${issue}`,
    `Equipment: ${JSON.stringify(equipment)}`,
    `Follow-up answers: ${JSON.stringify(followUpAnswers)}`,
    `Tech notes: ${JSON.stringify(techNotes)}`,
    `Current confidence: ${JSON.stringify(currentConfidence)}`,
    `Current likely path: ${JSON.stringify(likelyPath)}`,
    `Known facts: ${JSON.stringify(knownFacts)}`,
    `Unknowns: ${JSON.stringify(unknowns)}`,
    `Previous questions asked: ${JSON.stringify(previousQuestionsAsked)}`,
    `Asked question ids: ${JSON.stringify(askedQuestions)}`,
    `Answered questions: ${JSON.stringify(answeredQuestions)}`,
    `Current question id: ${JSON.stringify(currentQuestionId)}`,
    `Measurement values: ${JSON.stringify(measurementValues)}`,
    `Latest technician message: ${latestMessage}`
  ].join("\n");
}

function buildDiagnosticRules() {
  return [
    "DIAGNOSTIC RULES",
    "- Do not assume refrigerant issues without pressure/temperature evidence.",
    "- Separate airflow vs electrical vs refrigeration first.",
    "- No cooling + fan only does not automatically mean bad compressor.",
    "- Always suggest the next best test.",
    "- Never condemn major components without confirmation.",
    "- Low confidence means ask the next best question instead of ranking a cause.",
    "- Medium confidence means give the likely path and ask a confirming question.",
    "- High confidence means give the likely cause and the next confirming check.",
    "- Ask only ONE question at a time.",
    "- For Not Cooling with unknown outdoor operation, first ask whether the outdoor unit, compressor, or condenser fan is running.",
    "- Not Cooling sequence: first separate indoor blower, outdoor unit, compressor, and condenser fan operation.",
    "- If refrigeration path is plausible, ask for suction pressure, then head/liquid pressure, then outdoor ambient, then superheat or subcooling if available, then coil frozen/airflow condition.",
    "- Prefer superheat and subcooling over raw suction/liquid line temperature unless the app is calculating SH/SC.",
    "- If suction_pressure is already answered, acknowledge it and move to head_pressure or outdoor_ambient. Do not ask suction_pressure again.",
    "- If only one pressure value is known, do not diagnose low refrigerant confidently.",
    "- For airflow-related issues, ask blower running, filter restriction, or whether weak airflow is at all vents or one area.",
    "- Do not ask questions already listed in Previous questions asked.",
    "- Do not ask question ids already present in Answered questions or Asked question ids unless the user says the value changed.",
    "- If answerType is groupedMeasurementSet, it may request a small set of related measurements; otherwise ask one question only."
  ].join("\n");
}

function buildTaskInstruction() {
  return [
    "TASK INSTRUCTION",
    "Based on this information:",
    "- choose the single most useful next diagnostic question from the actual context",
    "- decide whether there is enough confirmed evidence to name a likely cause",
    "- if evidence is insufficient, say so and ask the single next best diagnostic question",
    "- if evidence is medium confidence, describe the likely path and ask one confirming question",
    "- if evidence is high confidence, give the likely cause and the next confirming check",
    "- suggest the next best diagnostic step",
    "",
    "Do not confidently rank causes when required data is missing.",
    "Keep responses short: 2-4 sentences, no filler, no generic chatbot language, and sound like a field technician."
  ].join("\n");
}

function buildOutputFormat() {
  return [
    "OUTPUT FORMAT",
    "Return structured JSON only:",
    "{",
    '  "messageText": string,',
    '  "confidence": number,',
    '  "likelyPath": string,',
    '  "nextBestQuestion": string | null,',
    '  "nextQuestionId": "indoor_blower_status" | "outdoor_unit_status" | "compressor_status" | "condenser_fan_status" | "suction_pressure" | "head_pressure" | "outdoor_ambient" | "superheat" | "subcooling" | "coil_frozen" | "airflow_status" | "filter_status" | "vent_distribution" | "freeze_location" | "run_time" | "other_detail" | null,',
    '  "answerType": "singleChoice" | "yesNo" | "numeric" | "freeText" | "groupedMeasurementSet",',
    '  "answerOptions": string[],',
    '  "missingInfo": string[],',
    '  "stopAndDiagnose": boolean',
    "}",
    "confidence must be 0-100 based only on confirmed evidence.",
    "If confidence is below 45, messageText must not name a likely failed part. It should say: Not enough confirmed data yet. Based on what we know, I'd check ___ next.",
    "answerOptions must directly answer nextBestQuestion. Use [] for freeText or numeric unless short choices are useful."
  ].join("\n");
}

function normalizeCopilotResponse(parsed) {
  const rawMessageText =
    typeof parsed.messageText === "string" ? parsed.messageText : "";
  const nextBestCheck =
    typeof parsed.nextStep === "string"
      ? parsed.nextStep
      : typeof parsed.nextBestCheck === "string"
        ? parsed.nextBestCheck
        : typeof parsed.nextBestQuestion === "string"
          ? parsed.nextBestQuestion
          : "Confirm the next live field measurement before ranking causes.";
  const followUpQuestion =
    typeof parsed.nextBestQuestion === "string"
      ? parsed.nextBestQuestion
      : typeof parsed.followUpQuestion === "string"
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
  const answerOptions = Array.isArray(parsed.answerOptions)
    ? parsed.answerOptions.slice(0, 6).map(String)
    : [];

  return {
    provider: "openai",
    insight: typeof parsed.insight === "string" ? parsed.insight : messageText,
    quickPrompts: answerOptions,
    messageText,
    reasoningSummary: messageText,
    nextBestQuestion: followUpQuestion || "",
    nextQuestionId: normalizeQuestionId(parsed.nextQuestionId),
    followUpQuestion,
    likelyPath: typeof parsed.likelyPath === "string" ? parsed.likelyPath : "",
    answerType: normalizeAnswerType(parsed.answerType),
    answerOptions,
    missingInfo,
    nextBestCheck,
    nextStep: nextBestCheck,
    confidence,
    cautions: [],
    stopAndDiagnose: parsed.stopAndDiagnose === true,
    diagnosisResult: buildDiagnosisAdapter(
      parsed,
      messageText,
      nextBestCheck,
      followUpQuestion,
      missingInfo
    )
  };
}

function normalizeQuestionId(value) {
  const knownIds = [
    "indoor_blower_status",
    "outdoor_unit_status",
    "compressor_status",
    "condenser_fan_status",
    "suction_pressure",
    "head_pressure",
    "outdoor_ambient",
    "superheat",
    "subcooling",
    "coil_frozen",
    "airflow_status",
    "filter_status",
    "vent_distribution",
    "freeze_location",
    "run_time",
    "other_detail"
  ];

  return knownIds.includes(value) ? value : undefined;
}

function normalizeAnswerType(value) {
  if (
    value === "singleChoice" ||
    value === "yesNo" ||
    value === "numeric" ||
    value === "freeText" ||
    value === "groupedMeasurementSet"
  ) {
    return value;
  }

  return "freeText";
}

function buildDiagnosisAdapter(parsed, messageText, nextStep, followUpQuestion, missingInfo) {
  if (parsed.diagnosisResult) {
    return normalizeDiagnosisResult(parsed.diagnosisResult);
  }

  const confidence = clampConfidence(parsed.confidence);

  return {
    mostLikely: {
      label: "Diagnostic path needs confirmation",
      confidence
    },
    confidence,
    secondary: [],
    confidenceLabel: confidence >= 75 ? "High" : confidence >= 45 ? "Medium" : "Low",
    reasoning: messageText,
    nextSteps: [nextStep],
    whatWouldConfirm: [nextStep],
    whatWouldRuleOut: followUpQuestion ? [followUpQuestion] : [],
    missingInfo,
    recommendedActions: [nextStep],
    estimatedRange: "Estimate unavailable"
  };
}

function normalizeDiagnosisResult(value) {
  if (!value || typeof value !== "object" || !value.mostLikely) {
    return undefined;
  }

  return {
    mostLikely: {
      label: String(value.mostLikely.label || "AI diagnosis"),
      confidence: clampConfidence(value.mostLikely.confidence)
    },
    confidence: clampConfidence(value.confidence ?? value.mostLikely.confidence),
    secondary: Array.isArray(value.secondary)
      ? value.secondary.slice(0, 3).map((cause) => ({
          label: String(cause.label || "Secondary cause"),
          confidence: clampConfidence(cause.confidence)
        }))
      : [],
    confidenceLabel:
      value.confidenceLabel === "High" ||
      value.confidenceLabel === "Medium" ||
      value.confidenceLabel === "Low"
        ? value.confidenceLabel
        : "Medium",
    reasoning: typeof value.reasoning === "string" ? value.reasoning : "",
    nextSteps: Array.isArray(value.nextSteps) ? value.nextSteps.slice(0, 4).map(String) : [],
    whatWouldConfirm: Array.isArray(value.whatWouldConfirm)
      ? value.whatWouldConfirm.slice(0, 4).map(String)
      : [],
    whatWouldRuleOut: Array.isArray(value.whatWouldRuleOut)
      ? value.whatWouldRuleOut.slice(0, 4).map(String)
      : [],
    missingInfo: Array.isArray(value.missingInfo)
      ? value.missingInfo.slice(0, 4).map(String)
      : [],
    recommendedActions: Array.isArray(value.recommendedActions)
      ? value.recommendedActions.slice(0, 4).map(String)
      : Array.isArray(value.nextSteps)
        ? value.nextSteps.slice(0, 4).map(String)
        : [],
    estimatedRange:
      typeof value.estimatedRange === "string" ? value.estimatedRange : "Estimate unavailable"
  };
}

function clampConfidence(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function logMissingFields(response) {
  const missing = [
    "messageText",
    "confidence",
    "nextBestQuestion",
    "nextQuestionId",
    "answerType",
    "answerOptions",
    "missingInfo",
    "stopAndDiagnose"
  ].filter((field) => response[field] === undefined);

  if (missing.length > 0) {
    console.log("[diagnostics/copilot] missing AI fields:", missing.join(", "));
  }

  if (response.diagnosisResult) {
    const diagnosisMissing = [
      "mostLikely",
      "confidence",
      "secondary",
      "reasoning",
      "nextSteps",
      "whatWouldConfirm",
      "whatWouldRuleOut",
      "missingInfo"
    ].filter((field) => response.diagnosisResult[field] === undefined);

    if (diagnosisMissing.length > 0) {
      console.log("[diagnostics/copilot] missing diagnosis fields:", diagnosisMissing.join(", "));
    }
  }
}
