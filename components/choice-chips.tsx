import { Pressable, StyleSheet, Text, View } from 'react-native';

import { servmorxTheme } from '@/constants/theme';

interface ChoiceOption<T extends string> {
  label: string;
  value: T;
}

interface ChoiceChipsProps<T extends string> {
  options: ChoiceOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}

export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
}: ChoiceChipsProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.chip,
              selected ? styles.chipSelected : null,
              pressed ? styles.chipPressed : null,
            ]}>
            <Text style={[styles.label, selected ? styles.labelSelected : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: servmorxTheme.spacing.sm,
  },
  chip: {
    minHeight: 46,
    borderRadius: servmorxTheme.radius.pill,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
    backgroundColor: servmorxTheme.colors.surfaceElevated,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  chipSelected: {
    backgroundColor: servmorxTheme.colors.accentSoft,
    borderColor: servmorxTheme.colors.accent,
  },
  chipPressed: {
    opacity: 0.9,
  },
  label: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  labelSelected: {
    color: servmorxTheme.colors.accent,
  },
});
