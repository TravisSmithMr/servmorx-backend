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
  res.json({
    provider: "backend",
    insight: "Copilot backend route is working.",
    quickPrompts: [],
    messageText: "Backend copilot endpoint is live."
  });
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
