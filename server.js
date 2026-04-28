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
  const currentStage = context?.currentStage || context?.stage || "unknown";
  const latestMessage = context?.latestTechnicianMessage || "none";

  return [
    "CONTEXT",
    `Current stage: ${currentStage}`,
    `Issue: ${issue}`,
    `Equipment: ${JSON.stringify(equipment)}`,
    `Follow-up answers: ${JSON.stringify(followUpAnswers)}`,
    `Tech notes: ${JSON.stringify(techNotes)}`,
    `Known facts: ${JSON.stringify(knownFacts)}`,
    `Unknowns: ${JSON.stringify(unknowns)}`,
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
    "- Never condemn major components without confirmation."
  ].join("\n");
}

function buildTaskInstruction() {
  return [
    "TASK INSTRUCTION",
    "Based on this information:",
    "- explain what is most likely happening",
    "- explain why",
    "- suggest the next best diagnostic step",
    "- ask ONE follow-up question if needed",
    "",
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
    '  "nextStep": string,',
    '  "followUpQuestion": string | null',
    "}",
    "confidence must be 0-100 based only on confirmed evidence."
  ].join("\n");
}

function normalizeCopilotResponse(parsed) {
  const messageText =
    typeof parsed.messageText === "string"
      ? parsed.messageText
      : "Not enough confirmed data yet. Based on what we know, I'd check the next field measurement.";
  const nextBestCheck =
    typeof parsed.nextStep === "string"
      ? parsed.nextStep
      : typeof parsed.nextBestCheck === "string"
        ? parsed.nextBestCheck
      : "Confirm the next live field measurement before ranking causes.";
  const followUpQuestion =
    typeof parsed.followUpQuestion === "string"
      ? parsed.followUpQuestion
      : typeof parsed.nextBestQuestion === "string"
        ? parsed.nextBestQuestion
        : null;
  const confidence = clampConfidence(parsed.confidence);

  return {
    provider: "openai",
    insight: typeof parsed.insight === "string" ? parsed.insight : messageText,
    quickPrompts: buildQuickPrompts(nextBestCheck, followUpQuestion),
    messageText,
    reasoningSummary: messageText,
    nextBestQuestion: followUpQuestion || "",
    followUpQuestion,
    nextBestCheck,
    nextStep: nextBestCheck,
    confidence,
    cautions: [],
    diagnosisResult: buildDiagnosisAdapter(parsed, messageText, nextBestCheck, followUpQuestion)
  };
}

function buildQuickPrompts(nextStep, followUpQuestion) {
  return [nextStep, followUpQuestion].filter(
    (value) => typeof value === "string" && value.trim().length > 0
  );
}

function buildDiagnosisAdapter(parsed, messageText, nextStep, followUpQuestion) {
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
    missingInfo: followUpQuestion ? [followUpQuestion] : [],
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
    "nextStep",
    "followUpQuestion"
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
