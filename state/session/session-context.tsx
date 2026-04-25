import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  clearStoredSession,
  loadStoredSession,
  persistSession,
} from '@/state/session/session-storage';
import {
  generateCopilotPassiveUpdate,
  generateCopilotReply,
} from '@/services/ai-service';
import type {
  CopilotTabId,
  CopilotState,
  ConfirmedValues,
  DiagnosticResult,
  DiagnosticRouteId,
  DiagnosticSession,
  DiagnosticStep,
  DiagnosticAnswers,
  EquipmentCapture,
  EquipmentSource,
  GateAnswers,
  InferredValues,
  IndoorPlatformId,
  IssueId,
  MeasurementKey,
  RouteHistoryEntry,
  ScanDebugData,
  SpecData,
  SystemMeasurements,
  SystemTypeId,
  WarrantyStatus,
} from '@/types/diagnostic';

type ManualEquipmentDraft = {
  brand?: string | null;
  modelNumber?: string | null;
  serialNumber?: string | null;
};

type ExtractionPayload = {
  brand: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  detectedUnitType: string | null;
  detectedSystemType: SystemTypeId | null;
  extractionConfidence: number | null;
  ocrText: string | null;
  ocrProvider: string | null;
  scanDebug: ScanDebugData;
};

type EnrichmentPayload = {
  specData: SpecData | null;
  warrantyStatus: WarrantyStatus;
  warrantyDetails: string | null;
  commonFaults: string[];
};

type FlowControlPayload = {
  inferredValues?: Partial<InferredValues>;
  confirmedValues?: Partial<ConfirmedValues>;
  skippedQuestions?: string[];
};

const createInitialMeasurements = (): SystemMeasurements => ({
  suctionPressure: null,
  liquidPressure: null,
  suctionLineTemp: null,
  liquidLineTemp: null,
  outdoorAmbientTemp: null,
  indoorReturnTemp: null,
  indoorSupplyTemp: null,
  superheat: null,
  subcool: null,
});

const createInitialCopilotState = (): CopilotState => ({
  provider: 'local-diagnostic-copilot',
  providerPath: null,
  providerStatus: 'Copilot has not run yet.',
  usedFallback: true,
  lastContextHash: null,
  isExpanded: false,
  activeTab: 'copilot',
  quickPrompts: ['What does this point to?', 'What should I test next?', 'What is still missing?'],
  activeInsight: null,
  messages: [],
});

type SessionAction =
  | { type: 'HYDRATE_SESSION'; payload: DiagnosticSession }
  | { type: 'START_NEW_SESSION' }
  | { type: 'RESET_SESSION' }
  | { type: 'SET_CURRENT_STEP'; payload: DiagnosticStep }
  | { type: 'SET_EQUIPMENT_SOURCE'; payload: EquipmentSource }
  | { type: 'UPDATE_MANUAL_EQUIPMENT'; payload: ManualEquipmentDraft }
  | { type: 'SET_CAPTURE'; payload: EquipmentCapture }
  | { type: 'APPLY_EXTRACTION'; payload: ExtractionPayload }
  | { type: 'APPLY_ENRICHMENT'; payload: EnrichmentPayload }
  | { type: 'SET_SYSTEM_TYPE'; payload: SystemTypeId }
  | { type: 'SET_INDOOR_PLATFORM'; payload: IndoorPlatformId }
  | { type: 'SET_ISSUE'; payload: IssueId }
  | { type: 'SET_FLOW_CONTROL'; payload: FlowControlPayload }
  | { type: 'SET_GATE_ANSWER'; key: keyof GateAnswers; value: GateAnswers[keyof GateAnswers] }
  | { type: 'SET_MEASUREMENT'; key: MeasurementKey; value: SystemMeasurements[MeasurementKey] }
  | {
      type: 'SET_DIAG_ANSWER';
      key: keyof DiagnosticAnswers;
      value: DiagnosticAnswers[keyof DiagnosticAnswers];
    }
  | { type: 'SET_ROUTE'; payload: RouteHistoryEntry | null }
  | { type: 'SET_COPILOT_STATE'; payload: CopilotState }
  | { type: 'SET_COPILOT_PANEL'; payload: { isExpanded?: boolean; activeTab?: CopilotTabId } }
  | { type: 'SET_RESULTS'; payload: DiagnosticResult | null }
  | { type: 'MARK_COMPLETED' };

interface SessionContextValue {
  session: DiagnosticSession;
  isHydrated: boolean;
  startNewSession: () => void;
  resetSession: () => void;
  setCurrentStep: (step: DiagnosticStep) => void;
  setEquipmentSource: (source: EquipmentSource) => void;
  updateManualEquipment: (payload: ManualEquipmentDraft) => void;
  setCapture: (capture: EquipmentCapture) => void;
  applyExtraction: (payload: ExtractionPayload) => void;
  applyEnrichment: (payload: EnrichmentPayload) => void;
  setSystemType: (systemType: SystemTypeId) => void;
  setIndoorPlatform: (platform: IndoorPlatformId) => void;
  setIssue: (issue: IssueId) => void;
  setFlowControl: (payload: FlowControlPayload) => void;
  setGateAnswer: <K extends keyof GateAnswers>(key: K, value: GateAnswers[K]) => void;
  setMeasurement: <K extends MeasurementKey>(key: K, value: SystemMeasurements[K]) => void;
  setDiagAnswer: <K extends keyof DiagnosticAnswers>(
    key: K,
    value: DiagnosticAnswers[K]
  ) => void;
  setResolvedRoute: (
    route: DiagnosticRouteId | null,
    reasons: string[],
    confidence: number,
    stage?: RouteHistoryEntry['stage']
  ) => void;
  setResults: (result: DiagnosticResult | null) => void;
  setCopilotPanel: (payload: { isExpanded?: boolean; activeTab?: CopilotTabId }) => void;
  refreshCopilot: () => Promise<void>;
  sendCopilotMessage: (message: string) => Promise<void>;
  markCompleted: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const now = () => new Date().toISOString();

const createSessionId = () => `session-${Date.now()}`;

export const createInitialSession = (): DiagnosticSession => {
  const timestamp = now();

  return {
    sessionId: createSessionId(),
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'draft',
    currentStep: 'home',
    equipmentSource: null,
    systemType: null,
    indoorPlatform: null,
    issue: null,
    gateAnswers: {},
    diagAnswers: {},
    currentRoute: null,
    routeHistory: [],
    brand: null,
    modelNumber: null,
    serialNumber: null,
    detectedUnitType: null,
    detectedSystemType: null,
    extractionConfidence: null,
    ocrText: null,
    ocrProvider: null,
    scanDebug: {
      normalizedOcrText: null,
      ocrProviderPath: null,
      ocrProviderStatus: null,
      backendUrl: null,
      httpStatus: null,
      rawBackendResponse: null,
      errorMessage: null,
      openAiError: null,
      brandCandidates: [],
      modelCandidates: [],
      serialCandidates: [],
      confidenceSignals: [],
      failureReason: null,
    },
    inferredValues: {
      systemType: null,
      indoorPlatform: null,
      detectedUnitType: null,
    },
    confirmedValues: {
      equipment: false,
      systemType: false,
      indoorPlatform: false,
    },
    skippedQuestions: [],
    specData: null,
    warrantyStatus: 'unknown',
    warrantyDetails: null,
    commonFaults: [],
    notes: '',
    linkedJobId: null,
    linkedCustomerId: null,
    linkedEquipmentId: null,
    capture: null,
    measurements: createInitialMeasurements(),
    copilot: createInitialCopilotState(),
    likelyCauses: [],
    nextChecks: [],
    results: null,
  };
};

const withMeta = (
  state: DiagnosticSession,
  updates: Partial<DiagnosticSession>
): DiagnosticSession => ({
  ...state,
  ...updates,
  updatedAt: now(),
});

const sessionReducer = (state: DiagnosticSession, action: SessionAction): DiagnosticSession => {
  switch (action.type) {
    case 'HYDRATE_SESSION':
      return {
        ...createInitialSession(),
        ...action.payload,
        inferredValues: {
          ...createInitialSession().inferredValues,
          ...action.payload.inferredValues,
        },
        confirmedValues: {
          ...createInitialSession().confirmedValues,
          ...action.payload.confirmedValues,
        },
        scanDebug: {
          ...createInitialSession().scanDebug,
          ...action.payload.scanDebug,
        },
        measurements: {
          ...createInitialMeasurements(),
          ...action.payload.measurements,
        },
        copilot: {
          ...createInitialCopilotState(),
          ...action.payload.copilot,
        },
      };
    case 'START_NEW_SESSION': {
      const next = createInitialSession();

      return {
        ...next,
        status: 'active',
        currentStep: 'equipment-intake',
      };
    }
    case 'RESET_SESSION':
      return createInitialSession();
    case 'SET_CURRENT_STEP':
      return state.currentStep === action.payload ? state : withMeta(state, { currentStep: action.payload });
    case 'SET_EQUIPMENT_SOURCE':
      return state.equipmentSource === action.payload
        ? state
        : withMeta(state, { equipmentSource: action.payload });
    case 'UPDATE_MANUAL_EQUIPMENT':
      return withMeta(state, {
        brand: action.payload.brand ?? state.brand,
        modelNumber: action.payload.modelNumber ?? state.modelNumber,
        serialNumber: action.payload.serialNumber ?? state.serialNumber,
        confirmedValues: {
          ...state.confirmedValues,
          equipment: true,
        },
      });
    case 'SET_CAPTURE':
      return withMeta(state, { capture: action.payload });
    case 'APPLY_EXTRACTION':
      return withMeta(state, {
        brand: action.payload.brand,
        modelNumber: action.payload.modelNumber,
        serialNumber: action.payload.serialNumber,
        detectedUnitType: action.payload.detectedUnitType,
        detectedSystemType: action.payload.detectedSystemType,
        extractionConfidence: action.payload.extractionConfidence,
        ocrText: action.payload.ocrText,
        ocrProvider: action.payload.ocrProvider,
        scanDebug: action.payload.scanDebug,
        inferredValues: {
          ...state.inferredValues,
          systemType: action.payload.detectedSystemType,
          detectedUnitType: action.payload.detectedUnitType,
        },
      });
    case 'APPLY_ENRICHMENT':
      return withMeta(state, {
        specData: action.payload.specData,
        warrantyStatus: action.payload.warrantyStatus,
        warrantyDetails: action.payload.warrantyDetails,
        commonFaults: action.payload.commonFaults,
      });
    case 'SET_SYSTEM_TYPE':
      return withMeta(state, {
        status: 'active',
        systemType: action.payload,
        detectedSystemType: state.detectedSystemType ?? action.payload,
        indoorPlatform: action.payload === 'split_system_ac' ? state.indoorPlatform : null,
        confirmedValues: {
          ...state.confirmedValues,
          systemType: true,
        },
      });
    case 'SET_INDOOR_PLATFORM':
      return withMeta(state, {
        indoorPlatform: action.payload,
        confirmedValues: {
          ...state.confirmedValues,
          indoorPlatform: true,
        },
      });
    case 'SET_ISSUE':
      return withMeta(state, {
        issue: action.payload,
        gateAnswers: {},
        diagAnswers: {},
        currentRoute: null,
        routeHistory: [],
        likelyCauses: [],
        nextChecks: [],
        results: null,
        measurements: createInitialMeasurements(),
        copilot: createInitialCopilotState(),
      });
    case 'SET_FLOW_CONTROL':
      return withMeta(state, {
        inferredValues: {
          ...state.inferredValues,
          ...action.payload.inferredValues,
        },
        confirmedValues: {
          ...state.confirmedValues,
          ...action.payload.confirmedValues,
        },
        skippedQuestions: action.payload.skippedQuestions ?? state.skippedQuestions,
      });
    case 'SET_GATE_ANSWER':
      return withMeta(state, {
        gateAnswers: {
          ...state.gateAnswers,
          [action.key]: action.value,
        },
      });
    case 'SET_MEASUREMENT':
      return withMeta(state, {
        measurements: {
          ...state.measurements,
          [action.key]: action.value,
        },
      });
    case 'SET_DIAG_ANSWER':
      return withMeta(state, {
        diagAnswers: {
          ...state.diagAnswers,
          [action.key]: action.value,
        },
      });
    case 'SET_ROUTE': {
      if (!action.payload) {
        return withMeta(state, { currentRoute: null });
      }

      const last = state.routeHistory[state.routeHistory.length - 1];
      const nextHistory =
        last &&
        last.route === action.payload.route &&
        last.reasons.join('|') === action.payload.reasons.join('|') &&
        last.confidence === action.payload.confidence
          ? state.routeHistory
          : [...state.routeHistory, action.payload];

      return withMeta(state, {
        currentRoute: action.payload.route,
        routeHistory: nextHistory,
      });
    }
    case 'SET_COPILOT_STATE':
      return withMeta(state, {
        copilot: action.payload,
      });
    case 'SET_COPILOT_PANEL':
      return withMeta(state, {
        copilot: {
          ...state.copilot,
          ...(action.payload.isExpanded !== undefined
            ? { isExpanded: action.payload.isExpanded }
            : null),
          ...(action.payload.activeTab ? { activeTab: action.payload.activeTab } : null),
        },
      });
    case 'SET_RESULTS':
      return withMeta(state, {
        results: action.payload,
        likelyCauses: action.payload?.likelyCauses ?? [],
        nextChecks: action.payload?.nextChecks ?? [],
      });
    case 'MARK_COMPLETED':
      return state.status === 'completed' && state.currentStep === 'results'
        ? state
        : withMeta(state, { status: 'completed', currentStep: 'results' });
    default:
      return state;
  }
};

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, dispatch] = useReducer(sessionReducer, undefined, createInitialSession);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    loadStoredSession()
      .then((storedSession) => {
        if (!mounted) {
          return;
        }

        if (storedSession) {
          dispatch({ type: 'HYDRATE_SESSION', payload: storedSession });
        }
      })
      .catch((error) => {
        console.warn(
          '[session][hydrate] unable to load persisted session:',
          error instanceof Error ? error.message : 'Unknown session hydrate error.'
        );
      })
      .finally(() => {
        if (mounted) {
          setIsHydrated(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    persistSession(session).catch(() => undefined);
  }, [isHydrated, session]);

  const startNewSession = useCallback(() => {
    dispatch({ type: 'START_NEW_SESSION' });
  }, []);

  const resetSession = useCallback(() => {
    dispatch({ type: 'RESET_SESSION' });
    clearStoredSession().catch(() => undefined);
  }, []);

  const setCurrentStep = useCallback((step: DiagnosticStep) => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: step });
  }, []);

  const setEquipmentSource = useCallback((source: EquipmentSource) => {
    dispatch({ type: 'SET_EQUIPMENT_SOURCE', payload: source });
  }, []);

  const updateManualEquipment = useCallback((payload: ManualEquipmentDraft) => {
    dispatch({ type: 'UPDATE_MANUAL_EQUIPMENT', payload });
  }, []);

  const setCapture = useCallback((capture: EquipmentCapture) => {
    dispatch({ type: 'SET_CAPTURE', payload: capture });
  }, []);

  const applyExtraction = useCallback((payload: ExtractionPayload) => {
    dispatch({ type: 'APPLY_EXTRACTION', payload });
  }, []);

  const applyEnrichment = useCallback((payload: EnrichmentPayload) => {
    dispatch({ type: 'APPLY_ENRICHMENT', payload });
  }, []);

  const setSystemType = useCallback((systemType: SystemTypeId) => {
    dispatch({ type: 'SET_SYSTEM_TYPE', payload: systemType });
  }, []);

  const setIndoorPlatform = useCallback((platform: IndoorPlatformId) => {
    dispatch({ type: 'SET_INDOOR_PLATFORM', payload: platform });
  }, []);

  const setIssue = useCallback((issue: IssueId) => {
    dispatch({ type: 'SET_ISSUE', payload: issue });
  }, []);

  const setFlowControl = useCallback((payload: FlowControlPayload) => {
    dispatch({ type: 'SET_FLOW_CONTROL', payload });
  }, []);

  const setGateAnswer = useCallback(
    <K extends keyof GateAnswers>(key: K, value: GateAnswers[K]) => {
      dispatch({ type: 'SET_GATE_ANSWER', key, value });
    },
    []
  );

  const setMeasurement = useCallback(
    <K extends MeasurementKey>(key: K, value: SystemMeasurements[K]) => {
      dispatch({ type: 'SET_MEASUREMENT', key, value });
    },
    []
  );

  const setDiagAnswer = useCallback(
    <K extends keyof DiagnosticAnswers>(key: K, value: DiagnosticAnswers[K]) => {
      dispatch({ type: 'SET_DIAG_ANSWER', key, value });
    },
    []
  );

  const setResolvedRoute = useCallback(
    (
      route: DiagnosticRouteId | null,
      reasons: string[],
      confidence: number,
      stage?: RouteHistoryEntry['stage']
    ) => {
      dispatch({
        type: 'SET_ROUTE',
        payload: route
          ? {
              route,
              stage: stage ?? (session.currentRoute ? 'secondary' : 'primary'),
              reasons,
              confidence,
              timestamp: now(),
            }
          : null,
      });
    },
    [session.currentRoute]
  );

  const setResults = useCallback((result: DiagnosticResult | null) => {
    dispatch({ type: 'SET_RESULTS', payload: result });
  }, []);

  const setCopilotPanel = useCallback(
    (payload: { isExpanded?: boolean; activeTab?: CopilotTabId }) => {
      dispatch({ type: 'SET_COPILOT_PANEL', payload });
    },
    []
  );

  const refreshCopilot = useCallback(async () => {
    const nextState = await generateCopilotPassiveUpdate(session, session.copilot);

    if (nextState !== session.copilot) {
      dispatch({ type: 'SET_COPILOT_STATE', payload: nextState });
    }
  }, [session]);

  const sendCopilotMessage = useCallback(
    async (message: string) => {
      const nextState = await generateCopilotReply(session, session.copilot, message);

      if (nextState !== session.copilot) {
        dispatch({ type: 'SET_COPILOT_STATE', payload: nextState });
      }
    },
    [session]
  );

  const markCompleted = useCallback(() => {
    dispatch({ type: 'MARK_COMPLETED' });
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      isHydrated,
      startNewSession,
      resetSession,
      setCurrentStep,
      setEquipmentSource,
      updateManualEquipment,
      setCapture,
      applyExtraction,
      applyEnrichment,
      setSystemType,
      setIndoorPlatform,
      setIssue,
      setFlowControl,
      setGateAnswer,
      setMeasurement,
      setDiagAnswer,
      setResolvedRoute,
      setResults,
      setCopilotPanel,
      refreshCopilot,
      sendCopilotMessage,
      markCompleted,
    }),
    [
      session,
      isHydrated,
      startNewSession,
      resetSession,
      setCurrentStep,
      setEquipmentSource,
      updateManualEquipment,
      setCapture,
      applyExtraction,
      applyEnrichment,
      setSystemType,
      setIndoorPlatform,
      setIssue,
      setFlowControl,
      setGateAnswer,
      setMeasurement,
      setDiagAnswer,
      setResolvedRoute,
      setResults,
      setCopilotPanel,
      refreshCopilot,
      sendCopilotMessage,
      markCompleted,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }

  return context;
}
