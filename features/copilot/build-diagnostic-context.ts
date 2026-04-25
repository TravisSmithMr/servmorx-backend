import { analyzeSystemPerformance } from '@/core/analytics-engine';
import { generateResults } from '@/core/result-engine';
import { getPrimaryRoute, getRouteReasons, getRouteSwapReason, getSecondaryRoute } from '@/features/diagnostic/route-utils';
import type { DiagnosticResult, DiagnosticSession } from '@/types/diagnostic';

export interface DiagnosticContext {
  hash: string;
  issue: string | null;
  route: string | null;
  primaryRoute: string | null;
  secondaryRoute: string | null;
  equipment: {
    brand: string | null;
    modelNumber: string | null;
    serialNumber: string | null;
    systemType: string | null;
    indoorPlatform: string | null;
    refrigerant?: string | null;
  };
  gateAnswers: DiagnosticSession['gateAnswers'];
  diagAnswers: DiagnosticSession['diagAnswers'];
  likelyCauses: DiagnosticResult['likelyCauses'];
  routeConfidence: number | null;
  resultConfidence: DiagnosticResult['confidenceLevel'] | null;
  routeReasons: string[];
  routeSwapReason: string | null;
  contradictions: string[];
  missingDataFlags: string[];
  analytics: ReturnType<typeof analyzeSystemPerformance>;
  result: DiagnosticResult | null;
}

function titleCase(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildContradictions(session: DiagnosticSession) {
  const contradictions: string[] = [];

  if (session.gateAnswers.thermostatCalling === 'no' && session.gateAnswers.contactorEngaged === 'yes') {
    contradictions.push('Thermostat call is marked no, but the contactor is marked pulled in.');
  }

  if (session.gateAnswers.indoorFanRunning === 'no' && session.gateAnswers.airflowStrength === 'strong') {
    contradictions.push('Indoor fan is marked not running, but airflow is marked strong.');
  }

  if (
    session.gateAnswers.outdoorUnitRunning === 'no' &&
    (session.gateAnswers.condenserFanRunning === 'yes' || session.gateAnswers.compressorRunning === 'yes')
  ) {
    contradictions.push('Outdoor unit is marked off, but one or more outdoor loads are marked running.');
  }

  if (
    session.gateAnswers.contactorEngaged &&
    session.diagAnswers.contactorEngaged &&
    session.gateAnswers.contactorEngaged !== session.diagAnswers.contactorEngaged
  ) {
    contradictions.push('Gate contactor answer conflicts with the focused outdoor diagnostic answer.');
  }

  return contradictions;
}

function buildMissingFlags(session: DiagnosticSession, result: DiagnosticResult | null) {
  const flags: string[] = [];

  if (!session.issue) {
    flags.push('Issue lane not selected.');
  }

  if (!session.currentRoute) {
    flags.push('Structured route not resolved yet.');
  }

  if (session.currentRoute === 'outdoor_unit_diag' && !session.diagAnswers.outdoorPowerPresent) {
    flags.push('Outdoor line voltage not confirmed.');
  }

  if (session.currentRoute === 'indoor_unit_diag' && !session.diagAnswers.highVoltagePresent) {
    flags.push('Indoor line voltage not confirmed.');
  }

  if (result && result.nextChecks.length === 0) {
    flags.push('No confirming checks have been generated yet.');
  }

  return flags;
}

export function buildDiagnosticContext(session: DiagnosticSession): DiagnosticContext {
  const analytics = analyzeSystemPerformance(session);
  const result = session.results ?? (session.currentRoute ? generateResults(session) : null);
  const contradictions = result?.contradictions ?? buildContradictions(session);
  const missingDataFlags = result?.missingInfo ?? [...buildMissingFlags(session, result), ...analytics.missingData];
  const primaryRoute = getPrimaryRoute(session);
  const secondaryRoute = getSecondaryRoute(session);
  const routeReasons = result?.routeReasons ?? getRouteReasons(session);
  const routeSwapReason = result?.routeSwapReason ?? getRouteSwapReason(session);

  const hash = JSON.stringify({
    issue: session.issue,
    route: session.currentRoute,
    primaryRoute,
    secondaryRoute,
    gateAnswers: session.gateAnswers,
    diagAnswers: session.diagAnswers,
    brand: session.brand,
    modelNumber: session.modelNumber,
    systemType: session.systemType,
    indoorPlatform: session.indoorPlatform,
    likelyCauses: result?.likelyCauses,
    confidence: result?.confidenceLevel,
    contradictions,
    missingDataFlags,
    analytics,
    routeSwapReason,
  });

  return {
    hash,
    issue: titleCase(session.issue),
    route: titleCase(session.currentRoute),
    primaryRoute: titleCase(primaryRoute),
    secondaryRoute: titleCase(secondaryRoute),
    equipment: {
      brand: session.brand,
      modelNumber: session.modelNumber,
      serialNumber: session.serialNumber,
      systemType: titleCase(session.systemType),
      indoorPlatform: titleCase(session.indoorPlatform),
      refrigerant: session.specData?.refrigerant ?? null,
    },
    gateAnswers: session.gateAnswers,
    diagAnswers: session.diagAnswers,
    likelyCauses: result?.likelyCauses ?? [],
    routeConfidence:
      [...session.routeHistory].reverse().find((entry) => entry.route === session.currentRoute)?.confidence ??
      null,
    resultConfidence: result?.confidenceLevel ?? null,
    routeReasons,
    routeSwapReason,
    contradictions,
    missingDataFlags,
    analytics,
    result,
  };
}
