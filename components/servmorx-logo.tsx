import { StyleSheet, Text, View } from 'react-native';

import { servmorxTheme } from '@/constants/theme';

export function ServmorxLogo() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.wordmark}>
        SERVMOR<Text style={styles.x}>X</Text>
      </Text>
      <Text style={styles.submark}>TECH</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 2,
  },
  wordmark: {
    color: servmorxTheme.colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  x: {
    color: servmorxTheme.colors.accent,
  },
  submark: {
    color: servmorxTheme.colors.accent,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 4,
  },
});
