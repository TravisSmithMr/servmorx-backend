import type { PropsWithChildren, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, servmorxTheme } from '@/constants/theme';

interface AppScreenProps extends PropsWithChildren {
  footer?: ReactNode;
  supportPanel?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function AppScreen({ children, footer, supportPanel, contentContainerStyle }: AppScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardFrame}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.frame}>
          <ScrollView
            contentContainerStyle={[
              styles.content,
              supportPanel ? styles.contentWithPanel : null,
              footer ? styles.contentWithFooter : null,
              contentContainerStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
            {supportPanel ? <View style={styles.supportPanel}>{supportPanel}</View> : null}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: servmorxTheme.colors.background,
  },
  keyboardFrame: {
    flex: 1,
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: layout.screenMaxWidth,
    alignSelf: 'center',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: servmorxTheme.spacing.lg,
    paddingTop: servmorxTheme.spacing.md,
    paddingBottom: servmorxTheme.spacing.xl,
    gap: servmorxTheme.spacing.lg,
  },
  contentWithPanel: {
    paddingBottom: servmorxTheme.spacing.lg,
  },
  contentWithFooter: {
    paddingBottom: servmorxTheme.spacing.xxl,
  },
  supportPanel: {
    paddingTop: servmorxTheme.spacing.sm,
  },
  footer: {
    paddingHorizontal: servmorxTheme.spacing.lg,
    paddingTop: servmorxTheme.spacing.sm,
    paddingBottom: servmorxTheme.spacing.lg,
    backgroundColor: servmorxTheme.colors.background,
  },
});
