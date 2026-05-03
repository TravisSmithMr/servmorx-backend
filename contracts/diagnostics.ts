import type {
  AnalyticsSummary,
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
  selectedIssue?: string | null;
  stage?: string | null;
  currentStage?: string | null;
  diagnosticStage?:
    | 'initial'
    | 'operation_check'
    | 'airflow_check'
    | 'electrical_check'
    | 'refrigeration_check'
    | 'verification'
    | 'diagnosis';
  candidateQuestions?: Array<{
    questionId: string;
    question: string;
    answerType: string;
    answerOptions: string[];
  }>;
  latestTechnicianMessage?: string | null;
  currentConfidence?: number | null;
  likelyPath?: string | null;
  answerType?: string | null;
  answerOptions?: string[];
  previousQuestionsAsked?: string[];
  askedQuestions?: string[];
  answeredQuestions?: Record<string, unknown>;
  currentQuestionId?: string | null;
  measurementValues?: Record<string, number>;
  measurements?: Record<string, unknown>;
  route: string | null;
  equipment: DiagnosticsEquipmentContext;
  job?: {
    customerName?: string;
    jobId?: string;
    location?: string;
    equipmentId?: string;
  };
  followUpAnswers?: Record<string, unknown>;
  techNotes?: string[];
  knownFacts?: string[];
  unknowns?: string[];
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
  insight: string;
  quickPrompts: string[];
  messageText: string;
  interpretation?: string;
  reasoningSummary?: string;
  nextQuestion?: string | null;
  nextBestQuestion?: string;
  nextQuestionId?: string;
  nextBestCheck?: string;
  nextStep?: string;
  followUpQuestion?: string | null;
  likelyPath?: string;
  answerType?: 'singleChoice' | 'yesNo' | 'numeric' | 'freeText' | 'groupedMeasurementSet';
  answerOptions?: string[];
  missingInfo?: string[];
  confidence?: number;
  suggestedStage?: string;
  cautions?: string[];
  stopAndDiagnose?: boolean;
  diagnosisResult?: {
    mostLikely: {
      label: string;
      confidence: number;
    };
    confidence?: number;
    secondary: Array<{
      label: string;
      confidence: number;
    }>;
    reasoning?: string;
    nextSteps?: string[];
    whatWouldConfirm?: string[];
    whatWouldRuleOut?: string[];
    missingInfo?: string[];
    confidenceLabel: 'High' | 'Medium' | 'Low';
    recommendedActions?: string[];
    estimatedRange?: string;
  };
  error?: boolean;
}

export interface DiagnosticsAnalyzeSystemRequest {
  context: Pick<DiagnosticsContextPayload, 'issue' | 'route' | 'equipment'>;
  measurements: Record<string, number | null>;
}

export interface DiagnosticsAnalyzeSystemResponse {
  analytics: AnalyticsSummary;
}
