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
  const rawJson = await createServerJsonResponse(buildCopilotPrompt(context, payload.message));
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
            "You are SERVMORX TECH, an AI HVAC diagnostic copilot for field technicians. Return valid JSON only."
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
  const issue = context?.issue || "unknown";
  const equipment = context?.equipment || null;
  const followUpAnswers = context?.followUpAnswers || {};
  const techNotes = Array.isArray(context?.techNotes) ? context.techNotes : [];

  return [
    "You are SERVMORX TECH, an AI HVAC diagnostic copilot for field technicians.",
    "All reasoning must come from the supplied diagnostic context. Do not invent readings.",
    "Sound like an experienced field tech: practical, concise, grounded, and focused on narrowing causes.",
    "Return strict JSON only with keys: provider, messageText, insight, quickPrompts.",
    'provider must be exactly "openai".',
    "insight must be a short string the app can display.",
    "messageText: 2-4 short sentences max. Include what the evidence points toward and the next check.",
    "quickPrompts: 0-3 short technician prompts.",
    "",
    `Issue: ${issue}`,
    `Equipment: ${JSON.stringify(equipment)}`,
    `Follow-up answers: ${JSON.stringify(followUpAnswers)}`,
    `Tech notes: ${JSON.stringify(techNotes)}`,
    "",
    "Diagnostic context JSON:",
    JSON.stringify(context || {}, null, 2),
    "",
    `Latest technician message: ${message || "none"}`
  ].join("\n");
}

function normalizeCopilotResponse(parsed) {
  return {
    provider: "openai",
    insight: typeof parsed.insight === "string" ? parsed.insight : "",
    quickPrompts: Array.isArray(parsed.quickPrompts) ? parsed.quickPrompts : [],
    messageText:
      typeof parsed.messageText === "string"
        ? parsed.messageText
        : "Backend AI returned no reasoning text."
  };
}
