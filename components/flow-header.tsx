import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { servmorxTheme } from '@/constants/theme';
import { ProgressSteps } from '@/components/progress-steps';

interface FlowHeaderProps {
  title: string;
  subtitle: string;
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
}

export function FlowHeader({
  title,
  subtitle,
  currentStep,
  totalSteps,
  onBack,
}: FlowHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          disabled={!onBack}
          onPress={onBack}
          style={({ pressed }) => [styles.iconButton, pressed ? styles.iconButtonPressed : null]}>
          <Ionicons
            name="arrow-back"
            size={22}
            color={onBack ? servmorxTheme.colors.text : servmorxTheme.colors.textDim}
          />
        </Pressable>
        <ProgressSteps current={currentStep} total={totalSteps} />
        <View style={styles.helpCircle}>
          <Ionicons
            name="help-circle-outline"
            size={24}
            color={servmorxTheme.colors.textMuted}
          />
        </View>
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: servmorxTheme.spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: servmorxTheme.spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: servmorxTheme.radius.pill,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: servmorxTheme.colors.surface,
  },
  iconButtonPressed: {
    opacity: 0.78,
  },
  helpCircle: {
    width: 40,
    alignItems: 'flex-end',
  },
  textBlock: {
    gap: servmorxTheme.spacing.sm,
  },
  title: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: '800',
    color: servmorxTheme.colors.text,
    letterSpacing: -1.4,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: servmorxTheme.colors.textMuted,
  },
});
