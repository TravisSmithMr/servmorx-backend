import { StyleSheet, Text, View } from 'react-native';

import { servmorxTheme } from '@/constants/theme';

interface RoutePillProps {
  label: string;
}

export function RoutePill({ label }: RoutePillProps) {
  return (
    <View style={styles.pill}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: servmorxTheme.radius.pill,
    backgroundColor: servmorxTheme.colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  label: {
    color: servmorxTheme.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
