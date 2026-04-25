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
    session.gateAnswers.iceLocation,
    session.gateAnswers.restrictionObserved,
    session.gateAnswers.filterCondition,
    session.gateAnswers.indoorFanRunning,
    session.gateAnswers.outdoorUnitRunning,
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

export function resolveIcingRoute(session: DiagnosticSession): RouteResolution {
  const {
    restrictionObserved,
    filterCondition,
    indoorFanRunning,
    outdoorUnitRunning,
  } = session.gateAnswers;

  if (restrictionObserved === 'yes' || filterCondition === 'dirty') {
    return buildResolution(
      'airflow_restriction_diag',
      0.88,
      ['The freeze-up complaint includes obvious airflow restriction, so that branch should be resolved first.'],
      ['icing_diag', 'refrigeration_diag'],
      false
    );
  }

  if (indoorFanRunning === 'no') {
    return buildResolution(
      'indoor_unit_diag',
      0.82,
      ['A blower issue can create the freeze-up condition directly, so the indoor branch comes first.'],
      ['airflow_restriction_diag', 'icing_diag'],
      true
    );
  }

  if (indoorFanRunning === 'yes' && outdoorUnitRunning === 'yes') {
    return buildResolution(
      'refrigeration_diag',
      0.79,
      ['Both sections are operating, so the freeze-up condition leans toward refrigeration-side causes.'],
      ['airflow_restriction_diag', 'icing_diag'],
      false
    );
  }

  return buildResolution(
    'icing_diag',
    0.54,
    ['The freeze-up condition remains broad, so it stays in an icing-specific diagnostic lane for now.'],
    ['airflow_restriction_diag', 'refrigeration_diag'],
    false
  );
}

export function buildIcingResult(session: DiagnosticSession): DiagnosticResult | null {
  if (!session.currentRoute) {
    return null;
  }

  const routeReasons =
    [...session.routeHistory].reverse().find((entry) => entry.route === session.currentRoute)?.reasons ?? [];
  const confidenceLevel = resolveConfidence(session);

  if (session.currentRoute === 'airflow_restriction_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'Dirty filter or blocked airflow',
        why: 'Freeze-up with obvious restriction often starts with reduced evaporator airflow.',
        nextCheck: 'Inspect filter, returns, and obvious supply restrictions first.',
      },
      {
        title: 'Blower delivery issue',
        why: 'Low airflow from blower or duct delivery can freeze the coil even with a normal charge.',
        nextCheck: 'Verify blower performance and actual vent airflow.',
      },
      {
        title: 'Evaporator loading',
        why: 'A dirty coil can reduce airflow enough to start icing.',
        nextCheck: 'Inspect the evaporator face and blower wheel for buildup.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'The freeze-up complaint is landing in airflow restriction because delivery-side problems are visible already.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Check filter condition first.',
        'Inspect blower and evaporator cleanliness.',
        'Confirm delivered airflow before charging work.',
        'Only move deeper into refrigeration after airflow is corrected.',
      ],
    };
  }

  if (session.currentRoute === 'indoor_unit_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'Blower not moving enough air',
        why: 'A blower fault can let the evaporator freeze even when refrigerant charge is not the primary problem.',
        nextCheck: 'Verify blower operation and actual airflow across the coil.',
      },
      {
        title: 'Board or blower control issue',
        why: 'Intermittent blower operation can present as icing rather than a total no-airflow complaint.',
        nextCheck: 'Check blower call and indoor board output under the active call.',
      },
      {
        title: 'Indoor motor or capacitor issue',
        why: 'Weak indoor motor performance can create the low-airflow freeze-up condition.',
        nextCheck: 'Test capacitor or ECM power clues depending on blower type.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'The freeze-up condition is pointing back to the indoor side because blower behavior is part of the problem.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Confirm blower operation first.',
        'Check board call/output to the blower.',
        'Inspect motor or capacitor behavior.',
        'Reassess icing only after airflow is restored.',
      ],
    };
  }

  if (session.currentRoute === 'refrigeration_diag' || session.currentRoute === 'icing_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'Low refrigerant charge',
        why: 'If airflow is acceptable, low charge is a common cause of evaporator freeze-up.',
        nextCheck: 'Check suction behavior and refrigeration measurements once ice is managed safely.',
      },
      {
        title: 'Metering or restriction issue',
        why: 'A refrigerant restriction can create icing even when the system otherwise appears to run.',
        nextCheck: 'Inspect liquid-line and metering behavior for restriction clues.',
      },
      {
        title: 'Mixed airflow and refrigeration issue',
        why: 'Freeze-up complaints often blend weak airflow and low-capacity refrigeration symptoms together.',
        nextCheck: 'Verify airflow first, then move into charge or metering checks.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'The freeze-up condition is leaning refrigeration-side because both sections are still participating in operation.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Manage the ice condition safely first.',
        'Verify airflow is not the primary cause.',
        'Check refrigerant-side measurements next.',
        'Look for metering or restriction clues if charge patterns do not fit.',
      ],
    };
  }

  return null;
}
