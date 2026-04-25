import type {
  DiagnosticCause,
  DiagnosticSession,
  DiagnosticResult,
  ResultConfidenceLevel,
  RouteResolution,
} from '@/types/diagnostic';

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

function resolveConfidence(session: DiagnosticSession): ResultConfidenceLevel {
  const values = [
    session.gateAnswers.indoorFanRunning,
    session.gateAnswers.thermostatCalling,
    session.gateAnswers.contactorEngaged,
    session.gateAnswers.outdoorUnitNoise,
    session.gateAnswers.breakerDisconnectStatus,
  ];
  const known = values.filter((value) => value && value !== 'not_sure').length;

  if (known >= 4) {
    return 'high';
  }

  if (known >= 2) {
    return 'medium';
  }

  return 'low';
}

export function resolveOutdoorUnitNotRunningRoute(session: DiagnosticSession): RouteResolution {
  const {
    thermostatCalling,
    contactorEngaged,
    outdoorUnitNoise,
    breakerDisconnectStatus,
  } = session.gateAnswers;

  if (thermostatCalling === 'no') {
    return buildResolution(
      'thermostat_control_diag',
      0.9,
      ['There is no thermostat call, so the condenser problem is still upstream in the control path.'],
      ['low_voltage_diag', 'outdoor_unit_diag'],
      false
    );
  }

  if (contactorEngaged === 'no') {
    return buildResolution(
      'low_voltage_diag',
      0.86,
      ['The condenser is not pulling in, which points first to the low-voltage or control side.'],
      ['outdoor_unit_diag', 'thermostat_control_diag'],
      false
    );
  }

  if (
    contactorEngaged === 'yes' &&
    (breakerDisconnectStatus === 'off' || breakerDisconnectStatus === 'tripped' || outdoorUnitNoise === 'none')
  ) {
    return buildResolution(
      'line_voltage_diag',
      0.82,
      ['The condenser is commanded but nothing is happening, so the next branch is main power delivery.'],
      ['outdoor_unit_diag', 'compressor_diag'],
      false
    );
  }

  return buildResolution(
    'outdoor_unit_diag',
    0.78,
    ['The outdoor complaint shows partial or noisy condenser behavior, so stay in a focused outdoor diagnostic branch.'],
    ['compressor_diag', 'board_control_diag'],
    true
  );
}

export function buildOutdoorUnitNotRunningResult(session: DiagnosticSession): DiagnosticResult | null {
  if (!session.currentRoute) {
    return null;
  }

  const routeReasons =
    [...session.routeHistory].reverse().find((entry) => entry.route === session.currentRoute)?.reasons ?? [];
  const confidenceLevel = resolveConfidence(session);

  if (session.currentRoute === 'thermostat_control_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'No cooling call to condenser',
        why: 'The outdoor unit cannot run if the thermostat is not actually calling for cooling.',
        nextCheck: 'Verify the cooling call at the indoor board and thermostat output.',
      },
      {
        title: 'Thermostat or control setup issue',
        why: 'A stat setting or failed thermostat can present as an outdoor-only complaint.',
        nextCheck: 'Check thermostat mode, setpoint, and output state.',
      },
      {
        title: 'Broken control path upstream',
        why: 'The condenser may never see the call if the upstream control path is open.',
        nextCheck: 'Trace the Y circuit from the stat to the indoor board.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'The outdoor unit is not running because the cooling call itself is not yet confirmed.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Verify thermostat call first.',
        'Confirm the indoor board is receiving and passing Y.',
        'Check low-voltage wiring upstream of the condenser.',
      ],
    };
  }

  if (session.currentRoute === 'low_voltage_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'No 24V at contactor coil',
        why: 'If the contactor never pulls in, the first likely issue is still missing low-voltage control.',
        nextCheck: 'Measure 24V at the contactor coil during the cooling call.',
      },
      {
        title: 'Open low-voltage wire or safety',
        why: 'An open Y wire or pressure safety can keep the condenser off with no visible outdoor response.',
        nextCheck: 'Trace continuity through the Y path and all outdoor safeties.',
      },
      {
        title: 'Indoor board not passing the call',
        why: 'The call may exist at the stat but still fail to leave the indoor control board.',
        nextCheck: 'Verify the condenser call at the indoor board output terminals.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'The condenser complaint is landing in low voltage because the contactor is not being pulled in.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Check contactor coil voltage.',
        'Trace Y wiring to the outdoor unit.',
        'Inspect pressure switches or safeties.',
        'Confirm the indoor board is passing the call out.',
      ],
    };
  }

  if (session.currentRoute === 'line_voltage_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'Breaker or disconnect issue',
        why: 'A commanded condenser with no response and no noise often points to missing high voltage.',
        nextCheck: 'Inspect breaker, disconnect, and fuse state first.',
      },
      {
        title: 'Open power feed',
        why: 'If the disconnect is on but the unit is still silent, the power feed may still be open upstream.',
        nextCheck: 'Measure line voltage at the unit and backtrack the feed if missing.',
      },
      {
        title: 'Power-side wiring failure',
        why: 'Burned lugs, loose terminals, or failed fuses can leave the condenser dead.',
        nextCheck: 'Inspect outdoor terminals, lugs, and both line legs carefully.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'The outdoor complaint is landing in line voltage because the condenser is commanded but not powered or not proving power.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Check breaker or disconnect state.',
        'Measure line voltage at the unit.',
        'Inspect both power legs and fuse hardware.',
        'Backtrack the feed if voltage is absent.',
      ],
    };
  }

  if (session.currentRoute === 'outdoor_unit_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'Outdoor contactor or relay issue',
        why: 'Partial or noisy outdoor behavior still keeps the condenser contactor and switching path in play.',
        nextCheck: 'Inspect contactor operation and relay output under the live call.',
      },
      {
        title: 'Compressor or fan partial-start issue',
        why: 'Noise without full operation often points to a stalled compressor or fan component.',
        nextCheck: 'Separate fan-only, compressor-only, or hum-only behavior directly at the unit.',
      },
      {
        title: 'Outdoor capacitor or component issue',
        why: 'Partial outdoor operation frequently narrows to capacitor or individual load-side faults.',
        nextCheck: 'Test capacitors and confirm which outdoor load is actually energized.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'The outdoor complaint stays in the condenser branch because there are signs of partial or attempted operation.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Check whether the contactor is in.',
        'Separate noise-only from fan-only or compressor-only behavior.',
        'Test the relevant capacitor or load-side component.',
        'Confirm line voltage while the unit is attempting to start.',
      ],
    };
  }

  return null;
}
