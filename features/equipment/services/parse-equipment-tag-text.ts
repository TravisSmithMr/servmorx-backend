import type { ScanDebugData, SystemTypeId } from '@/types/diagnostic';

type ParsedToken = {
  reason: string;
  score: number;
  value: string;
};

type BrandCandidate = {
  brand: string;
  matchedText: string;
  method: 'exact' | 'fuzzy';
  score: number;
};

type BrandMatch = {
  brand: string | null;
  method: 'exact' | 'fuzzy' | 'none';
  score: number;
};

export interface EquipmentParserDebug {
  normalizedText: string;
  brandCandidates: string[];
  modelCandidates: string[];
  serialCandidates: string[];
  confidenceSignals: string[];
  failureReason: string | null;
}

export interface EquipmentParserResult {
  brand: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  detectedUnitType: string | null;
  detectedSystemType: SystemTypeId | null;
  extractionConfidence: number;
  debug: EquipmentParserDebug;
}

const KNOWN_BRANDS = [
  { brand: 'Trane', aliases: ['TRANE', 'AMERICAN STANDARD'] },
  { brand: 'Carrier', aliases: ['CARRIER', 'BRYANT', 'PAYNE'] },
  { brand: 'Lennox', aliases: ['LENNOX'] },
  { brand: 'Goodman', aliases: ['GOODMAN', 'AMANA'] },
  { brand: 'Rheem', aliases: ['RHEEM', 'RUUD'] },
] as const;

const LABEL_MODEL_PATTERNS = [
  /(?:^|\b)(?:model|mod)(?:\s*(?:no|number|#|n[o0]\.?))?[\s:#.-]*([a-z0-9\-/.]{4,32})/i,
  /(?:^|\b)product(?:\s*(?:no|number|#|n[o0]\.?))?[\s:#.-]*([a-z0-9\-/.]{4,32})/i,
  /(?:^|\b)m\s*\/\s*n[\s:#.-]*([a-z0-9\-/.]{4,32})/i,
  /(?:^|\b)m\s*-\s*n[\s:#.-]*([a-z0-9\-/.]{4,32})/i,
  /(?:^|\b)mn[\s:#.-]*([a-z0-9\-/.]{4,32})/i,
];

const LABEL_SERIAL_PATTERNS = [
  /(?:^|\b)(?:serial|ser)(?:\s*(?:no|number|#|n[o0]\.?))?[\s:#.-]*([a-z0-9\-/.]{4,32})/i,
  /(?:^|\b)s\s*\/\s*n[\s:#.-]*([a-z0-9\-/.]{4,32})/i,
  /(?:^|\b)s\s*-\s*n[\s:#.-]*([a-z0-9\-/.]{4,32})/i,
  /(?:^|\b)sn[\s:#.-]*([a-z0-9\-/.]{4,32})/i,
];

const GENERIC_TOKEN_PATTERN = /\b[A-Z0-9][A-Z0-9\-]{3,23}\b/g;
const VALUE_TOKEN_PATTERN = /\b[A-Z0-9][A-Z0-9\-/.]{3,31}\b/g;
const TOKEN_STOPLIST = new Set([
  'NO',
  'N0',
  'NUM',
  'MODEL',
  'NUMBER',
  'SERIAL',
  'MFR',
  'MFG',
  'DATE',
  'MADE',
  'PART',
  'CAT',
  'CATALOG',
  'PRODUCT',
  'VOLT',
  'VOLTS',
  'PHASE',
  'HERTZ',
  'LISTED',
  'UNIT',
  'OUTDOOR',
  'INDOOR',
  'HEAT',
  'PUMP',
  'AIR',
  'HANDLER',
  'FURNACE',
  'CONDENSING',
  'SYSTEM',
  'TYPE',
  'MODELNO',
  'SERIALNO',
]);

const BRAND_MODEL_HINTS: Record<string, RegExp[]> = {
  Trane: [/^(4T|4A|5T|5A|TEM|TUD|TUE|GAM|S8)/i],
  Carrier: [/^(24|25|38|39|40|58|59|FV|FB|FX)/i],
  Lennox: [/^(ML|EL|XC|XP|CB|CBA|SL|G[0-9]|C[0-9])/i],
  Goodman: [/^(GS|ASP|ARU|AVP|CAP|GM|DSZ|SSZ)/i],
  Rheem: [/^(RA|RH|RP|RG|RHM|RH1|R96|RX)/i],
};

const OCR_CHAR_SUBSTITUTIONS: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '2': 'Z',
  '4': 'A',
  '5': 'S',
  '6': 'G',
  '8': 'B',
  '|': 'I',
  '!': 'I',
  L: 'L',
};

function normalizeRawText(text: string) {
  return text
    .replace(/[|]/g, 'I')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/[^\x20-\x7E\r\n]/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n')
    .toUpperCase()
    .trim();
}

function normalizeOcrText(text: string) {
  return text
    .replace(/[|]/g, 'I')
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/[^\x20-\x7E\r\n]/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n')
    .toUpperCase()
    .trim();
}

function toUpperToken(value: string) {
  return value.replace(/[^A-Z0-9\-]/gi, '').toUpperCase();
}

function normalizeForBrandMatching(value: string) {
  return value
    .toUpperCase()
    .split('')
    .map((character) => OCR_CHAR_SUBSTITUTIONS[character] ?? character)
    .join('')
    .replace(/[^A-Z]/g, '');
}

function getLines(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeForLabelMatching(value: string) {
  return value
    .toUpperCase()
    .replace(/[|!]/g, 'I')
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/5/g, 'S')
    .replace(/[^A-Z0-9/#:\-. ]/g, ' ');
}

function levenshteinDistance(left: string, right: string) {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array.from<number>({ length: cols }).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row][0] = row;
  }

  for (let col = 0; col < cols; col += 1) {
    matrix[0][col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

function formatCandidateScore(label: string, score: number, reason: string) {
  return `${label} (score ${score.toFixed(2)}): ${reason}`;
}

function getBrandCandidates(text: string) {
  const rawTokens = text
    .toUpperCase()
    .split(/[^A-Z0-9!|]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const normalizedTokens = rawTokens.map((token) => normalizeForBrandMatching(token));
  const candidates = new Set<string>([normalizeForBrandMatching(text), ...normalizedTokens]);

  for (let index = 0; index < normalizedTokens.length - 1; index += 1) {
    candidates.add(`${normalizedTokens[index]}${normalizedTokens[index + 1]}`);
  }

  return [...candidates].filter(Boolean);
}

function detectBrand(text: string) {
  const candidates = getBrandCandidates(text);
  const matches: BrandCandidate[] = [];

  for (const candidate of candidates) {
    for (const entry of KNOWN_BRANDS) {
      for (const alias of entry.aliases) {
        const normalizedAlias = normalizeForBrandMatching(alias);

        if (candidate.includes(normalizedAlias)) {
          matches.push({
            brand: entry.brand,
            matchedText: candidate,
            method: 'exact',
            score: alias.includes(' ') ? 0.94 : 0.98,
          });
          continue;
        }

        const distance = levenshteinDistance(candidate, normalizedAlias);
        const maxDistance = normalizedAlias.length >= 7 ? 2 : 1;

        if (distance <= maxDistance) {
          matches.push({
            brand: entry.brand,
            matchedText: candidate,
            method: 'fuzzy',
            score: normalizedAlias.length >= 7 ? 0.7 : 0.66,
          });
        }
      }
    }
  }

  const sortedMatches = matches.sort((left, right) => right.score - left.score);
  const uniqueDisplay = Array.from(
    new Map(
      sortedMatches.map((match) => [
        `${match.brand}-${match.method}-${match.matchedText}`,
        `${match.brand} via ${match.method} match "${match.matchedText}" (${match.score.toFixed(2)})`,
      ])
    ).values()
  ).slice(0, 5);

  const best = sortedMatches[0];
  const brandMatch: BrandMatch =
    best && best.score >= 0.7
      ? { brand: best.brand, method: best.method, score: best.score }
      : { brand: null, method: 'none', score: 0 };

  return {
    brandCandidates: uniqueDisplay,
    brandMatch,
  };
}

function findLabeledValue(text: string, patterns: RegExp[], label: 'model' | 'serial') {
  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      const value = cleanFieldCandidate(match[1], label);

      if (!value) {
        continue;
      }

      return {
        reason: `Labeled ${label} field matched pattern ${pattern}`,
        score: 18,
        value,
      } satisfies ParsedToken;
    }
  }

  return null;
}

function stripLabelWords(value: string, label: 'model' | 'serial') {
  const labelPattern =
    label === 'model'
      ? /^(?:MODEL|MOD|M[\/\-. ]?N|NO|N0|NUMBER|NUM|#)+/i
      : /^(?:SERIAL|SER|S[\/\-. ]?N|NO|N0|NUMBER|NUM|#)+/i;

  return value.replace(labelPattern, '').trim();
}

function compactSeparatedCharacters(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 4 && parts.every((part) => /^[A-Z0-9]$/.test(part))) {
    return parts.join('');
  }

  return value;
}

function cleanFieldCandidate(value: string, label: 'model' | 'serial') {
  const compacted = compactSeparatedCharacters(value);
  const token = toUpperToken(stripLabelWords(compacted, label)).replace(/[/.]/g, '');

  if (token.length < 4 || token.length > 32) {
    return null;
  }

  if (TOKEN_STOPLIST.has(token)) {
    return null;
  }

  if (!/\d/.test(token)) {
    return null;
  }

  return token;
}

function firstCandidateFromText(value: string, label: 'model' | 'serial') {
  const compacted = compactSeparatedCharacters(value);
  const direct = compacted !== value ? cleanFieldCandidate(compacted, label) : null;

  if (direct) {
    return direct;
  }

  const matches = value.toUpperCase().match(VALUE_TOKEN_PATTERN) ?? [];

  for (const match of matches) {
    const cleaned = cleanFieldCandidate(match, label);

    if (cleaned) {
      return cleaned;
    }
  }

  return null;
}

function findLabelIndex(line: string, label: 'model' | 'serial') {
  const normalizedLine = normalizeForLabelMatching(line);
  const patterns =
    label === 'model'
      ? [
          /\b(?:MODEL|MOD)(?:\s*(?:NO|NUMBER|#))?\b/,
          /\bPRODUCT(?:\s*(?:NO|NUMBER|#))?\b/,
          /\bM\s*[\/\-.]?\s*N\b/,
        ]
      : [/\b(?:SERIAL|SER)(?:\s*(?:NO|NUMBER|#))?\b/, /\bS\s*[\/\-.]?\s*N\b/];

  for (const pattern of patterns) {
    const match = normalizedLine.match(pattern);

    if (match?.index !== undefined) {
      return match.index + match[0].length;
    }
  }

  return -1;
}

function collectLabeledValues(lines: string[], label: 'model' | 'serial') {
  const tokens: ParsedToken[] = [];

  lines.forEach((line, index) => {
    const labelEnd = findLabelIndex(line, label);

    if (labelEnd === -1) {
      return;
    }

    const sameLineCandidate = firstCandidateFromText(line.slice(labelEnd), label);

    if (sameLineCandidate) {
      tokens.push({
        reason: `Labeled ${label} field on same line.`,
        score: 24,
        value: sameLineCandidate,
      });
      return;
    }

    for (const offset of [1, 2]) {
      const nextLine = lines[index + offset];

      if (!nextLine) {
        continue;
      }

      const nextLineCandidate = firstCandidateFromText(nextLine, label);

      if (nextLineCandidate) {
        tokens.push({
          reason: `Labeled ${label} field with value ${offset} line${offset > 1 ? 's' : ''} below label.`,
          score: offset === 1 ? 22 : 18,
          value: nextLineCandidate,
        });
        break;
      }
    }
  });

  return tokens;
}

function collectCandidateTokens(lines: string[]) {
  const candidates: Array<{ token: string; line: string }> = [];

  for (const line of lines) {
    const upperLine = line.toUpperCase();
    const matches = upperLine.match(GENERIC_TOKEN_PATTERN) ?? [];

    for (const token of matches) {
      if (TOKEN_STOPLIST.has(token)) {
        continue;
      }

      candidates.push({ token, line: upperLine });
    }
  }

  return candidates;
}

function scoreModelToken(candidate: { token: string; line: string }, brand: string | null): ParsedToken {
  let score = 0;
  const reasons: string[] = [];
  const token = candidate.token;

  if (candidate.line.includes('MODEL') || candidate.line.includes('M/N')) {
    score += 8;
    reasons.push('near model label');
  }

  if (/[A-Z]/.test(token) && /\d/.test(token)) {
    score += 4;
    reasons.push('mixed letters and digits');
  }

  if (token.length >= 5 && token.length <= 24) {
    score += 2;
    reasons.push('plausible length');
  }

  if (brand && (BRAND_MODEL_HINTS[brand] ?? []).some((pattern) => pattern.test(token))) {
    score += 4;
    reasons.push(`matches ${brand} model prefix`);
  }

  return {
    reason: reasons.join(', ') || 'generic token',
    score,
    value: token,
  };
}

function scoreSerialToken(candidate: { token: string; line: string }, modelNumber: string | null): ParsedToken {
  let score = 0;
  const reasons: string[] = [];
  const token = candidate.token;

  if (candidate.line.includes('SERIAL') || candidate.line.includes('S/N')) {
    score += 8;
    reasons.push('near serial label');
  }

  if (token === modelNumber) {
    score -= 8;
    reasons.push('same as model candidate');
  }

  if (/\d{4,}/.test(token)) {
    score += 4;
    reasons.push('contains long digit sequence');
  }

  if (token.length >= 6 && token.length <= 22) {
    score += 2;
    reasons.push('plausible serial length');
  }

  return {
    reason: reasons.join(', ') || 'generic token',
    score,
    value: token,
  };
}

function pickTopCandidates(tokens: ParsedToken[], minimumScore: number) {
  return [...tokens]
    .sort((left, right) => right.score - left.score)
    .filter((token, index, array) => array.findIndex((entry) => entry.value === token.value) === index)
    .filter((token) => token.score >= minimumScore)
    .slice(0, 5);
}

function hasLabelHint(lines: string[], label: 'model' | 'serial') {
  return lines.some((line) => findLabelIndex(line, label) !== -1);
}

function buildOcrQualitySignals({
  normalizedText,
  lines,
  tokenCount,
}: {
  normalizedText: string;
  lines: string[];
  tokenCount: number;
}) {
  const signals: string[] = [
    `OCR text length: ${normalizedText.length} characters.`,
    `OCR line count: ${lines.length}.`,
    `Generic token count: ${tokenCount}.`,
  ];

  if (!normalizedText) {
    signals.push('Backend returned no OCR text to parse.');
  } else if (normalizedText.length < 24) {
    signals.push('OCR text is very short; the image may be too blurry, cropped, or underexposed.');
  }

  if (hasLabelHint(lines, 'model')) {
    signals.push('Model label hint found in OCR text.');
  } else {
    signals.push('No model label hint found in OCR text.');
  }

  if (hasLabelHint(lines, 'serial')) {
    signals.push('Serial label hint found in OCR text.');
  } else {
    signals.push('No serial label hint found in OCR text.');
  }

  return signals;
}

function inferUnitType(text: string) {
  const lower = text.toLowerCase();

  if (lower.includes('heat pump')) {
    return 'heat_pump_outdoor';
  }

  if (lower.includes('air handler')) {
    return 'air_handler';
  }

  if (lower.includes('furnace')) {
    return 'furnace';
  }

  if (lower.includes('condensing unit') || lower.includes('outdoor unit') || lower.includes('condenser')) {
    return 'condensing_unit';
  }

  return null;
}

function inferSystemType(text: string, unitType: string | null): SystemTypeId | null {
  const lower = text.toLowerCase();

  if (lower.includes('heat pump')) {
    return 'heat_pump';
  }

  if (unitType === 'air_handler' || unitType === 'condensing_unit' || lower.includes('split')) {
    return 'split_system_ac';
  }

  if (unitType === 'furnace') {
    return 'furnace';
  }

  return null;
}

function calculateConfidence({
  brandMatch,
  labeledModel,
  labeledSerial,
  heuristicModel,
  heuristicSerial,
}: {
  brandMatch: BrandMatch;
  labeledModel: ParsedToken | null;
  labeledSerial: ParsedToken | null;
  heuristicModel: ParsedToken | null;
  heuristicSerial: ParsedToken | null;
}) {
  const confidenceSignals: string[] = [];
  let score = 0;

  if (brandMatch.method === 'exact') {
    score += 0.34;
    confidenceSignals.push(`Exact brand match for ${brandMatch.brand}.`);
  } else if (brandMatch.method === 'fuzzy') {
    score += 0.16;
    confidenceSignals.push(`Fuzzy brand match for ${brandMatch.brand}.`);
  } else {
    confidenceSignals.push('No reliable brand keyword match.');
  }

  if (labeledModel) {
    score += 0.38;
    confidenceSignals.push('Labeled model field matched.');
  } else if (heuristicModel) {
    score += 0.12;
    confidenceSignals.push('Model is heuristic only, not labeled.');
  } else {
    confidenceSignals.push('No plausible model candidate found.');
  }

  if (labeledSerial) {
    score += 0.2;
    confidenceSignals.push('Labeled serial field matched.');
  } else if (heuristicSerial) {
    score += 0.06;
    confidenceSignals.push('Serial is heuristic only, not labeled.');
  } else {
    confidenceSignals.push('No plausible serial candidate found.');
  }

  if (brandMatch.method !== 'exact' || !labeledModel) {
    score = Math.min(score, 0.58);
  }

  if (!brandMatch.brand && !labeledModel && !labeledSerial) {
    score = Math.min(score, 0.18);
  }

  return {
    confidenceSignals,
    extractionConfidence: Number(Math.max(0, Math.min(score, 0.92)).toFixed(2)),
  };
}

function buildFailureReason({
  brand,
  modelNumber,
  serialNumber,
  normalizedText,
  lines,
  brandCandidateCount,
  modelCandidateCount,
  serialCandidateCount,
}: {
  brand: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  normalizedText: string;
  lines: string[];
  brandCandidateCount: number;
  modelCandidateCount: number;
  serialCandidateCount: number;
}) {
  if (!normalizedText) {
    return 'Backend OCR returned no text. Retake the photo closer, flatter, and with the tag filling the frame.';
  }

  if (normalizedText.length < 24 || lines.length < 2) {
    return 'OCR returned too little usable text for equipment parsing. Retake with better focus and less glare.';
  }

  if (!brand && !modelNumber && !serialNumber) {
    return `OCR text was received, but parser found no reliable brand/model/serial candidates. Candidate counts: brand ${brandCandidateCount}, model ${modelCandidateCount}, serial ${serialCandidateCount}.`;
  }

  if (!brand) {
    return 'Model or serial may be present, but no supported brand keyword was matched reliably.';
  }

  if (!modelNumber) {
    return 'Brand or serial may be present, but no model value was matched from a model label or plausible token.';
  }

  if (!serialNumber) {
    return 'Brand and model may be present, but no serial value was matched from a serial label or plausible token.';
  }

  return null;
}

export function parseEquipmentText(text: string): EquipmentParserResult {
  const normalizedText = normalizeOcrText(text);
  const lines = getLines(normalizedText);
  const { brandCandidates, brandMatch } = detectBrand(normalizedText);
  const patternLabeledModel = findLabeledValue(normalizedText, LABEL_MODEL_PATTERNS, 'model');
  const patternLabeledSerial = findLabeledValue(normalizedText, LABEL_SERIAL_PATTERNS, 'serial');
  const labeledModelCandidates = pickTopCandidates(
    [
      ...(patternLabeledModel ? [patternLabeledModel] : []),
      ...collectLabeledValues(lines, 'model'),
    ],
    14
  );
  const labeledSerialCandidates = pickTopCandidates(
    [
      ...(patternLabeledSerial ? [patternLabeledSerial] : []),
      ...collectLabeledValues(lines, 'serial'),
    ],
    14
  );
  const labeledModel = labeledModelCandidates[0] ?? null;
  const labeledSerial = labeledSerialCandidates[0] ?? null;
  const tokenCandidates = collectCandidateTokens(lines);

  const heuristicModelCandidates = pickTopCandidates(
    tokenCandidates.map((candidate) => scoreModelToken(candidate, brandMatch.brand)),
    6
  );
  const modelNumber = labeledModel?.value ?? heuristicModelCandidates[0]?.value ?? null;

  const heuristicSerialCandidates = pickTopCandidates(
    tokenCandidates.map((candidate) => scoreSerialToken(candidate, modelNumber)),
    6
  );
  const serialNumber = labeledSerial?.value ?? heuristicSerialCandidates[0]?.value ?? null;

  const { confidenceSignals, extractionConfidence } = calculateConfidence({
    brandMatch,
    labeledModel,
    labeledSerial,
    heuristicModel: heuristicModelCandidates[0] ?? null,
    heuristicSerial: heuristicSerialCandidates[0] ?? null,
  });

  const detectedUnitType = inferUnitType(normalizedText);
  const detectedSystemType = inferSystemType(normalizedText, detectedUnitType);
  const qualitySignals = buildOcrQualitySignals({
    normalizedText,
    lines,
    tokenCount: tokenCandidates.length,
  });
  const failureReason = buildFailureReason({
    brand: brandMatch.brand,
    modelNumber,
    serialNumber,
    normalizedText,
    lines,
    brandCandidateCount: brandCandidates.length,
    modelCandidateCount: labeledModelCandidates.length + heuristicModelCandidates.length,
    serialCandidateCount: labeledSerialCandidates.length + heuristicSerialCandidates.length,
  });

  return {
    brand: brandMatch.brand,
    modelNumber,
    serialNumber,
    detectedUnitType,
    detectedSystemType,
    extractionConfidence,
    debug: {
      normalizedText,
      brandCandidates,
      modelCandidates: [
        ...labeledModelCandidates.map((candidate) =>
          formatCandidateScore(candidate.value, candidate.score, candidate.reason)
        ),
        ...heuristicModelCandidates.map((candidate) =>
          formatCandidateScore(candidate.value, candidate.score, candidate.reason)
        ),
      ],
      serialCandidates: [
        ...labeledSerialCandidates.map((candidate) =>
          formatCandidateScore(candidate.value, candidate.score, candidate.reason)
        ),
        ...heuristicSerialCandidates.map((candidate) =>
          formatCandidateScore(candidate.value, candidate.score, candidate.reason)
        ),
      ],
      confidenceSignals: [...qualitySignals, ...confidenceSignals],
      failureReason,
    },
  };
}

export function buildScanDebugData(
  debug: EquipmentParserDebug,
  providerPath: ScanDebugData['ocrProviderPath'],
  providerStatus: string,
  metadata?: Pick<
    ScanDebugData,
    'backendUrl' | 'httpStatus' | 'rawBackendResponse' | 'errorMessage' | 'openAiError'
  >
): ScanDebugData {
  return {
    normalizedOcrText: debug.normalizedText,
    ocrProviderPath: providerPath,
    ocrProviderStatus: providerStatus,
    backendUrl: metadata?.backendUrl ?? null,
    httpStatus: metadata?.httpStatus ?? null,
    rawBackendResponse: metadata?.rawBackendResponse ?? null,
    errorMessage: metadata?.errorMessage ?? null,
    openAiError: metadata?.openAiError ?? null,
    brandCandidates: debug.brandCandidates,
    modelCandidates: debug.modelCandidates,
    serialCandidates: debug.serialCandidates,
    confidenceSignals: debug.confidenceSignals,
    failureReason: debug.failureReason,
  };
}

export function parseEquipmentTagText(text: string) {
  return parseEquipmentText(text);
}
