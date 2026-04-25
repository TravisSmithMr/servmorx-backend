export type SessionStatus = 'draft' | 'active' | 'completed';

export type DiagnosticStep =
  | 'home'
  | 'equipment-intake'
  | 'scan-equipment'
  | 'equipment-confirmation'
  | 'manual-equipment'
  | 'system-type'
  | 'split-system-follow-up'
  | 'issue-selection'
  | 'gate-questions'
  | 'focused-diagnostic'
  | 'results';

export type EquipmentSource = 'manual' | 'scan' | 'crm' | 'imported' | null;

export type SystemTypeId =
  | 'split_system_ac'
  | 'heat_pump'
  | 'furnace'
  | 'package_unit'
  | 'mini_split'
  | 'commercial_rtu'
  | 'refrigeration'
  | 'boiler'
  | 'not_sure';

export type IndoorPlatformId = 'air_handler' | 'furnace' | 'not_sure';

export type IssueId =
  | 'no_cooling'
  | 'outdoor_unit_not_running'
  | 'weak_cooling'
  | 'no_airflow'
  | 'weak_airflow'
  | 'icing_frozen_coil'
  | 'system_not_doing_anything'
  | 'short_cycling'
  | 'other';

export type TriStateAnswer = 'yes' | 'no' | 'not_sure';

export type BlowerTypeAnswer = 'psc' | 'ecm' | 'not_sure';
export type AirflowStrengthAnswer = 'strong' | 'weak' | 'none' | 'not_sure';
export type FilterConditionAnswer = 'clean' | 'dirty' | 'not_sure';
export type IceLocationAnswer = 'indoor_coil' | 'outdoor_unit' | 'lineset' | 'not_sure';
export type OutdoorUnitNoiseAnswer = 'none' | 'humming' | 'clicking' | 'buzzing' | 'not_sure';
export type BreakerDisconnectStatusAnswer = 'on' | 'off' | 'tripped' | 'not_sure';

export type DiagnosticRouteId =
  | 'thermostat_control_diag'
  | 'indoor_unit_diag'
  | 'outdoor_unit_diag'
  | 'airflow_restriction_diag'
  | 'refrigeration_diag'
  | 'icing_diag'
  | 'low_voltage_diag'
  | 'line_voltage_diag'
  | 'safety_open_diag'
  | 'blower_diag'
  | 'compressor_diag'
  | 'condenser_fan_diag'
  | 'board_control_diag'
  | 'fallback_diagnostic';

export type RouteStage = 'primary' | 'secondary';

export type WarrantyStatus = 'unknown' | 'in_warranty' | 'out_of_warranty' | 'check_required';

export type NoAirflowGateKey =
  | 'thermostatCalling'
  | 'indoorFanRunning'
  | 'indoorUnitPower'
  | 'boardFaultLights'
  | 'blowerType';

export type NoCoolingGateKey =
  | 'thermostatCalling'
  | 'indoorFanRunning'
  | 'airflowStrength'
  | 'outdoorUnitRunning'
  | 'condenserFanRunning'
  | 'compressorRunning'
  | 'contactorEngaged';

export type WeakCoolingGateKey =
  | 'airflowStrength'
  | 'outdoorUnitRunning'
  | 'indoorFanRunning'
  | 'icingPresent'
  | 'filterCondition';

export type SystemIdleGateKey =
  | 'thermostatPowered'
  | 'thermostatCalling'
  | 'indoorUnitPower'
  | 'outdoorUnitPower'
  | 'breakerDisconnectStatus'
  | 'lowVoltagePresent'
  | 'breakerDisconnectKnown';

export type IcingGateKey =
  | 'iceLocation'
  | 'restrictionObserved'
  | 'filterCondition'
  | 'indoorFanRunning'
  | 'outdoorUnitRunning';

export type OutdoorUnitNotRunningGateKey =
  | 'indoorFanRunning'
  | 'thermostatCalling'
  | 'contactorEngaged'
  | 'outdoorUnitNoise'
  | 'breakerDisconnectStatus';

export type IndoorUnitDiagKey =
  | 'highVoltagePresent'
  | 'boardFaultLights'
  | 'blowerCallPresent'
  | 'capacitorCondition'
  | 'ecmModuleClues';

export type OutdoorUnitDiagKey =
  | 'contactorEngaged'
  | 'contactorCoilVoltagePresent'
  | 'outdoorPowerPresent'
  | 'disconnectOn'
  | 'fanOnlyRunning'
  | 'compressorOnlyRunning'
  | 'outdoorLoadsBothOff';

export type LowVoltageDiagKey =
  | 'transformerOutputPresent'
  | 'lowVoltageFuseIntact'
  | 'callLeavingIndoorBoard'
  | 'wireContinuityToOutdoor'
  | 'safetyCircuitClosed';

export type LineVoltageDiagKey =
  | 'breakerOrDisconnectOn'
  | 'lineVoltageAtDisconnect'
  | 'lineVoltageAtContactorLineSide'
  | 'lineVoltageAtContactorLoadSide'
  | 'fusesIntact';

export type BlowerDiagKey =
  | 'blowerMotorResponding'
  | 'blowerCapacitorFailed'
  | 'blowerWheelRestricted'
  | 'ecmPowerPresent'
  | 'ecmCommunicationPresent';

export type CompressorDiagKey =
  | 'compressorAmpDrawPresent'
  | 'compressorCapacitorFailed'
  | 'compressorOverloadOpen'
  | 'compressorWindingIssue';

export type CondenserFanDiagKey =
  | 'fanMotorVoltagePresent'
  | 'fanCapacitorFailed'
  | 'fanBladeSpinsFreely'
  | 'fanMotorOveramping';

export type GateAnswers = {
  thermostatCalling?: TriStateAnswer;
  thermostatPowered?: TriStateAnswer;
  indoorFanRunning?: TriStateAnswer;
  indoorUnitPower?: TriStateAnswer;
  outdoorUnitPower?: TriStateAnswer;
  boardFaultLights?: TriStateAnswer;
  blowerType?: BlowerTypeAnswer;
  airflowStrength?: AirflowStrengthAnswer;
  filterCondition?: FilterConditionAnswer;
  iceLocation?: IceLocationAnswer;
  outdoorUnitNoise?: OutdoorUnitNoiseAnswer;
  breakerDisconnectStatus?: BreakerDisconnectStatusAnswer;
  outdoorUnitRunning?: TriStateAnswer;
  condenserFanRunning?: TriStateAnswer;
  compressorRunning?: TriStateAnswer;
  contactorEngaged?: TriStateAnswer;
  icingPresent?: TriStateAnswer;
  restrictionObserved?: TriStateAnswer;
  breakerDisconnectKnown?: TriStateAnswer;
  lowVoltagePresent?: TriStateAnswer;
};

export type IndoorUnitDiagAnswers = {
  highVoltagePresent?: TriStateAnswer;
  boardFaultLights?: TriStateAnswer;
  blowerCallPresent?: TriStateAnswer;
  capacitorCondition?: 'good' | 'failed' | 'not_checked' | 'not_sure';
  ecmModuleClues?: 'module_dead' | 'intermittent' | 'power_issue' | 'not_sure';
};

export type OutdoorUnitDiagAnswers = {
  contactorEngaged?: TriStateAnswer;
  contactorCoilVoltagePresent?: TriStateAnswer;
  outdoorPowerPresent?: TriStateAnswer;
  disconnectOn?: TriStateAnswer;
  fanOnlyRunning?: TriStateAnswer;
  compressorOnlyRunning?: TriStateAnswer;
  outdoorLoadsBothOff?: TriStateAnswer;
};

export type LowVoltageDiagAnswers = {
  transformerOutputPresent?: TriStateAnswer;
  lowVoltageFuseIntact?: TriStateAnswer;
  callLeavingIndoorBoard?: TriStateAnswer;
  wireContinuityToOutdoor?: TriStateAnswer;
  safetyCircuitClosed?: TriStateAnswer;
};

export type LineVoltageDiagAnswers = {
  breakerOrDisconnectOn?: TriStateAnswer;
  lineVoltageAtDisconnect?: TriStateAnswer;
  lineVoltageAtContactorLineSide?: TriStateAnswer;
  lineVoltageAtContactorLoadSide?: TriStateAnswer;
  fusesIntact?: TriStateAnswer;
};

export type BlowerDiagAnswers = {
  blowerMotorResponding?: TriStateAnswer;
  blowerCapacitorFailed?: TriStateAnswer;
  blowerWheelRestricted?: TriStateAnswer;
  ecmPowerPresent?: TriStateAnswer;
  ecmCommunicationPresent?: TriStateAnswer;
};

export type CompressorDiagAnswers = {
  compressorAmpDrawPresent?: TriStateAnswer;
  compressorCapacitorFailed?: TriStateAnswer;
  compressorOverloadOpen?: TriStateAnswer;
  compressorWindingIssue?: TriStateAnswer;
};

export type CondenserFanDiagAnswers = {
  fanMotorVoltagePresent?: TriStateAnswer;
  fanCapacitorFailed?: TriStateAnswer;
  fanBladeSpinsFreely?: TriStateAnswer;
  fanMotorOveramping?: TriStateAnswer;
};

export type DiagnosticAnswers = IndoorUnitDiagAnswers &
  OutdoorUnitDiagAnswers &
  LowVoltageDiagAnswers &
  LineVoltageDiagAnswers &
  BlowerDiagAnswers &
  CompressorDiagAnswers &
  CondenserFanDiagAnswers;

export type ResultConfidenceLevel = 'high' | 'medium' | 'low';
export type AnalyticsStatus = 'normal' | 'low' | 'high' | 'mixed' | 'insufficient';
export type CopilotMessageRole = 'assistant' | 'user';
export type CopilotMessageKind = 'auto' | 'user' | 'reply';
export type CopilotTabId = 'copilot' | 'analytics';

export interface RouteHistoryEntry {
  route: DiagnosticRouteId;
  stage: RouteStage;
  reasons: string[];
  confidence: number;
  timestamp: string;
}

export interface DiagnosticCause {
  title: string;
  why: string;
  nextCheck: string;
}

export interface DiagnosticResult {
  route: DiagnosticRouteId;
  primaryRoute?: DiagnosticRouteId | null;
  secondaryRoute?: DiagnosticRouteId | null;
  summary: string;
  routeReasons: string[];
  routeSwapReason?: string | null;
  confidenceLevel: ResultConfidenceLevel;
  likelyCauses: DiagnosticCause[];
  nextChecks: string[];
  contradictions?: string[];
  missingInfo?: string[];
}

export interface SystemMeasurements {
  suctionPressure: number | null;
  liquidPressure: number | null;
  suctionLineTemp: number | null;
  liquidLineTemp: number | null;
  outdoorAmbientTemp: number | null;
  indoorReturnTemp: number | null;
  indoorSupplyTemp: number | null;
  superheat: number | null;
  subcool: number | null;
}

export type MeasurementKey = keyof SystemMeasurements;

export interface AnalyticsSignal {
  id: string;
  label: string;
  status: AnalyticsStatus;
  value: string;
  note: string;
}

export interface AnalyticsSummary {
  refrigerant: string | null;
  deltaT: number | null;
  pressureSpread: number | null;
  lineTempSpread: number | null;
  saturatedSuctionTemp: number | null;
  saturatedLiquidTemp: number | null;
  calculatedSuperheat: number | null;
  calculatedSubcool: number | null;
  signals: AnalyticsSignal[];
  interpretation: string[];
  missingData: string[];
}

export interface CopilotInsight {
  summary: string;
  direction: string;
  followUpQuestion: string;
  nextBestTests: string[];
}

export interface CopilotMessage {
  id: string;
  role: CopilotMessageRole;
  kind: CopilotMessageKind;
  text: string;
  createdAt: string;
}

export interface CopilotState {
  provider: string;
  providerPath: OcrProviderPath;
  providerStatus: string | null;
  usedFallback: boolean;
  lastContextHash: string | null;
  isExpanded: boolean;
  activeTab: CopilotTabId;
  quickPrompts: string[];
  activeInsight: CopilotInsight | null;
  messages: CopilotMessage[];
}

export interface EquipmentCapture {
  uri: string;
  fileName: string | null;
  width?: number;
  height?: number;
  mimeType?: string;
  capturedAt: string;
}

export interface SpecData {
  nominalTonnage?: string;
  refrigerant?: string;
  voltage?: string;
  notes?: string;
}

export type OcrProviderPath =
  | 'backend_proxy'
  | 'real_provider'
  | 'fallback_provider'
  | 'mock_provider'
  | null;

export interface ScanDebugData {
  normalizedOcrText: string | null;
  ocrProviderPath: OcrProviderPath;
  ocrProviderStatus: string | null;
  backendUrl: string | null;
  httpStatus: number | null;
  rawBackendResponse: string | null;
  errorMessage: string | null;
  openAiError: boolean | null;
  brandCandidates: string[];
  modelCandidates: string[];
  serialCandidates: string[];
  confidenceSignals: string[];
  failureReason: string | null;
}

export interface RouteResolution {
  route: DiagnosticRouteId | null;
  stage: RouteStage;
  primaryRoute: DiagnosticRouteId | null;
  secondaryRoute: DiagnosticRouteId | null;
  confidence: number;
  reasons: string[];
  possibleNextRoutes: DiagnosticRouteId[];
  shouldAskFocusedDiagnostic: boolean;
}

export interface InferredValues {
  systemType: SystemTypeId | null;
  indoorPlatform: IndoorPlatformId | null;
  detectedUnitType: string | null;
}

export interface ConfirmedValues {
  equipment: boolean;
  systemType: boolean;
  indoorPlatform: boolean;
}

export interface DiagnosticSession {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  currentStep: DiagnosticStep;
  equipmentSource: EquipmentSource;
  systemType: SystemTypeId | null;
  indoorPlatform: IndoorPlatformId | null;
  issue: IssueId | null;
  gateAnswers: GateAnswers;
  diagAnswers: DiagnosticAnswers;
  currentRoute: DiagnosticRouteId | null;
  routeHistory: RouteHistoryEntry[];
  brand: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  detectedUnitType: string | null;
  detectedSystemType: SystemTypeId | null;
  extractionConfidence: number | null;
  ocrText: string | null;
  ocrProvider: string | null;
  scanDebug: ScanDebugData;
  inferredValues: InferredValues;
  confirmedValues: ConfirmedValues;
  skippedQuestions: string[];
  specData: SpecData | null;
  warrantyStatus: WarrantyStatus;
  warrantyDetails: string | null;
  commonFaults: string[];
  notes: string;
  linkedJobId: string | null;
  linkedCustomerId: string | null;
  linkedEquipmentId: string | null;
  capture: EquipmentCapture | null;
  measurements: SystemMeasurements;
  copilot: CopilotState;
  likelyCauses: DiagnosticCause[];
  nextChecks: string[];
  results: DiagnosticResult | null;
}
