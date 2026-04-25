import { resolveNoCoolingRoute } from '@/features/diagnostics/no-cooling/no-cooling-flow';
import { resolveWeakCoolingRoute } from '@/features/diagnostics/weak-cooling/weak-cooling-flow';
import { resolveSystemIdleRoute } from '@/features/diagnostics/system-idle/system-idle-flow';
import { resolveIcingRoute } from '@/features/diagnostics/icing/icing-flow';
import { resolveOutdoorUnitNotRunningRoute } from '@/features/diagnostics/outdoor-unit-not-running/outdoor-unit-not-running-flow';
import type { DiagnosticRouteId, DiagnosticSession, RouteResolution, RouteStage } from '@/types/diagnostic';

type IssueResolver = (session: DiagnosticSession) => RouteResolution;

function buildResolution(
  route: RouteResolution['route'],
  confidence: number,
  reasons: string[],
  possibleNextRoutes: RouteResolution['possibleNextRoutes'],
  shouldAskFocusedDiagnostic: boolean,
  stage: RouteStage = 'primary',
  primaryRoute: DiagnosticRouteId | null = route,
  secondaryRoute: DiagnosticRouteId | null = stage === 'secondary' ? route : null
): RouteResolution {
  return {
    route,
    stage,
    primaryRoute,
    secondaryRoute,
    confidence,
    reasons,
    possibleNextRoutes,
    shouldAskFocusedDiagnostic,
  };
}

function getPrimaryRoute(session: DiagnosticSession) {
  const primaryEntry = session.routeHistory.find((entry) => entry.stage === 'primary');
  return primaryEntry?.route ?? session.currentRoute;
}

const noAirflowResolver: IssueResolver = (session) => {
  const { thermostatCalling, indoorFanRunning, indoorUnitPower, boardFaultLights } = session.gateAnswers;
  const indoorBias =
    session.detectedUnitType === 'air_handler' || session.detectedUnitType === 'furnace';

  if (thermostatCalling === 'no') {
    return buildResolution(
      'thermostat_control_diag',
      0.86,
      ['Thermostat is not calling, which points upstream of the blower section.'],
      ['indoor_unit_diag', 'low_voltage_diag'],
      false
    );
  }

  if (thermostatCalling === 'yes' && indoorFanRunning === 'yes') {
    return buildResolution(
      'airflow_restriction_diag',
      0.78,
      ['Blower is running, so the next likely branch is restriction or delivery.'],
      ['refrigeration_diag', 'indoor_unit_diag'],
      false
    );
  }

  if (
    thermostatCalling === 'yes' &&
    indoorFanRunning === 'no' &&
    (indoorUnitPower === 'yes' || boardFaultLights === 'yes' || boardFaultLights === 'no')
  ) {
    return buildResolution(
      'indoor_unit_diag',
      indoorBias ? 0.95 : 0.92,
      [
        'Cooling call is present but the blower is not responding at the indoor unit.',
        ...(indoorBias ? ['Detected indoor equipment type reinforces the indoor branch.'] : []),
      ],
      ['board_control_diag', 'blower_diag'],
      true
    );
  }

  if (indoorUnitPower === 'no') {
    return buildResolution(
      'indoor_unit_diag',
      0.74,
      ['Loss of indoor unit power still lands in the indoor unit branch first.'],
      ['low_voltage_diag', 'board_control_diag'],
      true
    );
  }

  return buildResolution(
    'indoor_unit_diag',
    0.58,
    ['No Airflow defaults to indoor diagnostics until more field evidence shifts the route.'],
    ['thermostat_control_diag', 'airflow_restriction_diag'],
    true
  );
};

const issueResolvers: Partial<Record<NonNullable<DiagnosticSession['issue']>, IssueResolver>> = {
  no_airflow: noAirflowResolver,
  no_cooling: resolveNoCoolingRoute,
  outdoor_unit_not_running: resolveOutdoorUnitNotRunningRoute,
  weak_cooling: resolveWeakCoolingRoute,
  icing_frozen_coil: resolveIcingRoute,
  system_not_doing_anything: resolveSystemIdleRoute,
};

const defaultIssueRoutes: Partial<Record<NonNullable<DiagnosticSession['issue']>, RouteResolution>> = {
  short_cycling: buildResolution(
    'outdoor_unit_diag',
    0.33,
    ['Short cycling remains a broad issue, but the outdoor path is the first placeholder branch.'],
    ['refrigeration_diag'],
    false
  ),
  other: buildResolution(
    'thermostat_control_diag',
    0.2,
    ['Other stays broad until a later issue-specific flow exists.'],
    ['indoor_unit_diag', 'outdoor_unit_diag'],
    false
  ),
};

function resolveOutdoorSecondaryRoute(session: DiagnosticSession): RouteResolution {
  const primaryRoute = getPrimaryRoute(session) ?? 'outdoor_unit_diag';
  const {
    contactorEngaged,
    contactorCoilVoltagePresent,
    outdoorPowerPresent,
    disconnectOn,
    fanOnlyRunning,
    compressorOnlyRunning,
    outdoorLoadsBothOff,
  } = session.diagAnswers;

  if (contactorEngaged === 'no' && contactorCoilVoltagePresent === 'no') {
    return buildResolution(
      'low_voltage_diag',
      0.94,
      ['Contactor is not pulled in and there is no 24V at the coil.'],
      ['board_control_diag', 'safety_open_diag'],
      true,
      'secondary',
      primaryRoute,
      'low_voltage_diag'
    );
  }

  if (contactorEngaged === 'yes' && (outdoorPowerPresent === 'no' || disconnectOn === 'no')) {
    return buildResolution(
      'line_voltage_diag',
      0.94,
      ['Contactor is in but outdoor line power is missing or the disconnect state is off.'],
      ['safety_open_diag'],
      true,
      'secondary',
      primaryRoute,
      'line_voltage_diag'
    );
  }

  if (fanOnlyRunning === 'yes') {
    return buildResolution(
      'compressor_diag',
      0.95,
      ['Condenser fan is running, but the compressor side is not responding.'],
      ['line_voltage_diag', 'safety_open_diag'],
      true,
      'secondary',
      primaryRoute,
      'compressor_diag'
    );
  }

  if (compressorOnlyRunning === 'yes') {
    return buildResolution(
      'condenser_fan_diag',
      0.95,
      ['Compressor is running, but the condenser fan side is not responding.'],
      ['line_voltage_diag'],
      true,
      'secondary',
      primaryRoute,
      'condenser_fan_diag'
    );
  }

  if (outdoorLoadsBothOff === 'yes' && contactorEngaged === 'yes') {
    if (outdoorPowerPresent === 'yes') {
      return buildResolution(
        'safety_open_diag',
        0.78,
        ['Contactor is in and power is present, but both outdoor loads stay off.'],
        ['line_voltage_diag'],
        false,
        'secondary',
        primaryRoute,
        'safety_open_diag'
      );
    }

    return buildResolution(
      'line_voltage_diag',
      0.84,
      ['Contactor is in but both outdoor loads are off, so power delivery still has to be confirmed.'],
      ['safety_open_diag'],
      true,
      'secondary',
      primaryRoute,
      'line_voltage_diag'
    );
  }

  return buildResolution(
    'outdoor_unit_diag',
    0.62,
    ['Outdoor diagnostics still need one more decisive answer before narrowing to a secondary branch.'],
    ['low_voltage_diag', 'line_voltage_diag', 'compressor_diag', 'condenser_fan_diag'],
    false,
    'primary',
    primaryRoute,
    null
  );
}

function resolveIndoorSecondaryRoute(session: DiagnosticSession): RouteResolution {
  const primaryRoute = getPrimaryRoute(session) ?? 'indoor_unit_diag';
  const blowerType = session.gateAnswers.blowerType ?? 'not_sure';
  const { highVoltagePresent, blowerCallPresent, capacitorCondition, ecmModuleClues } = session.diagAnswers;

  if (highVoltagePresent === 'no') {
    return buildResolution(
      'line_voltage_diag',
      0.88,
      ['Indoor section is missing high voltage, so power delivery has to be resolved before motor diagnosis.'],
      ['board_control_diag'],
      true,
      'secondary',
      primaryRoute,
      'line_voltage_diag'
    );
  }

  if (blowerCallPresent === 'no') {
    return buildResolution(
      'board_control_diag',
      0.92,
      ['High voltage may be present, but the blower call is not making it through the board path.'],
      ['low_voltage_diag'],
      false,
      'secondary',
      primaryRoute,
      'board_control_diag'
    );
  }

  if (blowerType === 'psc' && capacitorCondition === 'failed') {
    return buildResolution(
      'blower_diag',
      0.95,
      ['PSC blower path and a failed capacitor point directly to the blower branch.'],
      ['line_voltage_diag'],
      true,
      'secondary',
      primaryRoute,
      'blower_diag'
    );
  }

  if (
    blowerType === 'ecm' &&
    highVoltagePresent === 'yes' &&
    blowerCallPresent === 'yes' &&
    ecmModuleClues !== undefined &&
    ecmModuleClues !== 'not_sure'
  ) {
    return buildResolution(
      'blower_diag',
      0.9,
      ['ECM blower has power and command, so the motor/module branch is now stronger than the generic indoor route.'],
      ['board_control_diag'],
      true,
      'secondary',
      primaryRoute,
      'blower_diag'
    );
  }

  return buildResolution(
    'indoor_unit_diag',
    0.64,
    ['Indoor diagnostics still need one more decisive answer before narrowing further.'],
    ['blower_diag', 'board_control_diag', 'line_voltage_diag'],
    false,
    'primary',
    primaryRoute,
    null
  );
}

function resolveFocusedRoute(session: DiagnosticSession): RouteResolution | null {
  if (session.currentRoute === 'outdoor_unit_diag') {
    return resolveOutdoorSecondaryRoute(session);
  }

  if (session.currentRoute === 'indoor_unit_diag') {
    return resolveIndoorSecondaryRoute(session);
  }

  return null;
}

export function resolveDiagnosticRoute(session: DiagnosticSession): RouteResolution {
  const focusedResolution = resolveFocusedRoute(session);

  if (focusedResolution) {
    return focusedResolution;
  }

  if (!session.issue) {
    return buildResolution(null, 0, ['Issue has not been selected yet.'], [], false);
  }

  const resolver = issueResolvers[session.issue];

  if (!resolver) {
    return (
      defaultIssueRoutes[session.issue] ?? {
        route: null,
        stage: 'primary',
        primaryRoute: null,
        secondaryRoute: null,
        confidence: 0.15,
        reasons: ['This issue lane is not fully wired yet.'],
        possibleNextRoutes: [],
        shouldAskFocusedDiagnostic: false,
      }
    );
  }

  return resolver(session);
}

export function resolveRoute(session: DiagnosticSession) {
  return resolveDiagnosticRoute(session);
}
