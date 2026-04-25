import type { AnalyticsSignal, AnalyticsSummary, DiagnosticSession, SystemMeasurements } from '@/types/diagnostic';

type RefrigerantKey = 'R410A' | 'R22' | 'R454B';

type PressureTemperaturePoint = {
  pressure: number;
  temperature: number;
};

const pressureTemperatureTables: Record<RefrigerantKey, PressureTemperaturePoint[]> = {
  R410A: [
    { pressure: 90, temperature: 32 },
    { pressure: 105, temperature: 38 },
    { pressure: 118, temperature: 43 },
    { pressure: 130, temperature: 47 },
    { pressure: 145, temperature: 52 },
    { pressure: 165, temperature: 58 },
    { pressure: 190, temperature: 66 },
    { pressure: 220, temperature: 75 },
    { pressure: 255, temperature: 85 },
    { pressure: 295, temperature: 96 },
    { pressure: 335, temperature: 106 },
    { pressure: 375, temperature: 115 },
    { pressure: 418, temperature: 124 },
  ],
  R22: [
    { pressure: 50, temperature: 26 },
    { pressure: 58, temperature: 32 },
    { pressure: 68, temperature: 38 },
    { pressure: 79, temperature: 45 },
    { pressure: 92, temperature: 52 },
    { pressure: 106, temperature: 60 },
    { pressure: 125, temperature: 70 },
    { pressure: 146, temperature: 80 },
    { pressure: 170, temperature: 90 },
    { pressure: 196, temperature: 100 },
    { pressure: 226, temperature: 110 },
    { pressure: 259, temperature: 120 },
  ],
  R454B: [
    { pressure: 88, temperature: 32 },
    { pressure: 102, temperature: 38 },
    { pressure: 115, temperature: 43 },
    { pressure: 127, temperature: 47 },
    { pressure: 142, temperature: 52 },
    { pressure: 162, temperature: 58 },
    { pressure: 186, temperature: 66 },
    { pressure: 214, temperature: 75 },
    { pressure: 248, temperature: 85 },
    { pressure: 286, temperature: 96 },
    { pressure: 324, temperature: 106 },
    { pressure: 364, temperature: 115 },
    { pressure: 407, temperature: 124 },
  ],
};

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatNumericValue(value: number | null, suffix: string) {
  return value === null ? 'Not measured' : `${round(value)}${suffix}`;
}

function classifyRange(
  value: number | null,
  low: number,
  high: number
): 'low' | 'normal' | 'high' | 'insufficient' {
  if (value === null) {
    return 'insufficient';
  }

  if (value < low) {
    return 'low';
  }

  if (value > high) {
    return 'high';
  }

  return 'normal';
}

function pushSignal(
  signals: AnalyticsSignal[],
  id: string,
  label: string,
  value: number | null,
  suffix: string,
  note: string,
  low: number,
  high: number
) {
  signals.push({
    id,
    label,
    status: classifyRange(value, low, high),
    value: formatNumericValue(value, suffix),
    note,
  });
}

function normalizeRefrigerant(refrigerant: string | null | undefined): RefrigerantKey | null {
  if (!refrigerant) {
    return null;
  }

  const normalized = refrigerant.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (normalized.includes('410')) {
    return 'R410A';
  }

  if (normalized.includes('454')) {
    return 'R454B';
  }

  if (normalized.includes('22')) {
    return 'R22';
  }

  return null;
}

function interpolateTemperature(
  refrigerant: RefrigerantKey | null,
  pressure: number | null
): number | null {
  if (!refrigerant || pressure === null) {
    return null;
  }

  const table = pressureTemperatureTables[refrigerant];

  if (pressure <= table[0].pressure) {
    return table[0].temperature;
  }

  if (pressure >= table[table.length - 1].pressure) {
    return table[table.length - 1].temperature;
  }

  for (let index = 0; index < table.length - 1; index += 1) {
    const current = table[index];
    const next = table[index + 1];

    if (pressure >= current.pressure && pressure <= next.pressure) {
      const ratio = (pressure - current.pressure) / (next.pressure - current.pressure);
      return round(current.temperature + ratio * (next.temperature - current.temperature));
    }
  }

  return null;
}

function inferRefrigerant(sessionOrMeasurements: DiagnosticSession | SystemMeasurements) {
  if (!('measurements' in sessionOrMeasurements)) {
    return null;
  }

  return normalizeRefrigerant(sessionOrMeasurements.specData?.refrigerant);
}

export function analyzeSystemPerformance(
  sessionOrMeasurements: DiagnosticSession | SystemMeasurements
): AnalyticsSummary {
  const measurements =
    'measurements' in sessionOrMeasurements ? sessionOrMeasurements.measurements : sessionOrMeasurements;
  const refrigerant = inferRefrigerant(sessionOrMeasurements);

  const deltaT =
    measurements.indoorReturnTemp !== null && measurements.indoorSupplyTemp !== null
      ? round(measurements.indoorReturnTemp - measurements.indoorSupplyTemp)
      : null;
  const pressureSpread =
    measurements.liquidPressure !== null && measurements.suctionPressure !== null
      ? round(measurements.liquidPressure - measurements.suctionPressure)
      : null;
  const lineTempSpread =
    measurements.liquidLineTemp !== null && measurements.suctionLineTemp !== null
      ? round(measurements.liquidLineTemp - measurements.suctionLineTemp)
      : null;
  const saturatedSuctionTemp = interpolateTemperature(refrigerant, measurements.suctionPressure);
  const saturatedLiquidTemp = interpolateTemperature(refrigerant, measurements.liquidPressure);
  const calculatedSuperheat =
    saturatedSuctionTemp !== null && measurements.suctionLineTemp !== null
      ? round(measurements.suctionLineTemp - saturatedSuctionTemp)
      : measurements.superheat;
  const calculatedSubcool =
    saturatedLiquidTemp !== null && measurements.liquidLineTemp !== null
      ? round(saturatedLiquidTemp - measurements.liquidLineTemp)
      : measurements.subcool;

  const signals: AnalyticsSignal[] = [];
  const interpretation: string[] = [];
  const missingData: string[] = [];

  pushSignal(
    signals,
    'delta_t',
    'Indoor Delta T',
    deltaT,
    ' F',
    'Based on return minus supply. This is the fastest comfort-side measurement for a cooling complaint.',
    14,
    24
  );
  pushSignal(
    signals,
    'superheat',
    'Superheat',
    calculatedSuperheat,
    ' F',
    'Calculated when refrigerant and suction readings allow it, otherwise uses the entered value.',
    5,
    20
  );
  pushSignal(
    signals,
    'subcool',
    'Subcool',
    calculatedSubcool,
    ' F',
    'Calculated when refrigerant and liquid readings allow it, otherwise uses the entered value.',
    5,
    18
  );

  if (deltaT === null) {
    missingData.push('Capture return and supply temperatures to get an indoor delta T.');
  } else if (deltaT < 14) {
    interpretation.push('Delta T is low, which can support airflow loss, low load, or charge-related behavior.');
  } else if (deltaT > 24) {
    interpretation.push('Delta T is elevated, so verify airflow and coil loading before assuming the refrigerant side is healthy.');
  } else {
    interpretation.push('Delta T is in a workable first-pass cooling range.');
  }

  if (!refrigerant) {
    missingData.push('Refrigerant type is not known, so calculated superheat and subcool may be limited.');
  }

  if (calculatedSuperheat === null) {
    missingData.push('Add suction pressure and suction line temperature to calculate superheat.');
  } else if (calculatedSuperheat < 5) {
    interpretation.push('Superheat looks low, which can fit overfeed, flooding, or low-load behavior.');
  } else if (calculatedSuperheat > 20) {
    interpretation.push('Superheat looks high, which can support underfeed, low charge, or load/airflow problems.');
  } else {
    interpretation.push('Superheat is in a reasonable first-pass range.');
  }

  if (calculatedSubcool === null) {
    missingData.push('Add liquid pressure and liquid line temperature to calculate subcool.');
  } else if (calculatedSubcool < 5) {
    interpretation.push('Subcool looks low, which can support low charge or feed issues.');
  } else if (calculatedSubcool > 18) {
    interpretation.push('Subcool looks high, which can fit restriction, overcharge, or condenser-side heat rejection issues.');
  } else {
    interpretation.push('Subcool is in a reasonable first-pass range.');
  }

  if (measurements.suctionPressure === null || measurements.liquidPressure === null) {
    missingData.push('Capture suction and liquid pressures for better refrigeration-side context.');
  } else {
    interpretation.push(
      `Pressure spread is ${formatNumericValue(pressureSpread, ' psig')}. Read it alongside refrigerant type and ambient before making a charge call.`
    );
  }

  if (measurements.outdoorAmbientTemp === null) {
    missingData.push('Outdoor ambient helps contextualize head pressure and subcool.');
  }

  return {
    refrigerant,
    deltaT,
    pressureSpread,
    lineTempSpread,
    saturatedSuctionTemp,
    saturatedLiquidTemp,
    calculatedSuperheat,
    calculatedSubcool,
    signals,
    interpretation,
    missingData,
  };
}
