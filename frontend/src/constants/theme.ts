// ============================================================
// Quickpost Design System – Dark Theme (2026)
// Inspired by modern dark UI with pink/orange gradient accents
// ============================================================

export const Colors = {
  // Core brand
  primary: '#f43f5e',         // Rose/Pink
  primaryGrad: '#f97316',      // Orange (gradient end)
  primaryLight: 'rgba(244,63,94,0.14)',
  primaryMid: 'rgba(244,63,94,0.22)',
  secondary: '#8b5cf6',        // Purple accent

  // Backgrounds
  background: '#1c1e30',       // Lighter navy (user requested lighter theme)
  paper: '#262842',            // Card / sheet background
  subtle: '#212338',           // Slightly lighter dark
  surface: 'rgba(255,255,255,0.11)', // Glass/frosted surface

  // Text
  text: '#ffffff',
  textPrimary: '#ffffff',      // Alias for text
  textSecondary: '#a1a1aa',
  textTertiary: '#71717a',

  // Borders
  border: 'rgba(255,255,255,0.13)',
  borderActive: 'rgba(255,255,255,0.30)',

  // Status
  success: '#4ade80',
  successLight: 'rgba(74,222,128,0.13)',
  error: '#f87171',
  errorLight: 'rgba(248,113,113,0.13)',
  warning: '#fbbf24',
  warningLight: 'rgba(251,191,36,0.13)',

  // Platforms
  instagram: '#e1306c',
  facebook: '#1877f2',

  white: '#ffffff',
  black: '#000000',
};

export const GradientColors = {
  primary: ['#f43f5e', '#f97316'] as [string, string],
  purple: ['#8b5cf6', '#6366f1'] as [string, string],
  dark: ['#262842', '#1c1e30'] as [string, string],
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const Typography = {
  h1: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5, color: '#ffffff' },
  h2: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3, color: '#ffffff' },
  h3: { fontSize: 20, fontWeight: '700' as const, color: '#ffffff' },
  h4: { fontSize: 17, fontWeight: '600' as const, color: '#ffffff' },
  bodyLarge: { fontSize: 16, lineHeight: 24, color: '#ffffff' },
  body: { fontSize: 14, lineHeight: 20, color: '#ffffff' },
  bodySmall: { fontSize: 12, lineHeight: 18, color: '#a1a1aa' },
  label: { fontSize: 12, fontWeight: '600' as const, color: '#a1a1aa' },
  caption: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.3, color: '#71717a' },
  title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5, color: '#ffffff' },
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primary: {
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 16,
    elevation: 10,
  },
};
