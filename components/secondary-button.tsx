import { Pressable, StyleSheet, Text } from 'react-native';

import { servmorxTheme } from '@/constants/theme';

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
}

export function SecondaryButton({ label, onPress }: SecondaryButtonProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: servmorxTheme.radius.md,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: servmorxTheme.spacing.md,
    backgroundColor: servmorxTheme.colors.surface,
  },
  pressed: {
    opacity: 0.86,
  },
  label: {
    color: servmorxTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
