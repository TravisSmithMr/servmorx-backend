import * as ImagePicker from 'expo-image-picker';

import type { EquipmentCapture } from '@/types/diagnostic';

export interface CapturedEquipmentImage {
  capture: EquipmentCapture;
  base64: string | null;
}

const toCapturedImage = (asset: ImagePicker.ImagePickerAsset): CapturedEquipmentImage => ({
  capture: {
    uri: asset.uri,
    fileName: asset.fileName ?? null,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType,
    capturedAt: new Date().toISOString(),
  },
  base64: asset.base64 ?? null,
});

export async function requestCameraPermission() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  return permission;
}

export async function requestMediaLibraryPermission() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return permission;
}

export async function captureEquipmentImage() {
  const permission = await requestCameraPermission();

  if (!permission.granted) {
    throw new Error('Camera permission is required to scan the data tag.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: false,
    base64: true,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return toCapturedImage(result.assets[0]);
}

export async function pickEquipmentImage() {
  const permission = await requestMediaLibraryPermission();

  if (!permission.granted) {
    throw new Error('Photo library permission is required to pick a saved image.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: false,
    base64: true,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return toCapturedImage(result.assets[0]);
}
