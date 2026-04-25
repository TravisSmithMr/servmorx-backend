import {
  captureEquipmentImage,
  pickEquipmentImage,
} from '@/features/equipment/services/capture-equipment-image';
import { enrichEquipmentContext } from '@/services/equipment-service';
import { extractEquipmentTag } from '@/services/extraction-service';

export async function captureEquipmentPhoto() {
  return captureEquipmentImage();
}

export async function selectEquipmentPhoto() {
  return pickEquipmentImage();
}

export async function processEquipmentScan(mode: 'camera' | 'library') {
  const capture =
    mode === 'camera' ? await captureEquipmentPhoto() : await selectEquipmentPhoto();

  if (!capture) {
    return null;
  }

  const extraction = await extractEquipmentTag({
    base64: capture.base64,
    mimeType: capture.capture.mimeType,
    fileName: capture.capture.fileName,
  });

  const enrichment = await enrichEquipmentContext({
    brand: extraction.brand,
    modelNumber: extraction.modelNumber,
    serialNumber: extraction.serialNumber,
  });

  return {
    capture: capture.capture,
    extraction,
    enrichment,
  };
}
