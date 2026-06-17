export type ThemeMode = 'system' | 'light' | 'dark';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceHighlight: string;
  border: string;
  accent: string;
  text: string;
  muted: string;
  danger: string;
  success: string;
  overlay: string;
};

export type Theme = {
  isDark: boolean;
  mode: ThemeMode;
  colors: ThemeColors;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  typography: {
    title: { fontSize: number; lineHeight: number; fontWeight: '600' | '700' };
    subtitle: { fontSize: number; lineHeight: number; fontWeight: '600' };
    body: { fontSize: number; lineHeight: number; fontWeight: '500' };
    caption: { fontSize: number; lineHeight: number; fontWeight: '500' };
  };
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  subtitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;

export const darkColors: ThemeColors = {
  background: '#030303',
  surface: '#111111',
  surfaceHighlight: '#1A1A1A',
  border: 'rgba(255, 255, 255, 0.08)',
  accent: '#D4B483',
  text: '#EDEDED',
  muted: '#888888',
  danger: '#D96C6C',
  success: '#4ade80',
  overlay: 'rgba(0,0,0,0.55)',
};

export const lightColors: ThemeColors = {
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceHighlight: '#F2F2F2',
  border: 'rgba(0,0,0,0.10)',
  accent: '#A35D47',
  text: '#111111',
  muted: '#666666',
  danger: '#B42318',
  success: '#067647',
  overlay: 'rgba(0,0,0,0.20)',
};

export const buildTheme = (resolvedMode: Exclude<ThemeMode, 'system'>, mode: ThemeMode): Theme => {
  const isDark = resolvedMode === 'dark';
  return {
    isDark,
    mode,
    colors: isDark ? darkColors : lightColors,
    spacing,
    radius,
    typography,
  };
};
