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
  const context = payload.context || {};
  console.log("[diagnostics/copilot] AI context:", JSON.stringify(context));
  const rawJson = await createServerJsonResponse(buildCopilotPrompt(context, payload.message));
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
          content: buildSystemPrompt()
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

function buildCopilotPrompt(context, message) {
  const issue = context?.selectedIssue || context?.issue || "unknown";
  const equipment = context?.equipment || null;
  const followUpAnswers = context?.followUpAnswers || {};
  const techNotes = Array.isArray(context?.techNotes) ? context.techNotes : [];
  const knownFacts = Array.isArray(context?.knownFacts) ? context.knownFacts : [];
  const unknowns = Array.isArray(context?.unknowns) ? context.unknowns : [];
  const contradictions = Array.isArray(context?.contradictions) ? context.contradictions : [];
  const currentStage = context?.currentStage || context?.stage || "unknown";

  return [
    "Build the next SERVMORX TECH diagnostic response from this context.",
    "Reason from knownFacts first. Treat unknowns as missing data, not evidence.",
    "If there is not enough confirmed data, use this wording in messageText: Not enough confirmed data yet. Based on what we know, I'd check ___ next.",
    "Return strict JSON only. No markdown. No prose outside JSON.",
    "Required top-level shape:",
    "{ provider, insight, messageText, reasoningSummary, nextBestQuestion, nextBestCheck, confidence, cautions, quickPrompts, diagnosisResult }",
    'provider must be exactly "openai".',
    "confidence must be Low, Medium, or High.",
    "messageText must be 2-4 short sentences.",
    "quickPrompts must be 0-3 short field checks.",
    "cautions must list unsupported claims or safety cautions, if any.",
    "For Diagnosis or Result, include diagnosisResult. If evidence is weak, keep confidence low and missingInfo populated.",
    "diagnosisResult shape: { mostLikely: { label, confidence }, confidence, secondary: [{ label, confidence }], reasoning, nextSteps, whatWouldConfirm, whatWouldRuleOut, missingInfo, confidenceLabel, recommendedActions, estimatedRange }.",
    "recommendedActions should mirror the practical nextSteps so the existing app repair screen can display them.",
    "",
    `Current stage: ${currentStage}`,
    `Issue: ${issue}`,
    `Equipment: ${JSON.stringify(equipment)}`,
    `Follow-up answers: ${JSON.stringify(followUpAnswers)}`,
    `Tech notes: ${JSON.stringify(techNotes)}`,
    `Known facts: ${JSON.stringify(knownFacts)}`,
    `Unknowns: ${JSON.stringify(unknowns)}`,
    `Contradictions: ${JSON.stringify(contradictions)}`,
    "",
    "Diagnostic context JSON:",
    JSON.stringify(context || {}, null, 2),
    "",
    `Latest technician message: ${message || "none"}`
  ].join("\n");
}

function buildSystemPrompt() {
  return [
    "You are SERVMORX TECH, a senior HVAC service technician assisting another tech in the field.",
    "Do not act like customer support. Do not over-explain basic HVAC concepts.",
    "Do not guess from one symptom. Separate confirmed facts from assumptions.",
    "Prioritize live field observations, measurements, and technician notes over common failures.",
    "Never say a part is bad without naming the confirming check.",
    "When confidence is low, ask one sharp next question and give one next best field check.",
    "Every response must include nextBestCheck.",
    "Use likely path language, not absolute diagnosis language.",
    "HVAC reasoning rules:",
    "- No cooling plus fan only does not automatically mean bad compressor.",
    "- Fan running with compressor off should first separate capacitor, compressor overload, contactor/output, and safety/control path.",
    "- Low charge should not be suggested strongly without pressure/temp evidence or icing behavior.",
    "- Airflow issues should be considered before charge when airflow symptoms exist.",
    "- Electrical/control issues should be checked before condemning major components.",
    "- Check capacitor MFD before condemning compressor when start/run behavior points electrical.",
    "- Verify 24V at the contactor coil before assuming an outdoor unit component has failed.",
    "- Confirm compressor amp draw before leaning into compressor mechanical failure.",
    "Return valid JSON only."
  ].join("\n");
}

function normalizeCopilotResponse(parsed) {
  const messageText =
    typeof parsed.messageText === "string"
      ? parsed.messageText
      : "Not enough confirmed data yet. Based on what we know, I'd check the next field measurement.";
  const nextBestCheck =
    typeof parsed.nextBestCheck === "string"
      ? parsed.nextBestCheck
      : "Confirm the next live field measurement before ranking causes.";

  return {
    provider: "openai",
    insight: typeof parsed.insight === "string" ? parsed.insight : "",
    quickPrompts: Array.isArray(parsed.quickPrompts) ? parsed.quickPrompts : [],
    messageText,
    reasoningSummary:
      typeof parsed.reasoningSummary === "string" ? parsed.reasoningSummary : "",
    nextBestQuestion:
      typeof parsed.nextBestQuestion === "string" ? parsed.nextBestQuestion : "",
    nextBestCheck,
    confidence: normalizeConfidenceLabel(parsed.confidence),
    cautions: Array.isArray(parsed.cautions) ? parsed.cautions.map(String).slice(0, 3) : [],
    diagnosisResult: normalizeDiagnosisResult(parsed.diagnosisResult)
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

function normalizeConfidenceLabel(value) {
  return value === "High" || value === "Medium" || value === "Low" ? value : "Low";
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
    "reasoningSummary",
    "nextBestQuestion",
    "nextBestCheck",
    "confidence",
    "cautions",
    "quickPrompts"
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
