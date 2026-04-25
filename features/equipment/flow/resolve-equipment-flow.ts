import type {
  DiagnosticSession,
  IndoorPlatformId,
  SystemTypeId,
} from '@/types/diagnostic';

const HIGH_CONFIDENCE_THRESHOLD = 0.78;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.48;

export type ExtractionConfidenceLevel = 'high' | 'medium' | 'low';

export function getExtractionConfidenceLevel(confidence: number | null): ExtractionConfidenceLevel {
  if (confidence !== null && confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    return 'high';
  }

  if (confidence !== null && confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
    return 'medium';
  }

  return 'low';
}

export function inferIndoorPlatformFromUnitType(
  detectedUnitType: string | null
): IndoorPlatformId | null {
  if (!detectedUnitType) {
    return null;
  }

  if (detectedUnitType === 'air_handler') {
    return 'air_handler';
  }

  if (detectedUnitType === 'furnace') {
    return 'furnace';
  }

  return null;
}

export function isSystemTypeConfident(session: DiagnosticSession) {
  return Boolean(session.detectedSystemType && getExtractionConfidenceLevel(session.extractionConfidence) === 'high');
}

export function inferSystemTypeFromSession(session: DiagnosticSession): SystemTypeId | null {
  return session.detectedSystemType ?? session.inferredValues.systemType ?? null;
}

export function buildEquipmentFlowDecision(session: DiagnosticSession) {
  const inferredSystemType = inferSystemTypeFromSession(session);
  const inferredIndoorPlatform =
    session.inferredValues.indoorPlatform ?? inferIndoorPlatformFromUnitType(session.detectedUnitType);
  const skippedQuestions: string[] = [];
  const confidenceLevel = getExtractionConfidenceLevel(session.extractionConfidence);
  const shouldFallbackToManual = confidenceLevel === 'low';

  if (confidenceLevel === 'high' && inferredSystemType) {
    skippedQuestions.push('system-type');
  }

  if (
    inferredSystemType === 'split_system_ac' &&
    inferredIndoorPlatform &&
    confidenceLevel === 'high'
  ) {
    skippedQuestions.push('split-system-follow-up');
  }

  const nextScreen =
    shouldFallbackToManual
      ? '/manual-equipment'
      : skippedQuestions.includes('system-type')
      ? skippedQuestions.includes('split-system-follow-up') || inferredSystemType !== 'split_system_ac'
        ? '/issue-selection'
        : '/split-system-follow-up'
      : '/system-type';

  return {
    confidenceLevel,
    inferredSystemType,
    inferredIndoorPlatform,
    skippedQuestions,
    shouldFallbackToManual,
    nextScreen,
  } as const;
}
