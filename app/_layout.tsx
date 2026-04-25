import { ThemeProvider } from '@react-navigation/native';
import * as SystemUI from 'expo-system-ui';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { navigationDarkTheme, servmorxTheme } from '@/constants/theme';
import { SessionProvider, useSession } from '@/state/session-store';

function RootNavigator() {
  const { isHydrated } = useSession();

  if (!isHydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: servmorxTheme.colors.background,
        }}>
        <ActivityIndicator color={servmorxTheme.colors.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: servmorxTheme.colors.background },
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="equipment-intake" />
      <Stack.Screen name="scan-equipment" />
      <Stack.Screen name="equipment-confirmation" />
      <Stack.Screen name="manual-equipment" />
      <Stack.Screen name="system-type" />
      <Stack.Screen name="split-system-follow-up" />
      <Stack.Screen name="issue-selection" />
      <Stack.Screen name="no-cooling-gates" />
      <Stack.Screen name="no-airflow-gates" />
      <Stack.Screen name="weak-cooling-gates" />
      <Stack.Screen name="icing-gates" />
      <Stack.Screen name="system-idle-gates" />
      <Stack.Screen name="outdoor-unit-not-running-gates" />
      <Stack.Screen name="indoor-unit-diagnostic" />
      <Stack.Screen name="outdoor-unit-diagnostic" />
      <Stack.Screen name="secondary-diagnostic" />
      <Stack.Screen name="results" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(servmorxTheme.colors.background).catch(() => undefined);
  }, []);

  return (
    <SessionProvider>
      <ThemeProvider value={navigationDarkTheme}>
        <RootNavigator />
        <StatusBar style="light" />
      </ThemeProvider>
    </SessionProvider>
  );
}
