import type { DiagnosticSession, RouteResolution } from '@/types/diagnostic';

function buildResolution(
  route: RouteResolution['route'],
  confidence: number,
  reasons: string[],
  possibleNextRoutes: RouteResolution['possibleNextRoutes'],
  shouldAskFocusedDiagnostic: boolean
): RouteResolution {
  return {
    route,
    stage: 'primary',
    primaryRoute: route,
    secondaryRoute: null,
    confidence,
    reasons,
    possibleNextRoutes,
    shouldAskFocusedDiagnostic,
  };
}

export function resolveNoCoolingRoute(session: DiagnosticSession): RouteResolution {
  const {
    thermostatCalling,
    indoorFanRunning,
    airflowStrength,
    outdoorUnitRunning,
    condenserFanRunning,
    compressorRunning,
    contactorEngaged,
  } = session.gateAnswers;
  const outdoorBias = session.detectedUnitType === 'condensing_unit';

  if (thermostatCalling === 'no') {
    return buildResolution(
      'thermostat_control_diag',
      0.93,
      ['Thermostat is not calling for cooling, so the first fault lane stays in the control path.'],
      ['indoor_unit_diag', 'low_voltage_diag'],
      false
    );
  }

  if (indoorFanRunning === 'no') {
    return buildResolution(
      'indoor_unit_diag',
      0.9,
      ['Indoor blower is not running, so the indoor side must be resolved before condemning the condenser.'],
      ['thermostat_control_diag', 'airflow_restriction_diag'],
      true
    );
  }

  if (indoorFanRunning === 'yes' && outdoorUnitRunning === 'no') {
    return buildResolution(
      'outdoor_unit_diag',
      outdoorBias ? 0.96 : 0.92,
      [
        'Indoor blower is running but the outdoor unit is not responding.',
        ...(outdoorBias ? ['Detected equipment context also points toward the outdoor section.'] : []),
      ],
      ['board_control_diag', 'compressor_diag'],
      true
    );
  }

  if (
    indoorFanRunning === 'yes' &&
    outdoorUnitRunning === 'yes' &&
    airflowStrength === 'strong'
  ) {
    return buildResolution(
      'refrigeration_diag',
      0.86,
      ['Indoor and outdoor sections are both running with usable airflow, so the next branch is refrigeration performance.'],
      ['airflow_restriction_diag', 'outdoor_unit_diag'],
      false
    );
  }

  if (
    outdoorUnitRunning === 'yes' &&
    (condenserFanRunning === 'no' || compressorRunning === 'no' || contactorEngaged === 'no')
  ) {
    return buildResolution(
      'outdoor_unit_diag',
      0.84,
      ['Outdoor operating details point toward a condenser-side fault that needs focused checks next.'],
      ['compressor_diag', 'board_control_diag'],
      true
    );
  }

  if (airflowStrength === 'weak' || airflowStrength === 'none') {
    return buildResolution(
      'airflow_restriction_diag',
      0.68,
      ['Weak or missing vent airflow reduces confidence in a pure condenser fault and keeps airflow in play.'],
      ['indoor_unit_diag', 'refrigeration_diag'],
      false
    );
  }

  return buildResolution(
    'outdoor_unit_diag',
    0.52,
    ['No Cooling still leans outdoor once the indoor blower is confirmed running and no better branch is established.'],
    ['refrigeration_diag', 'indoor_unit_diag'],
    true
  );
}
