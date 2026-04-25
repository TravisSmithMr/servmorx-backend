import type {
  DiagnosticCause,
  DiagnosticSession,
  ResultConfidenceLevel,
} from '@/types/diagnostic';

function getKnownCount(values: Array<string | undefined>) {
  return values.filter((value) => value && value !== 'not_sure').length;
}

function getUnknownCount(values: Array<string | undefined>) {
  return values.filter((value) => !value || value === 'not_sure').length;
}

function resolveConfidenceLevel(session: DiagnosticSession): ResultConfidenceLevel {
  const values = [
    session.gateAnswers.thermostatCalling,
    session.gateAnswers.indoorFanRunning,
    session.gateAnswers.outdoorUnitRunning,
    session.gateAnswers.airflowStrength,
    session.diagAnswers.contactorEngaged,
    session.diagAnswers.contactorCoilVoltagePresent,
    session.diagAnswers.outdoorPowerPresent,
    session.diagAnswers.disconnectOn,
    session.diagAnswers.fanOnlyRunning,
    session.diagAnswers.compressorOnlyRunning,
    session.diagAnswers.outdoorLoadsBothOff,
  ];
  const known = getKnownCount(values);
  const unknown = getUnknownCount(values);
  const contradictions =
    (session.diagAnswers.fanOnlyRunning === 'yes' && session.diagAnswers.compressorOnlyRunning === 'yes') ||
    (session.diagAnswers.outdoorLoadsBothOff === 'yes' &&
      (session.diagAnswers.fanOnlyRunning === 'yes' || session.diagAnswers.compressorOnlyRunning === 'yes')) ||
    (session.diagAnswers.contactorEngaged === 'no' &&
      (session.diagAnswers.fanOnlyRunning === 'yes' || session.diagAnswers.compressorOnlyRunning === 'yes'));

  if (!contradictions && known >= 7 && unknown <= 2) {
    return 'high';
  }

  if (!contradictions && known >= 4) {
    return 'medium';
  }

  return 'low';
}

function sortByEquipmentContext(session: DiagnosticSession, causes: DiagnosticCause[]) {
  const haystack = [session.brand, session.modelNumber, ...session.commonFaults]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return [...causes].sort((left, right) => {
    const leftBoost = haystack.includes(left.title.toLowerCase()) ? 1 : 0;
    const rightBoost = haystack.includes(right.title.toLowerCase()) ? 1 : 0;
    return rightBoost - leftBoost;
  });
}

export function buildOutdoorUnitDiagnosticResult(session: DiagnosticSession) {
  const {
    thermostatCalling,
    indoorFanRunning,
    outdoorUnitRunning,
  } = session.gateAnswers;
  const {
    contactorEngaged,
    contactorCoilVoltagePresent,
    outdoorPowerPresent,
    disconnectOn,
    fanOnlyRunning,
    compressorOnlyRunning,
    outdoorLoadsBothOff,
  } = session.diagAnswers;

  const confidenceLevel = resolveConfidenceLevel(session);

  if (contactorEngaged === 'no') {
    const likelyCauses = sortByEquipmentContext(session, [
      {
        title: 'No 24V to condenser',
        why:
          contactorCoilVoltagePresent === 'no'
            ? 'The contactor is not pulled in and there is no 24V at the coil, which points upstream of the contactor.'
            : 'The contactor is not pulled in, so the first likely failure is still the low-voltage call path.',
        nextCheck: 'Measure 24V at the contactor coil and trace the Y call back through safeties and wiring.',
      },
      {
        title: 'Broken low-voltage wire',
        why: 'An open Y wire or damaged control conductor can keep the condenser off while the indoor unit still responds.',
        nextCheck: 'Inspect and continuity-check the low-voltage run between indoor and outdoor equipment.',
      },
      {
        title: 'Thermostat / control issue',
        why:
          thermostatCalling === 'yes'
            ? 'A claimed cooling call that never reaches the condenser still leaves the control path in play.'
            : 'If the thermostat is not clearly calling, the control issue remains a top cause.',
        nextCheck: 'Verify the cooling call at the indoor board and confirm it is being passed to the condenser.',
      },
    ]);

    return {
      summary:
        'The condenser is not pulling in, so the first outdoor branch stays on the low-voltage call path rather than the load side.',
      likelyCauses,
      nextChecks: [
        'Check whether the contactor is mechanically pulled in under a live call.',
        'Measure 24V at the contactor coil.',
        'Trace the Y circuit through safeties, wire splices, and the indoor board.',
        'Only condemn the contactor after confirming coil voltage.',
      ],
      confidenceLevel,
    };
  }

  if (contactorEngaged === 'yes' && (outdoorPowerPresent === 'no' || disconnectOn === 'no')) {
    const likelyCauses = sortByEquipmentContext(session, [
      {
        title: 'Line voltage missing at condenser',
        why: 'The contactor is in or commanded, but the unit does not have confirmed high voltage.',
        nextCheck: 'Verify line voltage at the disconnect and at the contactor line/load side.',
      },
      {
        title: 'Disconnect / breaker issue',
        why: 'A tripped breaker, pulled disconnect, or blown fuse can leave the outdoor unit dead under a valid call.',
        nextCheck: 'Inspect breaker, fuses, and disconnect condition before replacing condenser components.',
      },
      {
        title: 'Power feed or wiring issue',
        why: 'If the disconnect is on but voltage is still absent, the fault may be upstream wiring or terminal failure.',
        nextCheck: 'Backtrack the power feed from disconnect to panel and inspect all terminations.',
      },
    ]);

    return {
      summary:
        'The condenser appears to be commanded on, but the load side still points to missing line voltage or disconnect power.',
      likelyCauses,
      nextChecks: [
        'Confirm disconnect or breaker status first.',
        'Measure line voltage at the outdoor unit.',
        'Inspect fuses, pull-out disconnect, and lug terminations.',
        'Backtrack the feed if voltage is missing at the cabinet.',
      ],
      confidenceLevel,
    };
  }

  if (fanOnlyRunning === 'yes') {
    const likelyCauses = sortByEquipmentContext(session, [
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
    ]);

    return {
      summary:
        'The condenser fan is running but the compressor side is not, so the outdoor diagnosis narrows to the compressor circuit.',
      likelyCauses,
      nextChecks: [
        'Test the compressor capacitor first.',
        'Check compressor amp draw and winding resistance.',
        'Inspect for internal overload or locked-rotor behavior.',
        'Verify whether any board or safety logic is holding only the compressor off.',
      ],
      confidenceLevel,
    };
  }

  if (compressorOnlyRunning === 'yes') {
    const likelyCauses = sortByEquipmentContext(session, [
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
    ]);

    return {
      summary:
        'The compressor is running but the condenser fan is not, so the next checks stay on the fan motor side.',
      likelyCauses,
      nextChecks: [
        'Shut down if head pressure or fan stall risk is high.',
        'Test the fan capacitor.',
        'Confirm voltage at the fan motor.',
        'Inspect motor condition, wiring, and relay output.',
      ],
      confidenceLevel,
    };
  }

  if (outdoorLoadsBothOff === 'yes') {
    const likelyCauses = sortByEquipmentContext(session, [
      {
        title: 'Power feed issue',
        why: 'Both outdoor loads are off, which strongly suggests a missing or interrupted power path.',
        nextCheck: 'Verify disconnect, breaker, and line voltage at the unit under the active call.',
      },
      {
        title: 'Contactor or control issue',
        why: 'If the contactor is not truly energized under the call, neither load will receive power.',
        nextCheck: 'Confirm contactor state and coil voltage under load.',
      },
      {
        title: 'Open safety or wiring issue',
        why: 'A safety interruption or open wiring path can leave the entire outdoor section dead.',
        nextCheck: 'Trace control and power paths together and inspect for open safeties or burned wiring.',
      },
    ]);

    return {
      summary:
        'With both outdoor loads off, the condenser branch stays on power and control delivery before narrowing to a single component.',
      likelyCauses,
      nextChecks: [
        'Confirm whether the contactor is actually in.',
        'Measure 24V at the coil and line voltage at the unit.',
        'Inspect disconnect, breaker, and fuses.',
        'Trace any open safety or damaged wiring path.',
      ],
      confidenceLevel,
    };
  }

  const likelyCauses = sortByEquipmentContext(session, [
    {
      title: 'Outdoor power or contactor issue',
      why:
        indoorFanRunning === 'yes' && outdoorUnitRunning === 'no'
          ? 'The indoor side responds but the condenser branch is still not producing a clear outdoor start condition.'
          : 'No Cooling still leans outdoor based on the captured answers.',
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
  ]);

  return {
    summary:
      'The condenser is still the strongest branch, but more outdoor confirmation is needed before the likely cause ranking can tighten further.',
    likelyCauses,
    nextChecks: [
      'Confirm contactor state first.',
      'Measure 24V at the contactor coil.',
      'Verify line voltage and disconnect state.',
      'Separate fan-only, compressor-only, or both-off behavior.',
    ],
    confidenceLevel,
  };
}
