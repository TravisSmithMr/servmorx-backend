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
    session.gateAnswers.airflowStrength,
    session.gateAnswers.indoorFanRunning,
    session.gateAnswers.outdoorUnitRunning,
    session.gateAnswers.icingPresent,
    session.gateAnswers.filterCondition,
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

export function resolveWeakCoolingRoute(session: DiagnosticSession): RouteResolution {
  const {
    airflowStrength,
    indoorFanRunning,
    outdoorUnitRunning,
    icingPresent,
    filterCondition,
  } = session.gateAnswers;

  if (icingPresent === 'yes') {
    return buildResolution(
      'icing_diag',
      0.89,
      ['Visible icing is present, so the first branch should stay focused on the freeze-up condition itself.'],
      ['airflow_restriction_diag', 'refrigeration_diag'],
      false
    );
  }

  if (airflowStrength === 'weak' || airflowStrength === 'none' || filterCondition === 'dirty') {
    return buildResolution(
      'airflow_restriction_diag',
      0.85,
      ['Weak cooling with weak airflow or a dirty filter should start in the airflow restriction branch.'],
      ['refrigeration_diag', 'indoor_unit_diag'],
      false
    );
  }

  if (indoorFanRunning === 'yes' && outdoorUnitRunning === 'yes' && airflowStrength === 'strong') {
    return buildResolution(
      'refrigeration_diag',
      0.84,
      ['Both sections are running and airflow is acceptable, so the next branch is refrigeration performance.'],
      ['airflow_restriction_diag', 'icing_diag'],
      false
    );
  }

  if (indoorFanRunning === 'no') {
    return buildResolution(
      'indoor_unit_diag',
      0.76,
      ['Weak cooling with no indoor airflow response still points toward the indoor section first.'],
      ['airflow_restriction_diag', 'refrigeration_diag'],
      true
    );
  }

  if (outdoorUnitRunning === 'no') {
    return buildResolution(
      'outdoor_unit_diag',
      0.73,
      ['Weak cooling with a non-running outdoor section still needs condenser-side confirmation.'],
      ['refrigeration_diag', 'airflow_restriction_diag'],
      true
    );
  }

  return buildResolution(
    'refrigeration_diag',
    0.48,
    ['Weak Cooling stays broad here, but refrigeration remains the strongest next branch.'],
    ['airflow_restriction_diag', 'icing_diag'],
    false
  );
}

export function buildWeakCoolingResult(session: DiagnosticSession): DiagnosticResult | null {
  if (!session.currentRoute) {
    return null;
  }

  const routeReasons =
    [...session.routeHistory].reverse().find((entry) => entry.route === session.currentRoute)?.reasons ?? [];
  const confidenceLevel = resolveConfidence(session);

  if (session.currentRoute === 'airflow_restriction_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'Dirty filter or return restriction',
        why: 'Weak cooling with reduced airflow often starts with a restricted filter or return path.',
        nextCheck: 'Inspect the filter, return path, and obvious grille restrictions.',
      },
      {
        title: 'Evaporator or blower loading',
        why: 'A dirty coil or blower wheel can cut airflow enough to make cooling feel weak.',
        nextCheck: 'Inspect the evaporator face and blower wheel for dirt or ice loading.',
      },
      {
        title: 'Duct or airflow setup issue',
        why: 'Closed dampers, collapsed flex, or low blower setup can all reduce delivered cooling.',
        nextCheck: 'Check dampers, flex runs, and blower speed or airflow setup if accessible.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'Weak Cooling is biased toward airflow restriction because delivery problems are showing up early.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Check filter condition first.',
        'Inspect coil and blower cleanliness.',
        'Look for collapsed or closed duct paths.',
        'Only move deeper into refrigeration after airflow is verified.',
      ],
    };
  }

  if (session.currentRoute === 'icing_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'Low airflow freeze-up',
        why: 'Weak cooling with icing often starts from reduced airflow across the evaporator.',
        nextCheck: 'Inspect filter, blower performance, and coil cleanliness together.',
      },
      {
        title: 'Low charge or metering issue',
        why: 'If airflow is acceptable, refrigerant-side problems can still drive coil freeze-up.',
        nextCheck: 'Check superheat or suction-side behavior once airflow is confirmed.',
      },
      {
        title: 'Blower performance issue',
        why: 'A weak or intermittent blower can create both low comfort and ice buildup.',
        nextCheck: 'Verify blower operation and actual delivered airflow under the call.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'Weak Cooling plus visible icing pushes the first result toward a freeze-up condition rather than a simple comfort complaint.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Check filter and airflow first.',
        'Inspect for evaporator ice and thaw history.',
        'Confirm blower performance before condemning charge.',
        'If airflow is solid, move into refrigeration measurements.',
      ],
    };
  }

  if (session.currentRoute === 'refrigeration_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'Low refrigerant charge',
        why: 'Weak cooling with both sections running and airflow present often points to reduced refrigeration capacity.',
        nextCheck: 'Check pressures and superheat/subcooling before replacing components.',
      },
      {
        title: 'Metering or restriction issue',
        why: 'A restriction can let the system run while still producing weak space cooling.',
        nextCheck: 'Inspect liquid line behavior and compare temperatures across the metering device if possible.',
      },
      {
        title: 'Heat transfer loss',
        why: 'Dirty condenser or evaporator surfaces can reduce capacity even when the system appears to run normally.',
        nextCheck: 'Inspect indoor and outdoor coil cleanliness and condenser airflow.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'Weak Cooling is landing in refrigeration because airflow and equipment operation look reasonably intact.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Verify airflow is truly acceptable first.',
        'Check refrigerant performance measurements.',
        'Inspect condenser and evaporator heat transfer surfaces.',
        'Look for early freeze-up or restriction clues.',
      ],
    };
  }

  if (session.currentRoute === 'outdoor_unit_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'Outdoor section not carrying load',
        why: 'Weak cooling with a weak or non-participating outdoor unit often means the condenser side is not fully operating.',
        nextCheck: 'Confirm whether the contactor is in and whether the condenser fan and compressor are both participating.',
      },
      {
        title: 'Condenser capacitor or component issue',
        why: 'Partial outdoor operation can leave some cooling present while capacity stays well below normal.',
        nextCheck: 'Test the dual capacitor and separate fan-only from compressor-only operation.',
      },
      {
        title: 'Outdoor control or power issue',
        why: 'A weak outdoor response can still come from control voltage, contactor, or line-voltage problems.',
        nextCheck: 'Verify 24V at the contactor coil and line voltage at the unit.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'Weak Cooling is leaning condenser-side because the indoor complaint includes reduced outdoor participation.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Confirm which outdoor loads are actually running.',
        'Check the contactor and capacitor next.',
        'Verify control voltage and line voltage at the unit.',
        'Only move back to refrigeration after outdoor operation is proven.',
      ],
    };
  }

  if (session.currentRoute === 'indoor_unit_diag') {
    const likelyCauses: DiagnosticCause[] = [
      {
        title: 'Weak blower performance',
        why: 'Weak cooling can start with an indoor blower that is underperforming rather than fully failed.',
        nextCheck: 'Verify blower operation, speed, and delivered airflow.',
      },
      {
        title: 'Indoor airflow setup issue',
        why: 'Weak indoor delivery can make cooling feel poor even when refrigeration is active.',
        nextCheck: 'Inspect blower tap or ECM airflow setup and look for obvious delivery restrictions.',
      },
      {
        title: 'Board or motor drive issue',
        why: 'An indoor control or motor problem can degrade airflow enough to show up as weak cooling.',
        nextCheck: 'Check blower call, board output, and motor-specific clues.',
      },
    ];

    return {
      route: session.currentRoute,
      summary: 'Weak Cooling is pointing back to the indoor side because the blower response is not convincing.',
      routeReasons,
      confidenceLevel,
      likelyCauses,
      nextChecks: [
        'Confirm blower operation and delivered airflow.',
        'Inspect indoor motor or board output clues.',
        'Correct indoor airflow issues before deeper refrigeration work.',
      ],
    };
  }

  return null;
}
