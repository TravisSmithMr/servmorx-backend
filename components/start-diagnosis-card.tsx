import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { servmorxTheme } from '@/constants/theme';

interface StartDiagnosisCardProps {
  onPress: () => void;
}

export function StartDiagnosisCard({ onPress }: StartDiagnosisCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}>
      <View style={styles.iconWrap}>
        <Ionicons name="search-outline" size={38} color={servmorxTheme.colors.accent} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Start New Diagnosis</Text>
        <Text style={styles.subtitle}>Begin a new job</Text>
      </View>
      <Ionicons name="arrow-forward" size={28} color="#051218" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: servmorxTheme.colors.accent,
    borderRadius: servmorxTheme.radius.lg,
    padding: servmorxTheme.spacing.lg,
    minHeight: 154,
    flexDirection: 'row',
    alignItems: 'center',
    gap: servmorxTheme.spacing.md,
  },
  cardPressed: {
    backgroundColor: servmorxTheme.colors.accentPressed,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: servmorxTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#07111C',
  },
  copy: {
    flex: 1,
    gap: servmorxTheme.spacing.xs,
  },
  title: {
    color: '#051218',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: '#14343A',
    fontSize: 17,
    fontWeight: '500',
  },
});
