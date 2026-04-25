import type {
  AnalyticsSummary,
  CopilotInsight,
  DiagnosticCause,
  OcrProviderPath,
  ResultConfidenceLevel,
} from '@/types/diagnostic';

export interface DiagnosticsEquipmentContext {
  brand: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  systemType: string | null;
  indoorPlatform: string | null;
  refrigerant?: string | null;
}

export interface DiagnosticsContextPayload {
  issue: string | null;
  route: string | null;
  primaryRoute?: string | null;
  secondaryRoute?: string | null;
  equipment: DiagnosticsEquipmentContext;
  gateAnswers: Record<string, unknown>;
  diagAnswers: Record<string, unknown>;
  likelyCauses: DiagnosticCause[];
  routeConfidence: number | null;
  resultConfidence: ResultConfidenceLevel | null;
  routeReasons: string[];
  routeSwapReason?: string | null;
  contradictions: string[];
  missingDataFlags: string[];
  analytics: AnalyticsSummary;
}

export interface DiagnosticsCopilotRequest {
  context: DiagnosticsContextPayload;
  message?: string | null;
}

export interface DiagnosticsCopilotResponse {
  provider: string;
  providerPath: OcrProviderPath;
  providerStatus: string;
  usedFallback: boolean;
  insight: CopilotInsight;
  quickPrompts: string[];
  messageText: string;
}

export interface DiagnosticsAnalyzeSystemRequest {
  context: Pick<DiagnosticsContextPayload, 'issue' | 'route' | 'equipment'>;
  measurements: Record<string, number | null>;
}

export interface DiagnosticsAnalyzeSystemResponse {
  provider: string;
  providerPath: OcrProviderPath;
  providerStatus: string;
  usedFallback: boolean;
  analytics: AnalyticsSummary;
}
