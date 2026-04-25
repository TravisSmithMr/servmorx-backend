import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { servmorxTheme } from '@/constants/theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, disabled = false }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.buttonDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null,
      ]}>
      <View style={styles.inner}>
        <Text style={[styles.label, disabled ? styles.labelDisabled : null]}>{label}</Text>
        <Ionicons
          name="arrow-forward"
          size={24}
          color={disabled ? servmorxTheme.colors.textDim : '#051218'}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: servmorxTheme.colors.accent,
    borderRadius: servmorxTheme.radius.lg,
    minHeight: 64,
    justifyContent: 'center',
    paddingHorizontal: servmorxTheme.spacing.lg,
  },
  buttonPressed: {
    backgroundColor: servmorxTheme.colors.accentPressed,
  },
  buttonDisabled: {
    backgroundColor: servmorxTheme.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
  },
  inner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#051218',
    fontSize: 20,
    fontWeight: '700',
  },
  labelDisabled: {
    color: servmorxTheme.colors.textDim,
  },
});
