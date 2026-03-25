// ============================================================
// Quickpost Design System – Dark Theme (2026)
// Inspired by modern dark UI with purple/blue gradient accents
// ============================================================

export const Colors = {
  // Core brand (Design System)
  primary: '#ba9eff', // Primary accent
  secondary: '#699cff', // Secondary accent
  tertiary: '#ec63ff',

  // Button/glow helpers (kept for existing components)
  primaryGrad: '#699cff', // Gradient end
  primaryLight: 'rgba(186,158,255,0.14)',
  primaryMid: 'rgba(186,158,255,0.22)',

  // Backgrounds
  background: '#060e20', // Deep navy
  paper: '#0f1930', // Surface container
  subtle: '#141f38', // Surface container high
  surface: 'rgba(20,31,56,0.35)', // Glass-ish surface

  surfaceContainer: '#0f1930',
  surfaceContainerHigh: '#141f38',
  surfaceContainerHighest: '#192540',

  // Text
  text: '#dee5ff',
  textPrimary: '#dee5ff', // On surface text
  textSecondary: '#a3aac4', // Muted text (on surface variant)
  textTertiary: '#a3aac4',

  // Borders
  border: '#40485d', // Outline variant
  borderActive: 'rgba(186,158,255,0.35)',

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
  // Primary buttons: #ba9eff -> #699cff
  primary: ['#ba9eff', '#699cff'] as [string, string],
  purple: ['#ba9eff', '#ec63ff'] as [string, string],
  dark: ['#060e20', '#141f38'] as [string, string],
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
  sm: 12,
  md: 20,
  lg: 24,
  xl: 24,
  full: 999,
};

export const Typography = {
  // Note: font families fall back to system fonts if Manrope/Inter aren't loaded.
  h1: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5, color: '#dee5ff', fontFamily: 'Manrope' },
  h2: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3, color: '#dee5ff', fontFamily: 'Manrope' },
  h3: { fontSize: 20, fontWeight: '700' as const, color: '#dee5ff', fontFamily: 'Manrope' },
  h4: { fontSize: 17, fontWeight: '600' as const, color: '#dee5ff', fontFamily: 'Manrope' },
  bodyLarge: { fontSize: 16, lineHeight: 24, color: '#dee5ff', fontFamily: 'Inter' },
  body: { fontSize: 14, lineHeight: 20, color: '#dee5ff', fontFamily: 'Inter' },
  bodySmall: { fontSize: 12, lineHeight: 18, color: '#a3aac4', fontFamily: 'Inter' },
  label: { fontSize: 12, fontWeight: '600' as const, color: '#a3aac4', fontFamily: 'Inter' },
  caption: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.3, color: '#a3aac4', fontFamily: 'Inter' },
  title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5, color: '#dee5ff', fontFamily: 'Manrope' },
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
    shadowColor: '#ba9eff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 16,
    elevation: 10,
  },
};
