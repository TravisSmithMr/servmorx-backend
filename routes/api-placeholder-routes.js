function registerApiPlaceholderRoutes(app) {
  app.post("/api/wire-vision/analyze", (req, res) => {
    const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY?.trim());

    res.json({
      components: [
        {
          id: "contactor",
          componentType: "contactor",
          label: "Contactor",
          confidence: hasOpenAIKey ? 0.82 : 0.68,
          boundingBox: { x: 0.14, y: 0.2, width: 0.24, height: 0.22 },
          wireColors: ["red", "yellow", "blue"],
          notes: "Mock backend placeholder. Verify contactor coil voltage manually."
        },
        {
          id: "capacitor",
          componentType: "capacitor",
          label: "Dual Run Capacitor",
          confidence: hasOpenAIKey ? 0.8 : 0.66,
          boundingBox: { x: 0.56, y: 0.42, width: 0.22, height: 0.26 },
          wireColors: ["brown", "yellow"],
          notes: "Mock backend placeholder. Verify MFD against nameplate."
        },
        {
          id: "transformer",
          componentType: "transformer",
          label: "24V Transformer",
          confidence: hasOpenAIKey ? 0.78 : 0.62,
          boundingBox: { x: 0.58, y: 0.14, width: 0.2, height: 0.18 },
          wireColors: ["red", "blue"],
          notes: "Mock backend placeholder. Verify 24V secondary safely."
        }
      ],
      wirePaths: [
        {
          id: "control-path",
          color: "red",
          originComponentID: "transformer",
          destinationComponentID: "contactor",
          confidence: hasOpenAIKey ? 0.8 : 0.64,
          label: "24V control path",
          notes: "Meter R to C and coil voltage under call."
        },
        {
          id: "capacitor-path",
          color: "brown",
          originComponentID: "capacitor",
          destinationComponentID: "contactor",
          confidence: hasOpenAIKey ? 0.76 : 0.61,
          label: "Fan/capacitor path",
          notes: "Verify capacitor rating and fan motor lead condition."
        }
      ],
      warnings: [
        {
          id: "verify-warning",
          message: "Technician verification required. Backend wire vision is currently placeholder/mock-safe.",
          severity: "caution",
          relatedComponentID: null,
          relatedWirePathID: null
        }
      ],
      suggestedChecks: [
        "Verify 24V at contactor coil before condemning the contactor.",
        "Verify capacitor MFD with power isolated and capacitor discharged.",
        "Physically trace every highlighted wire before handling wiring."
      ],
      rawModelText: "Mock wire vision placeholder from backend. Real OpenAI Vision integration belongs here server-side.",
      overallConfidence: hasOpenAIKey ? 0.8 : 0.64
    });
  });

  app.post("/api/equipment/intelligence", (req, res) => {
    const equipment = req.body?.equipment || req.body || {};

    res.json({
      provider: "backend",
      usedFallback: true,
      confidence: 0.62,
      brand: equipment.brand || equipment.unitBrand || "Unknown",
      modelNumber: equipment.modelNumber || equipment.unitModel || "Unknown",
      intelligenceNotes: [
        "Mock equipment intelligence response. Verify model-specific data against manufacturer documentation.",
        "Confirm voltage, refrigerant, and nameplate values before diagnosis."
      ],
      suggestedChecks: [
        "Confirm equipment identity from the data tag.",
        "Compare field readings against nameplate limits."
      ],
      warnings: [
        "Backend equipment intelligence route is placeholder-only until production data is connected."
      ]
    });
  });

  app.post("/api/warranty/lookup", (req, res) => {
    const serialNumber = req.body?.serialNumber || "";

    res.json({
      provider: "backend",
      usedFallback: true,
      status: "unknown",
      serialNumber,
      message: "Warranty lookup placeholder. Verify warranty through manufacturer portal before quoting coverage.",
      warnings: [
        "Do not rely on placeholder warranty output for billing or repair authorization."
      ]
    });
  });
}

module.exports = { registerApiPlaceholderRoutes };
