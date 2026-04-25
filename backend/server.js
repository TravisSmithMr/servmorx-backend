const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const pressureTemperatureTables = {
  R410A: [
    { pressure: 90, temperature: 32 },
    { pressure: 105, temperature: 38 },
    { pressure: 118, temperature: 43 },
    { pressure: 130, temperature: 47 },
    { pressure: 145, temperature: 52 },
    { pressure: 165, temperature: 58 },
    { pressure: 190, temperature: 66 },
    { pressure: 220, temperature: 75 },
    { pressure: 255, temperature: 85 },
    { pressure: 295, temperature: 96 },
    { pressure: 335, temperature: 106 },
    { pressure: 375, temperature: 115 },
    { pressure: 418, temperature: 124 },
  ],
  R22: [
    { pressure: 50, temperature: 26 },
    { pressure: 58, temperature: 32 },
    { pressure: 68, temperature: 38 },
    { pressure: 79, temperature: 45 },
    { pressure: 92, temperature: 52 },
    { pressure: 106, temperature: 60 },
    { pressure: 125, temperature: 70 },
    { pressure: 146, temperature: 80 },
    { pressure: 170, temperature: 90 },
    { pressure: 196, temperature: 100 },
    { pressure: 226, temperature: 110 },
    { pressure: 259, temperature: 120 },
  ],
  R454B: [
    { pressure: 88, temperature: 32 },
    { pressure: 102, temperature: 38 },
    { pressure: 115, temperature: 43 },
    { pressure: 127, temperature: 47 },
    { pressure: 142, temperature: 52 },
    { pressure: 162, temperature: 58 },
    { pressure: 186, temperature: 66 },
    { pressure: 214, temperature: 75 },
    { pressure: 248, temperature: 85 },
    { pressure: 286, temperature: 96 },
    { pressure: 324, temperature: 106 },
    { pressure: 364, temperature: 115 },
    { pressure: 407, temperature: 124 },
  ],
};

app.use(cors());
app.use(express.json({ limit: "20mb" }));

function getOpenAIKey() {
  return process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()
    ? process.env.OPENAI_API_KEY.trim()
    : null;
}

function extractOutputText(payload) {
  if (payload && typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!payload || !Array.isArray(payload.output)) {
    return "";
  }

  return payload.output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((content) => content.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function createOpenAIResponse(body) {
  const apiKey = getOpenAIKey();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the backend.");
  }

  const response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI backend request failed: ${response.status} ${errorBody}`);
  }

  return response.json();
}

function fallbackOcrText() {
  return [
    "TRANE",
    "MODEL NO: 4TTR6042J1000AA",
    "SERIAL NO: 23061ABCD",
    "R-410A",
  ].join("\n");
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function numeric(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatValue(value, suffix) {
  return value === null ? "Not measured" : `${round(value)}${suffix}`;
}

function classify(value, low, high) {
  if (value === null) {
    return "insufficient";
  }

  if (value < low) {
    return "low";
  }

  if (value > high) {
    return "high";
  }

  return "normal";
}

function titleCase(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeRefrigerant(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (normalized.includes("410")) {
    return "R410A";
  }

  if (normalized.includes("454")) {
    return "R454B";
  }

  if (normalized.includes("22")) {
    return "R22";
  }

  return null;
}

function interpolateTemperature(refrigerant, pressure) {
  if (!refrigerant || pressure === null) {
    return null;
  }

  const table = pressureTemperatureTables[refrigerant];

  if (!table) {
    return null;
  }

  if (pressure <= table[0].pressure) {
    return table[0].temperature;
  }

  if (pressure >= table[table.length - 1].pressure) {
    return table[table.length - 1].temperature;
  }

  for (let index = 0; index < table.length - 1; index += 1) {
    const current = table[index];
    const next = table[index + 1];

    if (pressure >= current.pressure && pressure <= next.pressure) {
      const ratio = (pressure - current.pressure) / (next.pressure - current.pressure);
      return round(current.temperature + ratio * (next.temperature - current.temperature));
    }
  }

  return null;
}

function pushSignal(signals, id, label, value, suffix, note, low, high) {
  signals.push({
    id,
    label,
    status: classify(value, low, high),
    value: formatValue(value, suffix),
    note,
  });
}

function buildRouteLabel(context) {
  return (
    context.secondaryRoute ||
    context.route ||
    context.primaryRoute ||
    "unresolved route"
  );
}

function fallbackTestsForRoute(context) {
  const fromCauses = Array.isArray(context.likelyCauses)
    ? context.likelyCauses.map((cause) => cause.nextCheck).filter(Boolean).slice(0, 4)
    : [];

  if (fromCauses.length > 0) {
    return fromCauses;
  }

  const route = (context.secondaryRoute || context.route || "").toLowerCase();

  if (route.includes("compressor")) {
    return [
      "Verify the compressor is seeing proper line voltage under load.",
      "Check the run capacitor and compare against the rated value.",
      "Check compressor amp draw before condemning the compressor.",
    ];
  }

  if (route.includes("fan")) {
    return [
      "Verify fan motor voltage with the contactor pulled in.",
      "Check the condenser fan capacitor.",
      "Spin the blade by hand to rule out a locked bearing.",
    ];
  }

  if (route.includes("low voltage")) {
    return [
      "Check for 24V at the contactor coil.",
      "Verify the low-voltage fuse and transformer output.",
      "Check continuity through the safety circuit to the outdoor unit.",
    ];
  }

  if (route.includes("line voltage")) {
    return [
      "Verify breaker or disconnect status.",
      "Check line voltage at the disconnect and contactor line side.",
      "If the contactor is in, verify load-side voltage through the contactor.",
    ];
  }

  if (route.includes("outdoor unit")) {
    return [
      "Verify the contactor is actually pulled in.",
      "Check 24V at the contactor coil.",
      "Verify line voltage at the outdoor unit.",
    ];
  }

  if (route.includes("indoor unit") || route.includes("blower")) {
    return [
      "Verify blower call is present.",
      "Confirm high voltage at the indoor unit.",
      "Check motor-specific clues before widening the diagnosis.",
    ];
  }

  if (route.includes("refrigeration")) {
    return [
      "Capture suction and liquid pressures.",
      "Get line temperatures and indoor delta T.",
      "Confirm airflow before making a charge call.",
    ];
  }

  return [
    "Stay with the current structured branch and confirm one decisive field check.",
    "Capture the next missing measurement before broadening the diagnosis.",
  ];
}

function buildAnalyticsDirection(analytics) {
  if (!analytics) {
    return null;
  }

  const lines = [];

  if (typeof analytics.deltaT === "number") {
    if (analytics.deltaT < 14) {
      lines.push(`Delta T is only ${analytics.deltaT}F, so airflow or refrigeration-side trouble is still in play.`);
    } else if (analytics.deltaT > 24) {
      lines.push(`Delta T is ${analytics.deltaT}F, which is elevated enough to make airflow and coil loading worth a second look.`);
    } else {
      lines.push(`Delta T is ${analytics.deltaT}F, which is workable for a first-pass cooling check.`);
    }
  }

  if (typeof analytics.calculatedSuperheat === "number") {
    if (analytics.calculatedSuperheat > 20) {
      lines.push(`Superheat is high at ${analytics.calculatedSuperheat}F, which can fit low charge, underfeed, or low-evaporator-load behavior.`);
    } else if (analytics.calculatedSuperheat < 5) {
      lines.push(`Superheat is low at ${analytics.calculatedSuperheat}F, which can fit overfeed or flooding behavior.`);
    }
  }

  if (typeof analytics.calculatedSubcool === "number") {
    if (analytics.calculatedSubcool > 18) {
      lines.push(`Subcool is high at ${analytics.calculatedSubcool}F, which can fit restriction, overcharge, or condenser-side heat rejection trouble.`);
    } else if (analytics.calculatedSubcool < 5) {
      lines.push(`Subcool is low at ${analytics.calculatedSubcool}F, which can support low charge or feed issues.`);
    }
  }

  if (Array.isArray(analytics.interpretation) && analytics.interpretation.length > 0) {
    lines.push(analytics.interpretation[0]);
  }

  return lines[0] || null;
}

function buildCopilotSummary(context) {
  const facts = [];

  if (context.issue) {
    facts.push(`Issue lane is ${context.issue}.`);
  }

  if (context.primaryRoute) {
    facts.push(`Primary route is ${context.primaryRoute}.`);
  }

  if (context.secondaryRoute) {
    facts.push(`The branch narrowed to ${context.secondaryRoute}.`);
  } else if (context.route) {
    facts.push(`Current route is ${context.route}.`);
  }

  if (context.equipment && (context.equipment.brand || context.equipment.modelNumber)) {
    facts.push(
      `Equipment context: ${[context.equipment.brand, context.equipment.modelNumber]
        .filter(Boolean)
        .join(" | ")}.`
    );
  }

  if (Array.isArray(context.routeReasons) && context.routeReasons[0]) {
    facts.push(`Why: ${context.routeReasons[0]}`);
  }

  return facts.join(" ") || "The diagnostic session is still early, so the copilot only has partial context.";
}

function buildCopilotDirection(context) {
  const topCause = Array.isArray(context.likelyCauses) && context.likelyCauses[0]
    ? context.likelyCauses[0]
    : null;
  const routeLabel = buildRouteLabel(context);
  const analyticsDirection = buildAnalyticsDirection(context.analytics);

  if (topCause) {
    return [
      `The structured engine is holding on ${routeLabel}.`,
      context.routeSwapReason ? `It narrowed there because ${context.routeSwapReason.toLowerCase()}` : null,
      `Right now the leading failure path is ${topCause.title.toLowerCase()} because ${topCause.why.toLowerCase()}`,
      analyticsDirection,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (Array.isArray(context.routeReasons) && context.routeReasons[0]) {
    return [context.routeReasons[0], analyticsDirection].filter(Boolean).join(" ");
  }

  return analyticsDirection || `The structured engine needs one more decisive answer before ${routeLabel} becomes a useful branch.`;
}

function buildCopilotFollowUp(context) {
  if (Array.isArray(context.contradictions) && context.contradictions[0]) {
    return context.contradictions[0];
  }

  if (Array.isArray(context.missingDataFlags) && context.missingDataFlags[0]) {
    return context.missingDataFlags[0];
  }

  const route = (context.secondaryRoute || context.route || "").toLowerCase();

  if (route.includes("compressor")) {
    return "Can you confirm whether the compressor is drawing current with the contactor in?";
  }

  if (route.includes("fan")) {
    return "With the contactor pulled in, do you have line voltage at the fan motor?";
  }

  if (route.includes("low voltage")) {
    return "Do you have a clean 24V call at the contactor coil?";
  }

  if (route.includes("line voltage")) {
    return "Can you verify line voltage at the disconnect and at the contactor line side?";
  }

  return "What is the next confirming measurement or observation you can get right now?";
}

function buildQuickPrompts(context) {
  const prompts = ["What should I test next?", "What is this pointing toward?", "What is still missing?"];

  if (context.secondaryRoute) {
    prompts.push("Why did the route narrow?");
  }

  if (Array.isArray(context.contradictions) && context.contradictions.length > 0) {
    prompts.push("What looks contradictory here?");
  }

  return prompts.slice(0, 4);
}

function buildReplyMessage(context, userMessage) {
  const query = (userMessage || "").toLowerCase();
  const analyticsDirection = buildAnalyticsDirection(context.analytics);
  const nextTests = fallbackTestsForRoute(context).join(", ");
  const routeLabel = buildRouteLabel(context);

  if (query.includes("why") && query.includes("route")) {
    return context.routeSwapReason
      ? `The route narrowed to ${routeLabel} because ${context.routeSwapReason.toLowerCase()}. That is the strongest current field clue unless a contradiction shows up.`
      : `The current route is ${routeLabel} because ${Array.isArray(context.routeReasons) ? context.routeReasons.slice(0, 2).join(" ") : "the structured answers support it."}`;
  }

  if (query.includes("next") || query.includes("test") || query.includes("check")) {
    return `I would stay disciplined on the current branch: ${nextTests}.${analyticsDirection ? ` ${analyticsDirection}` : ""}`;
  }

  if (query.includes("charge") || query.includes("refrigerant") || query.includes("meter")) {
    if (analyticsDirection) {
      return `${analyticsDirection} I would still respect the current structured route and confirm airflow or electrical behavior before making a charge call.`;
    }

    return "Charge is still possible, but I would not jump there without better refrigerant-side readings and a clean airflow picture.";
  }

  if (query.includes("amps") || query.includes("current")) {
    return "If the component is drawing current, that moves the conversation away from a simple no-call. Pair amp draw with voltage and capacitor checks before condemning the component.";
  }

  if (query.includes("missing") || query.includes("else") || query.includes("need") || query.includes("contradict")) {
    const gaps = [...(context.contradictions || []), ...(context.missingDataFlags || [])].slice(0, 3);
    return gaps.length > 0
      ? `The highest-value gaps right now are: ${gaps.join(" ")}`
      : "The session has enough structure for a workable first-pass route, so the next job is confirming the top branch with one decisive field check.";
  }

  return buildCopilotDirection(context);
}

function buildFallbackCopilot(context, message) {
  const insight = {
    summary: buildCopilotSummary(context),
    direction: buildCopilotDirection(context),
    followUpQuestion: buildCopilotFollowUp(context),
    nextBestTests: fallbackTestsForRoute(context),
  };

  return {
    insight,
    quickPrompts: buildQuickPrompts(context),
    messageText: [
      `Known: ${insight.summary}`,
      `Direction: ${message ? buildReplyMessage(context, message) : insight.direction}`,
      `Follow-up: ${insight.followUpQuestion}`,
      `Next tests: ${insight.nextBestTests.join(" | ")}`,
    ].join("\n"),
  };
}

function analyzeMeasurements(measurements = {}, context = {}) {
  const suctionPressure = numeric(measurements.suctionPressure);
  const liquidPressure = numeric(measurements.liquidPressure);
  const suctionLineTemp = numeric(measurements.suctionLineTemp);
  const liquidLineTemp = numeric(measurements.liquidLineTemp);
  const outdoorAmbientTemp = numeric(measurements.outdoorAmbientTemp);
  const indoorReturnTemp = numeric(measurements.indoorReturnTemp);
  const indoorSupplyTemp = numeric(measurements.indoorSupplyTemp);
  const enteredSuperheat = numeric(measurements.superheat);
  const enteredSubcool = numeric(measurements.subcool);
  const refrigerant = normalizeRefrigerant(context?.equipment?.refrigerant);

  const deltaT =
    indoorReturnTemp !== null && indoorSupplyTemp !== null
      ? round(indoorReturnTemp - indoorSupplyTemp)
      : null;
  const pressureSpread =
    liquidPressure !== null && suctionPressure !== null ? round(liquidPressure - suctionPressure) : null;
  const lineTempSpread =
    liquidLineTemp !== null && suctionLineTemp !== null ? round(liquidLineTemp - suctionLineTemp) : null;
  const saturatedSuctionTemp = interpolateTemperature(refrigerant, suctionPressure);
  const saturatedLiquidTemp = interpolateTemperature(refrigerant, liquidPressure);
  const superheat =
    saturatedSuctionTemp !== null && suctionLineTemp !== null
      ? round(suctionLineTemp - saturatedSuctionTemp)
      : enteredSuperheat;
  const subcool =
    saturatedLiquidTemp !== null && liquidLineTemp !== null
      ? round(saturatedLiquidTemp - liquidLineTemp)
      : enteredSubcool;
  const condensingSplit =
    saturatedLiquidTemp !== null && outdoorAmbientTemp !== null
      ? round(saturatedLiquidTemp - outdoorAmbientTemp)
      : null;

  const signals = [];
  pushSignal(
    signals,
    "delta_t",
    "Indoor Delta T",
    deltaT,
    " F",
    "Based on return minus supply. This is the fastest comfort-side cooling measurement.",
    14,
    24
  );
  pushSignal(
    signals,
    "superheat",
    "Superheat",
    superheat,
    " F",
    "Calculated when refrigerant and suction readings allow it, otherwise uses the entered value.",
    5,
    20
  );
  pushSignal(
    signals,
    "subcool",
    "Subcool",
    subcool,
    " F",
    "Calculated when refrigerant and liquid readings allow it, otherwise uses the entered value.",
    5,
    18
  );
  const interpretation = [];
  const missingData = [];

  if (deltaT === null) {
    missingData.push("Capture return and supply temperatures to get an indoor delta T.");
  } else if (deltaT < 14) {
    interpretation.push("Delta T is low, which can support airflow loss, low load, or charge-related behavior.");
  } else if (deltaT > 24) {
    interpretation.push("Delta T is elevated, so verify airflow and coil loading.");
  } else {
    interpretation.push("Delta T is in a workable first-pass cooling range.");
  }

  if (!refrigerant) {
    missingData.push("Refrigerant type is not known, so calculated superheat and subcool may be limited.");
  }

  if (superheat === null) {
    missingData.push("Add suction pressure and suction line temperature to calculate superheat.");
  } else if (superheat < 5) {
    interpretation.push("Superheat looks low, which can fit overfeed, flooding, or low-load behavior.");
  } else if (superheat > 20) {
    interpretation.push("Superheat looks high, which can support underfeed, low charge, or load issues.");
  } else {
    interpretation.push("Superheat is in a reasonable first-pass range.");
  }

  if (subcool === null) {
    missingData.push("Add liquid pressure and liquid line temperature to calculate subcool.");
  } else if (subcool < 5) {
    interpretation.push("Subcool looks low, which can support low charge or feed issues.");
  } else if (subcool > 18) {
    interpretation.push("Subcool looks high, which can fit restriction, overcharge, or condenser-side issues.");
  } else {
    interpretation.push("Subcool is in a reasonable first-pass range.");
  }

  if (suctionPressure === null || liquidPressure === null) {
    missingData.push("Capture suction and liquid pressures for better refrigeration-side context.");
  } else {
    interpretation.push(`Pressure spread is ${formatValue(pressureSpread, " psig")}. Read it alongside refrigerant type and ambient before making a charge call.`);
  }

  if (outdoorAmbientTemp === null) {
    missingData.push("Outdoor ambient helps contextualize head pressure and subcool.");
  } else if (condensingSplit !== null) {
    if (condensingSplit < 15) {
      interpretation.push(`Condensing split is only ${formatValue(condensingSplit, " F")}, so verify condenser load and charge before assuming the head is normal.`);
    } else if (condensingSplit > 30) {
      interpretation.push(`Condensing split is ${formatValue(condensingSplit, " F")}, which can fit dirty condenser, overcharge, or airflow rejection issues.`);
    }
  }

  return {
    refrigerant,
    deltaT,
    pressureSpread,
    lineTempSpread,
    saturatedSuctionTemp,
    saturatedLiquidTemp,
    calculatedSuperheat: superheat,
    calculatedSubcool: subcool,
    signals,
    interpretation,
    missingData,
  };
}

function extractJsonObject(rawText) {
  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Backend copilot did not return a JSON object.");
  }

  return JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
}

function buildCopilotPrompt(context, message) {
  return [
    "You are SERVMORX TECH, an HVAC diagnostic copilot assisting a field technician.",
    "The structured route is the source of truth. Explain it, do not replace it.",
    "Sound like a senior field tech: practical, concise, confident, not generic.",
    "Use equipment context, gate answers, focused diagnostic answers, likely causes, confidence, contradictions, missing data, and analytics if present.",
    "Do not repeat the whole questionnaire. Tell the tech what the current answers imply and what to verify next.",
    "If analytics are partial, say what they support and what is still missing.",
    "Return strict JSON with keys: provider, insight, quickPrompts, messageText.",
    "insight must include summary, direction, followUpQuestion, nextBestTests.",
    "nextBestTests must be ordered, practical field checks.",
    "",
    `User message: ${message || "Passive update only."}`,
    "",
    "Diagnostic context JSON:",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    message: "SERVMORX backend is running",
  });
});

app.post("/ocr/extract-text", async (req, res) => {
  try {
    const image = req.body && req.body.image ? req.body.image : {};
    const payload = await createOpenAIResponse({
      model: process.env.OPENAI_OCR_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Read this HVAC equipment data tag and return the visible OCR text exactly as text with line breaks. Preserve model numbers, serial numbers, voltages, and brand names.",
            },
            {
              type: "input_image",
              image_url: `data:${image.mimeType || "image/jpeg"};base64,${image.base64 || ""}`,
              detail: "high",
            },
          ],
        },
      ],
    });
    const text = extractOutputText(payload);

    if (!text) {
      throw new Error("Backend OCR provider returned no readable text.");
    }

    res.json({
      provider: "openai_backend_ocr",
      providerPath: "backend_proxy",
      providerStatus: "Backend OCR provider responded successfully.",
      text,
      usedFallback: false,
      errorMessage: null,
      openAiError: false,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown OCR error.";
    res.json({
      provider: "backend_mock_ocr_fallback",
      providerPath: "backend_proxy",
      providerStatus: `Backend OCR fallback used: ${reason}`,
      text: fallbackOcrText(),
      usedFallback: true,
      errorMessage: reason,
      openAiError: reason.toLowerCase().includes("openai"),
    });
  }
});

app.post("/diagnostics/copilot", async (req, res) => {
  const context = req.body && req.body.context ? req.body.context : {};
  const message = req.body && req.body.message ? req.body.message : null;

  try {
    const payload = await createOpenAIResponse({
      model: process.env.OPENAI_DIAGNOSTICS_MODEL || "gpt-4.1-mini",
      input: buildCopilotPrompt(context, message),
    });
    const rawText = extractOutputText(payload);
    const parsed = extractJsonObject(rawText);

    res.json({
      provider: parsed.provider || "openai_backend_copilot",
      providerPath: "backend_proxy",
      providerStatus: "Backend OpenAI copilot provider responded successfully.",
      usedFallback: false,
      insight: parsed.insight,
      quickPrompts: Array.isArray(parsed.quickPrompts) && parsed.quickPrompts.length > 0
        ? parsed.quickPrompts
        : buildQuickPrompts(context),
      messageText: parsed.messageText || buildFallbackCopilot(context, message).messageText,
    });
  } catch (error) {
    const fallback = buildFallbackCopilot(context, message);

    res.json({
      provider: "backend_local_copilot_fallback",
      providerPath: "backend_proxy",
      providerStatus: `Backend copilot fallback used: ${error instanceof Error ? error.message : "Unknown copilot error."}`,
      usedFallback: true,
      insight: fallback.insight,
      quickPrompts: fallback.quickPrompts,
      messageText: fallback.messageText,
    });
  }
});

app.post("/diagnostics/analyze-system", async (req, res) => {
  const context = req.body && req.body.context ? req.body.context : {};
  const analytics = analyzeMeasurements(req.body ? req.body.measurements : {}, context);

  res.json({
    provider: "backend_analytics_engine",
    providerPath: "backend_proxy",
    providerStatus: analytics.refrigerant
      ? "Backend diagnostics analytics responded successfully with refrigerant-aware calculations."
      : "Backend diagnostics analytics responded successfully. Refrigerant-aware calculations are limited until refrigerant context is known.",
    usedFallback: false,
    analytics,
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on http://0.0.0.0:${PORT}`);
});
