import { StyleSheet, Text, TextInput, View } from 'react-native';

import { servmorxTheme } from '@/constants/theme';

interface FormFieldProps {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
}

export function FormField({ label, value, placeholder, onChangeText }: FormFieldProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={servmorxTheme.colors.textDim}
        style={styles.input}
        autoCapitalize="characters"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: servmorxTheme.spacing.sm,
  },
  label: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    minHeight: 56,
    borderRadius: servmorxTheme.radius.md,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
    backgroundColor: servmorxTheme.colors.surfaceElevated,
    paddingHorizontal: servmorxTheme.spacing.md,
    color: servmorxTheme.colors.text,
    fontSize: 17,
  },
});
