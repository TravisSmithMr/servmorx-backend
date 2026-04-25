import {
  blowerDiagQuestions,
  condenserFanDiagQuestions,
  lineVoltageQuestions,
  lowVoltageQuestions,
  compressorDiagQuestions,
  routeLabels,
} from '@/features/diagnostic/config';
import type { DiagnosticRouteId, DiagnosticSession } from '@/types/diagnostic';

export interface SecondaryRouteConfig {
  route: DiagnosticRouteId;
  title: string;
  subtitle: string;
  helper: string;
  questions: typeof lowVoltageQuestions;
}

function getBlowerQuestions(session: DiagnosticSession) {
  const blowerType = session.gateAnswers.blowerType ?? 'not_sure';

  return blowerDiagQuestions.filter((question) => {
    if (question.key === 'blowerCapacitorFailed') {
      return blowerType === 'psc' || blowerType === 'not_sure';
    }

    if (question.key === 'ecmPowerPresent' || question.key === 'ecmCommunicationPresent') {
      return blowerType === 'ecm' || blowerType === 'not_sure';
    }

    return true;
  });
}

export function getSecondaryRouteConfig(
  session: DiagnosticSession,
  route: DiagnosticRouteId | null
): SecondaryRouteConfig | null {
  if (!route) {
    return null;
  }

  switch (route) {
    case 'low_voltage_diag':
      return {
        route,
        title: 'Low voltage diagnostics',
        subtitle: 'Stay on the 24V call path before widening back out.',
        helper: 'Confirm transformer, fuse, call handoff, field wiring, and safeties in order.',
        questions: lowVoltageQuestions,
      };
    case 'line_voltage_diag':
      return {
        route,
        title: 'Line voltage diagnostics',
        subtitle: 'The equipment is being commanded, but power delivery is still in doubt.',
        helper: 'Confirm breaker, disconnect, line-side, load-side, and fuse status.',
        questions: lineVoltageQuestions,
      };
    case 'blower_diag':
      return {
        route,
        title: 'Blower diagnostics',
        subtitle: 'The indoor branch is narrowed to the motor and drive side.',
        helper: `Current narrow route: ${routeLabels[route]}.`,
        questions: getBlowerQuestions(session),
      };
    case 'compressor_diag':
      return {
        route,
        title: 'Compressor diagnostics',
        subtitle: 'The outdoor branch is narrowed to the compressor side.',
        helper: 'Use amp draw, capacitor, overload, and winding clues before condemning the compressor.',
        questions: compressorDiagQuestions,
      };
    case 'condenser_fan_diag':
      return {
        route,
        title: 'Condenser fan diagnostics',
        subtitle: 'The outdoor branch is narrowed to the fan side.',
        helper: 'Use voltage, capacitor, blade drag, and overamping clues to confirm the fan path.',
        questions: condenserFanDiagQuestions,
      };
    default:
      return null;
  }
}
