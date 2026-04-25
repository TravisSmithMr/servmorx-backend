import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { servmorxTheme } from '@/constants/theme';

interface SelectionCardProps {
  title: string;
  description: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  selected: boolean;
  onPress: () => void;
  accentColor?: string;
  layout?: 'grid' | 'row';
}

export function SelectionCard({
  title,
  description,
  icon,
  selected,
  onPress,
  accentColor,
  layout = 'grid',
}: SelectionCardProps) {
  const tone = accentColor ?? servmorxTheme.colors.accent;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        layout === 'grid' ? styles.gridCard : styles.rowCard,
        selected ? [styles.cardSelected, { borderColor: tone }] : null,
        pressed ? styles.cardPressed : null,
      ]}>
      <View style={[styles.iconWrap, { borderColor: `${tone}55`, backgroundColor: `${tone}14` }]}>
        <MaterialCommunityIcons name={icon} size={layout === 'grid' ? 30 : 26} color={tone} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {layout === 'row' ? (
        <Ionicons name="arrow-forward" size={24} color={servmorxTheme.colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: servmorxTheme.radius.md,
    borderWidth: 1,
    borderColor: servmorxTheme.colors.border,
    backgroundColor: servmorxTheme.colors.surface,
    padding: servmorxTheme.spacing.md,
    gap: servmorxTheme.spacing.md,
  },
  gridCard: {
    width: '48%',
    minHeight: 176,
  },
  rowCard: {
    width: '100%',
    minHeight: 102,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardSelected: {
    backgroundColor: servmorxTheme.colors.surfaceElevated,
    shadowColor: servmorxTheme.colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  cardPressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: servmorxTheme.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: servmorxTheme.spacing.xs,
  },
  title: {
    color: servmorxTheme.colors.text,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  description: {
    color: servmorxTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
});
