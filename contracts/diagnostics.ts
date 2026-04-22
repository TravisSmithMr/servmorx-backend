import type {
  AnalyticsSummary,
  CopilotInsight,
  DiagnosticCause,
  ResultConfidenceLevel,
} from '@/types/diagnostic';

export interface DiagnosticsEquipmentContext {
  brand: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  systemType: string | null;
  indoorPlatform: string | null;
}

export interface DiagnosticsContextPayload {
  issue: string | null;
  route: string | null;
  equipment: DiagnosticsEquipmentContext;
  gateAnswers: Record<string, unknown>;
  diagAnswers: Record<string, unknown>;
  likelyCauses: DiagnosticCause[];
  routeConfidence: number | null;
  resultConfidence: ResultConfidenceLevel | null;
  routeReasons: string[];
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
  insight: CopilotInsight;
  quickPrompts: string[];
  messageText: string;
}

export interface DiagnosticsAnalyzeSystemRequest {
  context: Pick<DiagnosticsContextPayload, 'issue' | 'route' | 'equipment'>;
  measurements: Record<string, number | null>;
}

export interface DiagnosticsAnalyzeSystemResponse {
  analytics: AnalyticsSummary;
}
