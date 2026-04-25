import { buildIcingResult } from '@/features/diagnostics/icing/icing-flow';
import { buildOutdoorUnitNotRunningResult } from '@/features/diagnostics/outdoor-unit-not-running/outdoor-unit-not-running-flow';
import { buildSystemIdleResult } from '@/features/diagnostics/system-idle/system-idle-flow';
import { buildWeakCoolingResult } from '@/features/diagnostics/weak-cooling/weak-cooling-flow';
import { getPrimaryRoute, getRouteReasons, getRouteSwapReason, getSecondaryRoute } from '@/features/diagnostic/route-utils';
import type { DiagnosticCause, DiagnosticResult, DiagnosticSession, ResultConfidenceLevel } from '@/types/diagnostic';

function normalizeKeyword(keyword: string) {
  return keyword.toLowerCase().trim();
}

function equipmentBoost(session: DiagnosticSession, keywords: string[]) {
  const haystack = [
    session.brand,
    session.modelNumber,
    session.detectedUnitType,
    session.detectedSystemType,
    session.specData?.refrigerant,
    session.specData?.notes,
    ...session.commonFaults,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return keywords.reduce((score, keyword) => {
    return haystack.includes(normalizeKeyword(keyword)) ? score + 1 : score;
  }, 0);
}

function rankLikelyCauses(
  session: DiagnosticSession,
  causes: DiagnosticCause[],
  keywordMap: Record<string, string[]>
) {
  return [...causes].sort((left, right) => {
    const leftScore = equipmentBoost(session, keywordMap[left.title] ?? []);
    const rightScore = equipmentBoost(session, keywordMap[right.title] ?? []);
    return rightScore - leftScore;
  });
}

function appendEquipmentContext(session: DiagnosticSession, text: string) {
  const context = [session.brand, session.modelNumber, session.specData?.refrigerant]
    .filter(Boolean)
    .join(' | ');

  if (!context) {
    return text;
  }

  return `${text} Equipment context: ${context}.`;
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
    session.diagAnswers.fanOnlyRunning === 'yes' &&
    session.diagAnswers.compressorOnlyRunning === 'yes'
  ) {
    contradictions.push('Fan-only and compressor-only cannot both be yes at the same time.');
  }

  if (
    session.diagAnswers.outdoorLoadsBothOff === 'yes' &&
    (session.diagAnswers.fanOnlyRunning === 'yes' || session.diagAnswers.compressorOnlyRunning === 'yes')
  ) {
    contradictions.push('Both-off conflicts with a partial outdoor load running.');
  }

  return contradictions;
}

function buildMissingInfo(session: DiagnosticSession) {
  const missing: string[] = [];

  if (!session.issue) {
    missing.push('Issue lane not selected.');
  }

  if (!session.currentRoute) {
    missing.push('No active route has been resolved yet.');
  }

  if (session.currentRoute === 'outdoor_unit_diag' && session.diagAnswers.contactorCoilVoltagePresent === undefined) {
    missing.push('Contactor coil voltage is not confirmed yet.');
  }

  if (session.currentRoute === 'low_voltage_diag' && session.diagAnswers.transformerOutputPresent === undefined) {
    missing.push('Transformer output is not confirmed yet.');
  }

  if (session.currentRoute === 'line_voltage_diag' && session.diagAnswers.lineVoltageAtDisconnect === undefined) {
    missing.push('Disconnect line voltage is not confirmed yet.');
  }

  if (session.currentRoute === 'compressor_diag' && session.diagAnswers.compressorAmpDrawPresent === undefined) {
    missing.push('Compressor amp draw is not confirmed yet.');
  }

  if (session.currentRoute === 'condenser_fan_diag' && session.diagAnswers.fanMotorVoltagePresent === undefined) {
    missing.push('Condenser fan motor voltage is not confirmed yet.');
  }

  if (session.currentRoute === 'blower_diag' && session.diagAnswers.blowerMotorResponding === undefined) {
    missing.push('Blower response is not confirmed yet.');
  }

  return missing;
}

function withRouteMetadata(session: DiagnosticSession, result: DiagnosticResult | null): DiagnosticResult | null {
  if (!result) {
    return null;
  }

  return {
    ...result,
    primaryRoute: getPrimaryRoute(session),
    secondaryRoute: getSecondaryRoute(session),
    routeReasons: result.routeReasons.length > 0 ? result.routeReasons : getRouteReasons(session),
    routeSwapReason: result.routeSwapReason ?? getRouteSwapReason(session),
    contradictions: result.contradictions ?? buildContradictions(session),
    missingInfo: result.missingInfo ?? buildMissingInfo(session),
  };
}

function confidenceFromValues(values: Array<string | undefined>): ResultConfidenceLevel {
  const known = values.filter((value) => value && value !== 'not_sure').length;

  if (known >= Math.max(4, Math.floor(values.length * 0.75))) {
    return 'high';
  }

  if (known >= 2) {
    return 'medium';
  }

  return 'low';
}

function buildThermostatControlResult(session: DiagnosticSession): DiagnosticResult {
  return {
    route: 'thermostat_control_diag',
    summary: 'The issue is still biased upstream in the thermostat or control path.',
    routeReasons: getRouteReasons(session),
    confidenceLevel: 'high',
    likelyCauses: [
      {
        title: 'Thermostat or call issue',
        why: 'The structured route still points upstream of the equipment loads.',
        nextCheck: 'Verify thermostat power, mode, setpoint, and whether Y/G are being energized.',
      },
      {
        title: 'Open low-voltage control path',
        why: 'A broken control path can remove the call before it reaches the equipment.',
        nextCheck: 'Trace the low-voltage call through the stat, board, and safeties.',
      },
      {
        title: 'Board input issue',
        why: 'The thermostat may be calling, but the board may not be receiving or passing it correctly.',
        nextCheck: 'Verify board inputs against thermostat outputs under a live call.',
      },
    ],
    nextChecks: [
      'Verify thermostat power and live call first.',
      'Check transformer and low-voltage fuse if the call is missing.',
      'Trace the Y circuit through any safeties or board inputs.',
    ],
  };
}

function buildIndoorUnitResult(session: DiagnosticSession): DiagnosticResult {
  const blowerType = session.gateAnswers.blowerType ?? 'not_sure';
  const thermostatCalling = session.gateAnswers.thermostatCalling;
  const fanRunning = session.gateAnswers.indoorFanRunning;
  const highVoltage = session.diagAnswers.highVoltagePresent;
  const blowerCall = session.diagAnswers.blowerCallPresent;
  const capacitor = session.diagAnswers.capacitorCondition;
  const ecmClues = session.diagAnswers.ecmModuleClues;

  if (thermostatCalling === 'yes' && fanRunning === 'no' && blowerType === 'psc') {
    return {
      route: 'indoor_unit_diag',
      summary: appendEquipmentContext(session, 'Indoor unit path points first to the PSC blower section.'),
      routeReasons: getRouteReasons(session),
      confidenceLevel: 'high',
      likelyCauses: rankLikelyCauses(
        session,
        [
          {
            title: 'Blower capacitor',
            why:
              capacitor === 'failed'
                ? 'You already flagged the PSC capacitor as failed under a valid call.'
                : 'PSC blower with a valid call and no motion makes the run capacitor a high-probability fast check.',
            nextCheck: 'Measure capacitor value against rating and inspect for heat or swelling.',
          },
          {
            title: 'Blower motor',
            why:
              highVoltage === 'yes'
                ? 'High voltage is present, which shifts suspicion toward the motor circuit itself.'
                : 'If the capacitor passes, the PSC motor remains a likely next failure point.',
            nextCheck: 'Verify winding condition, amp draw, and whether the shaft is seized.',
          },
          {
            title: 'Control board or relay',
            why:
              blowerCall === 'no'
                ? 'No blower call at the board keeps board output or relay failure in play.'
                : 'If the call is present but the motor still does not run, inspect relay output and board traces.',
            nextCheck: 'Confirm fan call through the board and verify relay output to the motor path.',
          },
        ],
        {
          'Blower capacitor': ['capacitor', 'blower'],
          'Blower motor': ['motor', 'blower'],
          'Control board or relay': ['board', 'relay', 'control'],
        }
      ),
      nextChecks: [
        'Confirm line voltage and blower call first.',
        'Test the PSC capacitor before condemning the motor.',
        'Verify board output to the blower circuit.',
      ],
    };
  }

  if (thermostatCalling === 'yes' && fanRunning === 'no' && blowerType === 'ecm') {
    return {
      route: 'indoor_unit_diag',
      summary: appendEquipmentContext(session, 'Indoor unit path points toward ECM blower/module or board output issues.'),
      routeReasons: getRouteReasons(session),
      confidenceLevel: 'high',
      likelyCauses: rankLikelyCauses(
        session,
        [
          {
            title: 'ECM motor or module',
            why:
              ecmClues === 'module_dead'
                ? 'You identified dead-module behavior on an ECM blower with a valid call.'
                : 'ECM blowers commonly fail at the motor or module when the call is present but the wheel does not move.',
            nextCheck: 'Verify ECM module power, harness condition, and any module diagnostics.',
          },
          {
            title: 'Board or control issue',
            why:
              blowerCall === 'no'
                ? 'No blower call present keeps the board or control path high on the list.'
                : 'ECM systems still depend on correct board output or communication.',
            nextCheck: 'Confirm the board is issuing the expected fan command or ECM signal.',
          },
          {
            title: 'Power delivery issue',
            why:
              highVoltage === 'no'
                ? 'Missing high voltage can stop the ECM module before any deeper diagnosis matters.'
                : 'Unstable power can mimic module failure.',
            nextCheck: 'Verify steady line voltage and inspect connectors, plugs, and board power feed.',
          },
        ],
        {
          'ECM motor or module': ['ecm', 'module', 'blower'],
          'Board or control issue': ['board', 'control'],
          'Power delivery issue': ['power', 'voltage'],
        }
      ),
      nextChecks: [
        'Confirm line voltage and control input together.',
        'Inspect ECM harnesses and module indicators.',
        'Do not condemn the motor until board output is verified.',
      ],
    };
  }

  return {
    route: 'indoor_unit_diag',
    summary: appendEquipmentContext(session, 'Indoor blower path is still the strongest route based on the current answers.'),
    routeReasons: getRouteReasons(session),
    confidenceLevel: confidenceFromValues([
      session.gateAnswers.thermostatCalling,
      session.gateAnswers.indoorFanRunning,
      session.diagAnswers.highVoltagePresent,
      session.diagAnswers.blowerCallPresent,
    ]),
    likelyCauses: [
      {
        title: 'Indoor blower or drive issue',
        why: 'The blower is still not producing airflow under the current conditions.',
        nextCheck: 'Confirm motor type, power, and whether the board is issuing a blower command.',
      },
      {
        title: 'Control board issue',
        why: 'Loss of blower output or weak board control can stop indoor airflow.',
        nextCheck: 'Check board status, fan output, and relay operation.',
      },
      {
        title: 'Power delivery issue',
        why: 'Low or missing indoor power can mimic a motor or board fault.',
        nextCheck: 'Verify line voltage, disconnects, and any blower safeties.',
      },
    ],
    nextChecks: [
      'Verify thermostat call, line voltage, and blower call presence.',
      'Confirm blower motor type before choosing PSC or ECM checks.',
      'Use any board fault lights to tighten the next branch.',
    ],
  };
}

function buildOutdoorUnitResult(session: DiagnosticSession): DiagnosticResult {
  const {
    thermostatCalling,
    indoorFanRunning,
    outdoorUnitRunning,
    contactorEngaged,
    contactorCoilVoltagePresent,
    outdoorPowerPresent,
    disconnectOn,
    fanOnlyRunning,
    compressorOnlyRunning,
    outdoorLoadsBothOff,
  } = { ...session.gateAnswers, ...session.diagAnswers };

  if (contactorEngaged === 'no') {
    return {
      route: 'outdoor_unit_diag',
      summary: appendEquipmentContext(session, 'The condenser is not pulling in, so the first outdoor branch stays on the low-voltage call path.'),
      routeReasons: getRouteReasons(session),
      confidenceLevel: 'high',
      likelyCauses: [
        {
          title: 'No 24V to condenser',
          why:
            contactorCoilVoltagePresent === 'no'
              ? 'The contactor is not pulled in and there is no 24V at the coil.'
              : 'The contactor is not pulled in, so the first likely failure is still the low-voltage call path.',
          nextCheck: 'Measure 24V at the contactor coil and trace the Y call back through safeties and wiring.',
        },
        {
          title: 'Broken low-voltage wire',
          why: 'An open Y wire can keep the condenser off while the indoor unit still responds.',
          nextCheck: 'Inspect and continuity-check the low-voltage run between indoor and outdoor equipment.',
        },
        {
          title: 'Thermostat or control issue',
          why:
            thermostatCalling === 'yes'
              ? 'A claimed cooling call that never reaches the condenser still leaves the control path in play.'
              : 'If the thermostat is not clearly calling, the control issue remains a top cause.',
          nextCheck: 'Verify the cooling call at the indoor board and confirm it is being passed to the condenser.',
        },
      ],
      nextChecks: [
        'Check whether the contactor is mechanically pulled in.',
        'Measure 24V at the contactor coil.',
        'Trace the Y circuit through safeties and splices.',
      ],
    };
  }

  if (contactorEngaged === 'yes' && (outdoorPowerPresent === 'no' || disconnectOn === 'no')) {
    return {
      route: 'outdoor_unit_diag',
      summary: appendEquipmentContext(session, 'The condenser is commanded on, but the load side still points to missing line voltage or disconnect power.'),
      routeReasons: getRouteReasons(session),
      confidenceLevel: 'high',
      likelyCauses: [
        {
          title: 'Line voltage missing at condenser',
          why: 'The contactor is in or commanded, but the unit does not have confirmed high voltage.',
          nextCheck: 'Verify line voltage at the disconnect and at the contactor line/load side.',
        },
        {
          title: 'Disconnect or breaker issue',
          why: 'A tripped breaker, pulled disconnect, or blown fuse can leave the outdoor unit dead under a valid call.',
          nextCheck: 'Inspect breaker, fuses, and disconnect condition before replacing condenser components.',
        },
        {
          title: 'Power feed or wiring issue',
          why: 'If the disconnect is on but voltage is still absent, the fault may be upstream wiring or terminal failure.',
          nextCheck: 'Backtrack the power feed from disconnect to panel and inspect all terminations.',
        },
      ],
      nextChecks: [
        'Confirm disconnect or breaker status first.',
        'Measure line voltage at the outdoor unit.',
        'Inspect fuses and terminations.',
      ],
    };
  }

  if (fanOnlyRunning === 'yes') {
    return {
      route: 'outdoor_unit_diag',
      summary: appendEquipmentContext(session, 'The condenser fan is running but the compressor side is not, so the branch is narrowing to the compressor circuit.'),
      routeReasons: getRouteReasons(session),
      confidenceLevel: 'high',
      likelyCauses: [
        {
          title: 'Compressor failure',
          why: 'The fan is running under a pulled-in contactor, which isolates the fault toward the compressor side.',
          nextCheck: 'Measure compressor amp draw and check winding resistance before condemning the compressor.',
        },
        {
          title: 'Compressor capacitor issue',
          why: 'A weak or failed capacitor can leave the fan running while the compressor fails to start.',
          nextCheck: 'Test the compressor capacitor section and any hard-start components.',
        },
        {
          title: 'Internal overload',
          why: 'A hot or overloaded compressor can stay off even while the condenser fan runs normally.',
          nextCheck: 'Check shell temperature, overload state, and restart behavior after cooldown.',
        },
      ],
      nextChecks: [
        'Test the compressor capacitor first.',
        'Check compressor amp draw and winding condition.',
        'Inspect for overload or locked-rotor behavior.',
      ],
    };
  }

  if (compressorOnlyRunning === 'yes') {
    return {
      route: 'outdoor_unit_diag',
      summary: appendEquipmentContext(session, 'The compressor is running but the condenser fan is not, so the branch is narrowing to the fan side.'),
      routeReasons: getRouteReasons(session),
      confidenceLevel: 'high',
      likelyCauses: [
        {
          title: 'Condenser fan motor',
          why: 'The compressor is running but the fan is not, which isolates the failure toward the fan circuit.',
          nextCheck: 'Check fan motor voltage, amp draw, and shaft condition.',
        },
        {
          title: 'Fan capacitor',
          why: 'A failed fan capacitor can stop the condenser fan while the compressor continues to run.',
          nextCheck: 'Test the fan capacitor value and inspect for swelling or leakage.',
        },
        {
          title: 'Fan wiring or relay issue',
          why: 'If voltage is not reaching the fan motor, the problem may be wiring, relay, or board output.',
          nextCheck: 'Verify output to the fan circuit and inspect connectors and relay contacts.',
        },
      ],
      nextChecks: [
        'Shut down if head pressure risk is high.',
        'Test the fan capacitor.',
        'Confirm voltage at the fan motor.',
      ],
    };
  }

  return {
    route: 'outdoor_unit_diag',
    summary: appendEquipmentContext(session, 'The condenser is still the strongest branch, but one more outdoor confirmation is needed before narrowing further.'),
    routeReasons: getRouteReasons(session),
    confidenceLevel: confidenceFromValues([
      thermostatCalling,
      indoorFanRunning,
      outdoorUnitRunning,
      contactorEngaged,
      outdoorPowerPresent,
      outdoorLoadsBothOff,
    ]),
    likelyCauses: [
      {
        title: 'Outdoor power or contactor issue',
        why: 'The indoor side responds, but the condenser branch is still not producing a clear start condition.',
        nextCheck: 'Verify contactor state, 24V at the coil, and line voltage at the unit in that order.',
      },
      {
        title: 'Compressor-side problem',
        why: 'Outdoor load separation is incomplete, but the compressor circuit remains a common no-cooling culprit.',
        nextCheck: 'Separate fan-only vs compressor-only behavior with direct observation or amp draw.',
      },
      {
        title: 'Fan-side problem',
        why: 'Outdoor fan failure can still leave the condenser in a no-cooling state even before refrigeration testing.',
        nextCheck: 'Confirm whether the fan motor and capacitor are operating under the active call.',
      },
    ],
    nextChecks: [
      'Confirm contactor state first.',
      'Measure 24V at the contactor coil.',
      'Verify line voltage and disconnect state.',
      'Separate fan-only, compressor-only, or both-off behavior.',
    ],
  };
}

function buildAirflowRestrictionResult(session: DiagnosticSession): DiagnosticResult {
  return {
    route: 'airflow_restriction_diag',
    summary: 'The blower appears to run, so the next branch is airflow restriction or delivery.',
    routeReasons: getRouteReasons(session),
    confidenceLevel: 'medium',
    likelyCauses: [
      {
        title: 'Filter or return restriction',
        why: 'Running blower with poor airflow commonly points to restriction first.',
        nextCheck: 'Inspect filters, returns, and any blocked grilles.',
      },
      {
        title: 'Evaporator or wheel loading',
        why: 'A dirty coil or wheel can reduce delivered airflow even while the motor runs.',
        nextCheck: 'Inspect blower wheel and evaporator face for dirt or ice.',
      },
      {
        title: 'Duct or damper issue',
        why: 'Closed dampers or duct collapse can mimic blower failure from the occupied space.',
        nextCheck: 'Verify major dampers, trunk condition, and obvious duct restrictions.',
      },
    ],
    nextChecks: [
      'Check filter and coil condition.',
      'Look for ice, collapsed flex, or closed dampers.',
      'Verify blower setup if accessible.',
    ],
  };
}

function buildRefrigerationResult(session: DiagnosticSession): DiagnosticResult {
  return {
    route: 'refrigeration_diag',
    summary: 'The current answers suggest the system is operating, so the next branch is refrigeration performance rather than simple on/off control.',
    routeReasons: getRouteReasons(session),
    confidenceLevel: 'medium',
    likelyCauses: [
      {
        title: 'Charge or metering issue',
        why: 'Cooling performance can still be weak even when both major sections run.',
        nextCheck: 'Verify pressures, superheat/subcooling, and look for low-charge patterns.',
      },
      {
        title: 'Heat transfer problem',
        why: 'Dirty coils or weak outdoor heat rejection can mimic a refrigeration fault.',
        nextCheck: 'Inspect indoor and outdoor coil condition and condenser airflow.',
      },
      {
        title: 'Freeze-up or restriction developing',
        why: 'Icing or capacity loss can be an early sign of restriction or airflow-related freeze-up.',
        nextCheck: 'Check for ice history, metering restrictions, and coil conditions together.',
      },
    ],
    nextChecks: [
      'Confirm both indoor and outdoor loads are actually operating.',
      'Check refrigeration measurements before replacing controls.',
      'Inspect coil cleanliness and airflow first if capacity is borderline.',
    ],
  };
}

function buildLowVoltageResult(session: DiagnosticSession): DiagnosticResult {
  const answers = session.diagAnswers;
  const confidenceLevel = confidenceFromValues([
    answers.transformerOutputPresent,
    answers.lowVoltageFuseIntact,
    answers.callLeavingIndoorBoard,
    answers.wireContinuityToOutdoor,
    answers.safetyCircuitClosed,
  ]);

  if (answers.transformerOutputPresent === 'no' || answers.lowVoltageFuseIntact === 'no') {
    return {
      route: 'low_voltage_diag',
      summary: 'The branch has narrowed to a missing 24V source or blown control protection.',
      routeReasons: getRouteReasons(session),
      confidenceLevel,
      likelyCauses: [
        {
          title: 'Transformer failure',
          why: 'The 24V source is not present or not surviving load.',
          nextCheck: 'Measure transformer input and output directly under load.',
        },
        {
          title: 'Blown low-voltage fuse',
          why: 'Loss of low-voltage fuse continuity will remove the entire call path.',
          nextCheck: 'Inspect and test the control fuse, then look for the short that caused it.',
        },
        {
          title: 'Short in control circuit',
          why: 'A repeated fuse or transformer failure usually means a control-side short is present.',
          nextCheck: 'Isolate thermostat, safeties, and outdoor wiring one segment at a time.',
        },
      ],
      nextChecks: [
        'Verify transformer input and output.',
        'Check the low-voltage fuse.',
        'Isolate the circuit if protection is opening repeatedly.',
      ],
    };
  }

  if (answers.callLeavingIndoorBoard === 'no') {
    return {
      route: 'low_voltage_diag',
      summary: '24V appears available, but the board is not passing the call downstream.',
      routeReasons: getRouteReasons(session),
      confidenceLevel,
      likelyCauses: [
        {
          title: 'Board output issue',
          why: 'The indoor board has control power but is not passing the expected call downstream.',
          nextCheck: 'Compare thermostat input to board output under a live call.',
        },
        {
          title: 'Open safety in board path',
          why: 'A safety input can interrupt output even with healthy transformer power.',
          nextCheck: 'Check any float, pressure, door, or auxiliary safety tied into the control path.',
        },
        {
          title: 'Thermostat call not reaching board logic',
          why: 'The board may have 24V available but still not be receiving a valid Y call.',
          nextCheck: 'Verify the thermostat input terminals at the board.',
        },
      ],
      nextChecks: [
        'Compare board input vs output under the call.',
        'Check all low-voltage safeties.',
        'Verify the thermostat signal is reaching the board.',
      ],
    };
  }

  return {
    route: 'low_voltage_diag',
    summary: 'The branch remains on low voltage because the control circuit still has an open or handoff problem.',
    routeReasons: getRouteReasons(session),
    confidenceLevel,
    likelyCauses: [
      {
        title: 'Open field control wire',
        why: '24V may exist at the source but still fail to reach the target equipment.',
        nextCheck: 'Continuity-check the outdoor or downstream control wiring.',
      },
      {
        title: 'Open safety circuit',
        why: 'A safety string can interrupt the call even while transformer power is present.',
        nextCheck: 'Trace continuity through all series safeties.',
      },
      {
        title: 'Intermittent control interruption',
        why: 'An intermittent open can look like a dead call without a single hard failure point.',
        nextCheck: 'Re-check the circuit under load and while moving suspect wiring or float switches.',
      },
    ],
    nextChecks: [
      'Check continuity from the indoor board to the outdoor unit.',
      'Inspect all series safeties.',
      'Verify the call survives under load, not just open-circuit.',
    ],
  };
}

function buildLineVoltageResult(session: DiagnosticSession): DiagnosticResult {
  const answers = session.diagAnswers;
  const confidenceLevel = confidenceFromValues([
    answers.breakerOrDisconnectOn,
    answers.lineVoltageAtDisconnect,
    answers.lineVoltageAtContactorLineSide,
    answers.lineVoltageAtContactorLoadSide,
    answers.fusesIntact,
  ]);

  if (answers.breakerOrDisconnectOn === 'no' || answers.lineVoltageAtDisconnect === 'no') {
    return {
      route: 'line_voltage_diag',
      summary: 'The branch has narrowed to missing outdoor power before it even reaches the cabinet.',
      routeReasons: getRouteReasons(session),
      confidenceLevel,
      likelyCauses: [
        {
          title: 'Breaker or disconnect off',
          why: 'Power is not proven at the disconnect.',
          nextCheck: 'Inspect breaker, disconnect, and fuse pull-out condition first.',
        },
        {
          title: 'Open power feed',
          why: 'If the disconnect appears on but voltage is absent, the feed is still open upstream.',
          nextCheck: 'Backtrack the feed from disconnect to panel and verify both legs.',
        },
        {
          title: 'Blown or missing fuses',
          why: 'Protection hardware can remove one or both legs before the cabinet.',
          nextCheck: 'Inspect and test all fuses and holders.',
        },
      ],
      nextChecks: [
        'Confirm disconnect state.',
        'Measure line voltage at the disconnect.',
        'Inspect fuses and feed wiring.',
      ],
    };
  }

  if (answers.lineVoltageAtContactorLineSide === 'yes' && answers.lineVoltageAtContactorLoadSide === 'no') {
    return {
      route: 'line_voltage_diag',
      summary: 'Power reaches the contactor line side, but it is not making it through to the load side.',
      routeReasons: getRouteReasons(session),
      confidenceLevel,
      likelyCauses: [
        {
          title: 'Failed contactor',
          why: 'Line voltage is present at the line side but not passing through.',
          nextCheck: 'Verify contactor engagement and measure across the contactor under load.',
        },
        {
          title: 'Contactor not truly closing',
          why: 'Mechanical pull-in does not always mean both poles are making power contact.',
          nextCheck: 'Check contactor contact condition and voltage drop across the poles.',
        },
        {
          title: 'Burned lugs or terminal failure',
          why: 'Heat-damaged terminals can interrupt power downstream even with healthy line-side voltage.',
          nextCheck: 'Inspect contactor lugs, wire ends, and terminal integrity.',
        },
      ],
      nextChecks: [
        'Measure voltage at line and load side under call.',
        'Inspect contact surfaces and lugs.',
        'Confirm the contactor is truly closing both poles.',
      ],
    };
  }

  return {
    route: 'line_voltage_diag',
    summary: 'The branch remains on line voltage because power delivery is still incomplete or inconsistent.',
    routeReasons: getRouteReasons(session),
    confidenceLevel,
    likelyCauses: [
      {
        title: 'Single-leg power loss',
        why: 'Partial voltage loss can leave the system commanded but effectively dead.',
        nextCheck: 'Check both legs independently at disconnect and contactor.',
      },
      {
        title: 'Fuse or lug failure',
        why: 'A weak fuse or burned termination can pass some checks and still fail under load.',
        nextCheck: 'Inspect fuses, terminals, and voltage drop under load.',
      },
      {
        title: 'Cabinet-side power interruption',
        why: 'Voltage may reach part of the unit but not the downstream load circuit.',
        nextCheck: 'Follow voltage through each handoff point inside the cabinet.',
      },
    ],
    nextChecks: [
      'Check both power legs.',
      'Trace voltage from disconnect to contactor to loads.',
      'Inspect all fuses and high-heat terminals.',
    ],
  };
}

function buildBlowerResult(session: DiagnosticSession): DiagnosticResult {
  const answers = session.diagAnswers;
  const blowerType = session.gateAnswers.blowerType ?? 'not_sure';
  const confidenceLevel = confidenceFromValues([
    answers.blowerMotorResponding,
    answers.blowerCapacitorFailed,
    answers.blowerWheelRestricted,
    answers.ecmPowerPresent,
    answers.ecmCommunicationPresent,
  ]);

  if (blowerType === 'psc' && answers.blowerCapacitorFailed === 'yes') {
    return {
      route: 'blower_diag',
      summary: 'The branch has narrowed to a PSC blower failure path, led by the run capacitor.',
      routeReasons: getRouteReasons(session),
      confidenceLevel,
      likelyCauses: [
        {
          title: 'Blower capacitor',
          why: 'You already confirmed the PSC capacitor failed.',
          nextCheck: 'Replace or verify the capacitor rating before condemning the motor.',
        },
        {
          title: 'Blower motor',
          why: 'A failed capacitor can coexist with a weakened or overheated PSC motor.',
          nextCheck: 'Check amp draw, winding condition, and shaft drag after capacitor correction.',
        },
        {
          title: 'Wheel or mechanical drag',
          why: 'If the motor still struggles after capacitor correction, mechanical drag stays in play.',
          nextCheck: 'Check wheel free-spin and housing rub.',
        },
      ],
      nextChecks: [
        'Correct the capacitor issue first.',
        'Retest motor response and amp draw.',
        'Inspect wheel drag if the motor still struggles.',
      ],
    };
  }

  if (blowerType === 'ecm' && answers.ecmPowerPresent === 'yes' && answers.ecmCommunicationPresent === 'yes') {
    return {
      route: 'blower_diag',
      summary: 'The branch has narrowed to the ECM motor or module because power and command both appear present.',
      routeReasons: getRouteReasons(session),
      confidenceLevel,
      likelyCauses: [
        {
          title: 'ECM module failure',
          why: 'ECM power and command are present, but the motor still is not responding.',
          nextCheck: 'Inspect module indicators and verify the motor/module assembly response.',
        },
        {
          title: 'ECM motor failure',
          why: 'If the module is powered and commanded, the motor itself remains a strong suspect.',
          nextCheck: 'Use approved ECM diagnostics to separate module from motor fault.',
        },
        {
          title: 'Mechanical blower drag',
          why: 'A locked wheel or severe drag can still stop an ECM system from ramping.',
          nextCheck: 'Check wheel free-spin and housing interference.',
        },
      ],
      nextChecks: [
        'Confirm ECM power and communication again under load.',
        'Inspect module indicators and harnesses.',
        'Check the blower wheel for drag.',
      ],
    };
  }

  return {
    route: 'blower_diag',
    summary: 'The branch has narrowed to the blower itself rather than a generic indoor control issue.',
    routeReasons: getRouteReasons(session),
    confidenceLevel,
    likelyCauses: [
      {
        title: 'Blower motor not responding',
        why: 'The blower-specific checks point at the motor or drive side.',
        nextCheck: 'Confirm whether the motor attempts to start and what power is present.',
      },
      {
        title: 'Mechanical drag',
        why: 'A dragging wheel can present like an electrical failure.',
        nextCheck: 'Check the wheel, shaft, and housing for binding.',
      },
      {
        title: 'Motor-side capacitor or module issue',
        why: 'The remaining narrow branch is still within the motor-side start or drive components.',
        nextCheck: 'Use the correct PSC or ECM follow-up based on the blower platform.',
      },
    ],
    nextChecks: [
      'Confirm whether the motor responds at all.',
      'Check for mechanical drag.',
      'Use PSC or ECM checks based on the blower platform.',
    ],
  };
}

function buildCompressorResult(session: DiagnosticSession): DiagnosticResult {
  const answers = session.diagAnswers;
  const confidenceLevel = confidenceFromValues([
    answers.compressorAmpDrawPresent,
    answers.compressorCapacitorFailed,
    answers.compressorOverloadOpen,
    answers.compressorWindingIssue,
  ]);

  if (answers.compressorCapacitorFailed === 'yes') {
    return {
      route: 'compressor_diag',
      summary: 'The branch has narrowed to the compressor start path, led by a failed capacitor.',
      routeReasons: getRouteReasons(session),
      confidenceLevel,
      likelyCauses: [
        {
          title: 'Compressor capacitor',
          why: 'The compressor-side capacitor failed test under this no-cooling path.',
          nextCheck: 'Replace or verify the capacitor before condemning the compressor.',
        },
        {
          title: 'Hard-start or start-assist issue',
          why: 'If fitted, the start-assist path can still be the limiting fault.',
          nextCheck: 'Inspect the hard-start kit and start components.',
        },
        {
          title: 'Compressor damage',
          why: 'A bad capacitor can coexist with a damaged compressor if the unit has been struggling to start.',
          nextCheck: 'Retest amp draw and winding condition after capacitor correction.',
        },
      ],
      nextChecks: [
        'Correct the capacitor issue first.',
        'Recheck compressor amp draw and start behavior.',
        'Only condemn the compressor after the start circuit is proven.',
      ],
    };
  }

  if (answers.compressorOverloadOpen === 'yes') {
    return {
      route: 'compressor_diag',
      summary: 'The branch has narrowed to a hot or protected compressor that is not staying in the circuit.',
      routeReasons: getRouteReasons(session),
      confidenceLevel,
      likelyCauses: [
        {
          title: 'Internal overload open',
          why: 'You indicated the overload is open, which explains the no-run state.',
          nextCheck: 'Check shell temperature, cooldown behavior, and what is driving the overload event.',
        },
        {
          title: 'High compression or thermal stress',
          why: 'A compressor can trip on overload when head pressure or heat rejection is excessive.',
          nextCheck: 'Inspect condenser airflow, cleanliness, and ambient conditions.',
        },
        {
          title: 'Weak compressor',
          why: 'Repeated overload trips can indicate a compressor nearing failure.',
          nextCheck: 'Recheck amp draw and winding condition after cooldown.',
        },
      ],
      nextChecks: [
        'Allow cooldown if needed.',
        'Check why the overload is opening.',
        'Recheck amp draw and winding condition after reset.',
      ],
    };
  }

  return {
    route: 'compressor_diag',
    summary: 'The branch has narrowed to the compressor side because the condenser fan is running without compressor contribution.',
    routeReasons: getRouteReasons(session),
    confidenceLevel,
    likelyCauses: [
      {
        title: 'Compressor failure',
        why: 'The compressor branch remains the strongest narrow path under the current answers.',
        nextCheck: 'Check amp draw, winding condition, and start behavior.',
      },
      {
        title: 'Compressor start circuit issue',
        why: 'The compressor may still be healthy while the start path is failing.',
        nextCheck: 'Test the compressor capacitor and any start-assist components.',
      },
      {
        title: 'Internal overload or protection',
        why: 'A protected compressor can stay off even while the rest of the condenser runs.',
        nextCheck: 'Check overload state and shell temperature.',
      },
    ],
    nextChecks: [
      'Check compressor amp draw.',
      'Test the start capacitor path.',
      'Verify overload and winding condition.',
    ],
  };
}

function buildCondenserFanResult(session: DiagnosticSession): DiagnosticResult {
  const answers = session.diagAnswers;
  const confidenceLevel = confidenceFromValues([
    answers.fanMotorVoltagePresent,
    answers.fanCapacitorFailed,
    answers.fanBladeSpinsFreely,
    answers.fanMotorOveramping,
  ]);

  if (answers.fanCapacitorFailed === 'yes') {
    return {
      route: 'condenser_fan_diag',
      summary: 'The branch has narrowed to the condenser fan start path, led by a failed fan capacitor.',
      routeReasons: getRouteReasons(session),
      confidenceLevel,
      likelyCauses: [
        {
          title: 'Fan capacitor',
          why: 'The fan-side capacitor failed under a compressor-only operating condition.',
          nextCheck: 'Replace or verify the fan capacitor before condemning the motor.',
        },
        {
          title: 'Condenser fan motor',
          why: 'A weak motor can coexist with a failed capacitor or have been damaged by it.',
          nextCheck: 'Retest motor voltage, amp draw, and rotation after capacitor correction.',
        },
        {
          title: 'Mechanical drag',
          why: 'If the blade still will not accelerate, drag or bearing failure remains in play.',
          nextCheck: 'Check blade free-spin and shaft drag.',
        },
      ],
      nextChecks: [
        'Correct the fan capacitor issue first.',
        'Retest motor operation under load.',
        'Inspect blade drag if the motor still struggles.',
      ],
    };
  }

  if (answers.fanMotorVoltagePresent === 'no') {
    return {
      route: 'condenser_fan_diag',
      summary: 'The branch is narrowed to the fan control/output side because voltage is not reaching the motor.',
      routeReasons: getRouteReasons(session),
      confidenceLevel,
      likelyCauses: [
        {
          title: 'Fan relay or output issue',
          why: 'The fan motor is not receiving the expected voltage.',
          nextCheck: 'Trace voltage from contactor/output to the fan motor.',
        },
        {
          title: 'Wiring interruption',
          why: 'An open connector or damaged lead can leave the fan motor dead while the compressor still runs.',
          nextCheck: 'Inspect all fan wiring and connectors.',
        },
        {
          title: 'Board or control output issue',
          why: 'Some condenser fan circuits still depend on additional output control beyond simple contactor pull-in.',
          nextCheck: 'Verify output path from control source to fan motor feed.',
        },
      ],
      nextChecks: [
        'Confirm voltage at the fan motor.',
        'Trace the fan feed wiring.',
        'Inspect any relay or output path feeding the fan.',
      ],
    };
  }

  return {
    route: 'condenser_fan_diag',
    summary: 'The branch has narrowed to the condenser fan side because the compressor is running without proper fan participation.',
    routeReasons: getRouteReasons(session),
    confidenceLevel,
    likelyCauses: [
      {
        title: 'Condenser fan motor',
        why: 'The fan-side branch remains strongest under the current answers.',
        nextCheck: 'Check motor voltage, amp draw, and whether the blade spins freely.',
      },
      {
        title: 'Fan capacitor',
        why: 'A failing fan capacitor can still be the simplest explanation if not yet proven good.',
        nextCheck: 'Test the capacitor directly.',
      },
      {
        title: 'Mechanical drag or overamping motor',
        why: 'A dragging or overheating motor can fail to keep up even when voltage is present.',
        nextCheck: 'Check blade free-spin and motor temperature or amp draw.',
      },
    ],
    nextChecks: [
      'Confirm fan motor voltage.',
      'Test the capacitor.',
      'Check blade drag and motor amp draw.',
    ],
  };
}

export function buildDiagnosticResults(session: DiagnosticSession): DiagnosticResult | null {
  if (!session.currentRoute) {
    return null;
  }

  const issueSpecificResult =
    (session.issue === 'weak_cooling' && buildWeakCoolingResult(session)) ||
    (session.issue === 'system_not_doing_anything' && buildSystemIdleResult(session)) ||
    (session.issue === 'icing_frozen_coil' && buildIcingResult(session)) ||
    (session.issue === 'outdoor_unit_not_running' && buildOutdoorUnitNotRunningResult(session));

  if (issueSpecificResult && !['blower_diag', 'compressor_diag', 'condenser_fan_diag', 'line_voltage_diag', 'low_voltage_diag'].includes(session.currentRoute)) {
    return withRouteMetadata(session, issueSpecificResult);
  }

  switch (session.currentRoute) {
    case 'indoor_unit_diag':
      return withRouteMetadata(session, buildIndoorUnitResult(session));
    case 'thermostat_control_diag':
      return withRouteMetadata(session, buildThermostatControlResult(session));
    case 'airflow_restriction_diag':
      return withRouteMetadata(session, buildAirflowRestrictionResult(session));
    case 'outdoor_unit_diag':
      return withRouteMetadata(session, buildOutdoorUnitResult(session));
    case 'refrigeration_diag':
      return withRouteMetadata(session, buildRefrigerationResult(session));
    case 'low_voltage_diag':
      return withRouteMetadata(session, buildLowVoltageResult(session));
    case 'line_voltage_diag':
      return withRouteMetadata(session, buildLineVoltageResult(session));
    case 'blower_diag':
      return withRouteMetadata(session, buildBlowerResult(session));
    case 'compressor_diag':
      return withRouteMetadata(session, buildCompressorResult(session));
    case 'condenser_fan_diag':
      return withRouteMetadata(session, buildCondenserFanResult(session));
    case 'board_control_diag':
      return withRouteMetadata(session, {
        route: 'board_control_diag',
        summary: 'Control power and a call appear present, so board-level output or safety interruption remains the leading branch.',
        routeReasons: getRouteReasons(session),
        confidenceLevel: 'medium',
        likelyCauses: [
          {
            title: 'Board output issue',
            why: 'The board may be powered but not passing the expected outputs to equipment.',
            nextCheck: 'Verify inputs versus outputs at the board under a live call.',
          },
          {
            title: 'Safety string interruption',
            why: 'A board can appear healthy while an external safety keeps loads from energizing.',
            nextCheck: 'Inspect any lockout, pressure, or auxiliary safety inputs tied to the board.',
          },
          {
            title: 'Relay or control path failure',
            why: 'A failed relay or weak control output can stop operation without losing all low voltage.',
            nextCheck: 'Test relay operation and downstream control voltage continuity.',
          },
        ],
        nextChecks: [
          'Compare board inputs to outputs under the active call.',
          'Check any safety inputs or lockout indicators.',
          'Verify relay switching and output continuity to the load.',
        ],
      });
    default:
      return withRouteMetadata(session, {
        route: session.currentRoute,
        summary: 'This route is stored and ready for deeper field logic in the next slice.',
        routeReasons: getRouteReasons(session),
        confidenceLevel: 'low',
        likelyCauses: [
          {
            title: 'Initial subsystem route selected',
            why: `Current route is ${session.currentRoute}, based on the answers captured so far.`,
            nextCheck: 'Use this route as the starting subsystem for the next diagnostic pass.',
          },
        ],
        nextChecks: ['Capture a few more subsystem-specific checks before ranking final causes.'],
      });
  }
}

export function generateResults(session: DiagnosticSession) {
  return buildDiagnosticResults(session);
}
