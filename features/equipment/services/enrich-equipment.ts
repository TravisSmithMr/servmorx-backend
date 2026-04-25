import type { SpecData, WarrantyStatus } from '@/types/diagnostic';

export interface SpecLookupInput {
  brand: string | null;
  modelNumber: string | null;
}

export interface WarrantyLookupInput extends SpecLookupInput {
  serialNumber: string | null;
}

export interface EquipmentEnrichmentResult {
  specData: SpecData | null;
  warrantyStatus: WarrantyStatus;
  warrantyDetails: string | null;
  commonFaults: string[];
}

export async function lookupSpecData({ brand, modelNumber }: SpecLookupInput) {
  if (!brand || !modelNumber) {
    return null;
  }

  return {
    nominalTonnage: modelNumber.includes('036') ? '3 ton' : 'Unknown tonnage',
    refrigerant: 'R-410A',
    voltage: '208/230V',
    notes: `${brand} ${modelNumber} mock spec lookup`,
  } satisfies SpecData;
}

export async function lookupWarranty({
  brand,
  modelNumber,
  serialNumber,
}: WarrantyLookupInput) {
  if (!brand || !modelNumber) {
    return {
      warrantyStatus: 'check_required' as const,
      warrantyDetails: 'Model information is incomplete for warranty lookup.',
    };
  }

  const isLikelyCovered = Boolean(serialNumber && serialNumber.startsWith('24'));
  const warrantyStatus: WarrantyStatus = isLikelyCovered ? 'in_warranty' : 'out_of_warranty';

  return {
    warrantyStatus,
    warrantyDetails: isLikelyCovered
      ? `${brand} mock warranty lookup suggests remaining coverage.`
      : `${brand} mock warranty lookup suggests coverage should be verified manually.`,
  };
}

export async function enrichEquipmentContext(input: WarrantyLookupInput) {
  const [specData, warranty] = await Promise.all([
    lookupSpecData(input),
    lookupWarranty(input),
  ]);

  return {
    specData,
    warrantyStatus: warranty.warrantyStatus,
    warrantyDetails: warranty.warrantyDetails,
    commonFaults: input.brand
      ? [
          `${input.brand} blower module failures reported in similar platforms`,
          'Board low-voltage or relay output issues can mimic motor failure',
        ]
      : ['Common faults unavailable until brand/model is confirmed'],
  } satisfies EquipmentEnrichmentResult;
}
