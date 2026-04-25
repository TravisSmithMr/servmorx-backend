import { DarkTheme } from '@react-navigation/native';
import { Platform } from 'react-native';

export const servmorxTheme = {
  colors: {
    background: '#050B14',
    surface: '#0D1624',
    surfaceElevated: '#121E30',
    border: '#203349',
    accent: '#12D7C0',
    accentPressed: '#0FB5A1',
    accentSoft: 'rgba(18, 215, 192, 0.14)',
    text: '#F7FAFF',
    textMuted: '#9FB2CC',
    textDim: '#6F83A0',
    success: '#1BC98E',
    warning: '#F3A64B',
    danger: '#FF6B6B',
    shadow: 'rgba(0, 0, 0, 0.24)',
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 24,
    pill: 999,
  },
};

export const navigationDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: servmorxTheme.colors.accent,
    background: servmorxTheme.colors.background,
    card: servmorxTheme.colors.surface,
    text: servmorxTheme.colors.text,
    border: servmorxTheme.colors.border,
    notification: servmorxTheme.colors.accent,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const layout = {
  screenMaxWidth: 440,
};
