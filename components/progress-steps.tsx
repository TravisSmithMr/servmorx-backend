import { StyleSheet, View } from 'react-native';

import { servmorxTheme } from '@/constants/theme';

interface ProgressStepsProps {
  current: number;
  total: number;
}

export function ProgressSteps({ current, total }: ProgressStepsProps) {
  return (
    <View style={styles.track}>
      {Array.from({ length: total }).map((_, index) => {
        const active = index < current;

        return <View key={`progress-${index}`} style={[styles.step, active ? styles.active : null]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: servmorxTheme.spacing.xs,
    flex: 1,
  },
  step: {
    flex: 1,
    height: 6,
    borderRadius: servmorxTheme.radius.pill,
    backgroundColor: servmorxTheme.colors.surfaceElevated,
  },
  active: {
    backgroundColor: servmorxTheme.colors.accent,
  },
});
