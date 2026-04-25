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
    session.gateAnswers.thermostatPowered,
    session.gateAnswers.thermostatCalling,
    session.gateAnswers.indoorUnitPower,
    session.gateAnswers.outdoorUnitPower,
    session.gateAnswers.breakerDisconnectStatus,
    session.gateAnswers.lowVoltagePresent,
  ];
  const known = values.filter((value) => value && value !== 'not_sure').length;

  if (known >= 5) {
    return 'high';
  }

  if (known >= 3) {
    return 'medium';
  }

  return 'low';
}

export function resolveSystemIdleRoute(session: DiagnosticSession): RouteResolution {
  const {
    thermostatPowered,
    thermostatCalling,
    indoorUnitPower,
    outdoorUnitPower,
    breakerDisconnectStatus,
    lowVoltagePresent,
  } = session.gateAnswers;

  if (thermostatPowered === 'no' || thermostatCalling === 'no') {
    return buildResolution(
      'thermostat_control_diag',
      0.9,
      ['No thermostat power or no call keeps this issue upstream in the control path.'],
      ['low_voltage_diag', 'line_voltage_diag'],
      false
    );
  }

  if (
    indoorUnitPower === 'no' ||
    outdoorUnitPower === 'no' ||
    breakerDisconnectStatus === 'off' ||
    breakerDisconnectStatus === 'tripped'
  ) {
    return buildResolution(
      'line_voltage_diag',
      0.84,
      ['Missing equipment power or an open breaker/disconnect points first to a line-voltage problem.'],
      ['low_voltage_diag', 'thermostat_control_diag'],
      false
    );
  }

  if (lowVoltagePresent === 'no') {
    return buildResolution(
      'low_voltage_diag',
      0.82,
      ['The system appears powered, but no low voltage is present for control operation.'],
      ['thermostat_control_diag', 'board_control_diag'],
      false
    );
  }

  return buildResolution(
    'fallback_diagnostic',
    0.38,
    ['The dead-system path still has too many unknowns, so it stays in a fallback diagnostic lane.'],
    ['thermostat_control_diag', 'line_voltage_diag'],
    false
  );
}

export function buildSystemIdleResult(session: DiagnosticSession): DiagnosticResult | null {
  if (!session.currentRoute) {
    return null;
  }

  const routeReasons =
    [...session.routeHistory].reverse().find((entry) => entry.route === session.currentRoute)?.reasons ?? [];
  const confidenceLevel = resolveConfidence(session);

  if (session.currentRoute === 'thermostat_control_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'Thermostat power or setup issue',
        why: 'A dead thermostat or no control call keeps the system off before equipment-side faults matter.',
        nextCheck: 'Verify thermostat power, mode, setpoint, and whether a call is being generated.',
      },
      {
        title: 'Control fuse or transformer issue',
        why: 'Loss of low-voltage control power can make the whole system appear dead.',
        nextCheck: 'Check transformer output and the low-voltage fuse path.',
      },
      {
        title: 'Open control circuit',
        why: 'An open safety or broken control wire can interrupt the call before it reaches equipment.',
        nextCheck: 'Trace thermostat and low-voltage wiring continuity through safeties.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'System Not Doing Anything is pointing upstream at the thermostat and control source first.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Verify thermostat power.',
        'Confirm whether a call is actually leaving the stat.',
        'Check transformer output and control fuse.',
        'Trace any open safety or thermostat wiring issue.',
      ],
    };
  }

  if (session.currentRoute === 'line_voltage_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'Breaker or disconnect off',
        why: 'No system response with missing equipment power points first to the main power path.',
        nextCheck: 'Inspect breaker, disconnect, and fuse state before deeper control checks.',
      },
      {
        title: 'Open power feed or wiring',
        why: 'If the breaker and disconnect appear on, the supply path may still be open or failed.',
        nextCheck: 'Measure line voltage at the equipment and backtrack the feed if absent.',
      },
      {
        title: 'Single-leg or fuse failure',
        why: 'Partial line-voltage failure can leave the system effectively dead.',
        nextCheck: 'Check both legs of power and inspect fuse or pull-out disconnect hardware.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'The dead-system complaint is landing in a line-voltage branch because equipment power is missing or compromised.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Check disconnect or breaker state first.',
        'Measure line voltage at indoor and outdoor equipment.',
        'Inspect fuses and both power legs.',
        'Backtrack the feed if voltage is missing.',
      ],
    };
  }

  if (session.currentRoute === 'low_voltage_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'Transformer failure',
        why: 'A dead 24V transformer path can stop the entire system from responding.',
        nextCheck: 'Measure transformer input and output directly.',
      },
      {
        title: 'Blown control fuse',
        why: 'A blown fuse will remove low-voltage control while leaving line voltage intact.',
        nextCheck: 'Inspect and test the control fuse path before replacing parts.',
      },
      {
        title: 'Open safety or low-voltage wiring',
        why: 'An open safety or broken low-voltage conductor can interrupt the whole control circuit.',
        nextCheck: 'Trace low-voltage continuity through safeties and field wiring.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'The dead-system call is landing in low voltage because line power appears present but the control circuit does not.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Check transformer output.',
        'Inspect the control fuse.',
        'Trace low-voltage wiring and safeties.',
        'Verify 24V is reaching the board inputs.',
      ],
    };
  }

  if (session.currentRoute === 'fallback_diagnostic') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'Insufficient confirmed inputs',
        why: 'The dead-system complaint still has too many unknowns to place a clean control or power branch.',
        nextCheck: 'Confirm thermostat power, call state, and at least one equipment power reading.',
      },
      {
        title: 'Mixed control and power symptoms',
        why: 'The available answers do not yet separate control failure from supply failure.',
        nextCheck: 'Check line voltage and low voltage in parallel instead of assuming one path.',
      },
      {
        title: 'Intermittent or hidden safety interruption',
        why: 'An intermittent lockout or safety open can leave the system dead without a clear visible clue.',
        nextCheck: 'Look for board indicators, lockouts, and recently tripped safeties.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'The dead-system path still needs a few decisive checks before it can commit to either control or power.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Verify thermostat power and call.',
        'Confirm indoor and outdoor power state.',
        'Check whether low voltage is present.',
        'Use those three checks to push the issue into a cleaner branch.',
      ],
    };
  }

  return null;
}
