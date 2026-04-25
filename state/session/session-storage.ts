import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DiagnosticSession } from '@/types/diagnostic';

const SESSION_STORAGE_KEY = 'servmorx.current-session';
let memorySession: DiagnosticSession | null = null;

function getAsyncStorageErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown AsyncStorage error.';
}

export async function loadStoredSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);

    if (!raw) {
      return memorySession;
    }

    return JSON.parse(raw) as DiagnosticSession;
  } catch (error) {
    console.warn('[session][storage] load failed, falling back to memory only:', getAsyncStorageErrorMessage(error));
    return memorySession;
  }
}

export async function persistSession(session: DiagnosticSession) {
  memorySession = session;

  try {
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn('[session][storage] persist failed, keeping session in memory only:', getAsyncStorageErrorMessage(error));
  }
}

export async function clearStoredSession() {
  memorySession = null;

  try {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn('[session][storage] clear failed:', getAsyncStorageErrorMessage(error));
  }
}
