// ============================================================
// Quickpost design system — re-exports tokens from src/theme/colors
// ============================================================

import { Colors, shadowTint } from '../theme/colors';

export { Colors, shadowTint };
export type { AppColors } from '../theme/colors';

export const GradientColors = {
  primary: ['#6C63FF', '#4B44CC'] as [string, string],
  purple: ['#6C63FF', '#00D4AA'] as [string, string],
  dark: ['#F8F9FF', '#EEF0FF'] as [string, string],
  welcome: ['#F8F9FF', '#E6FAF7'] as [string, string],
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

/** Cards 16px, inputs 12px, buttons 24px radius */
export const BorderRadius = {
  input: 12,
  card: 16,
  button: 24,
  sm: 12,
  md: 16,
  lg: 16,
  xl: 24,
  full: 999,
};

export const Typography = {
  h1: {
    fontSize: 30,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    color: Colors.textPrimary,
    fontFamily: 'Manrope',
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    color: Colors.textPrimary,
    fontFamily: 'Manrope',
  },
  h3: { fontSize: 20, fontWeight: '700' as const, color: Colors.textPrimary, fontFamily: 'Manrope' },
  h4: { fontSize: 17, fontWeight: '600' as const, color: Colors.textPrimary, fontFamily: 'Manrope' },
  bodyLarge: { fontSize: 16, lineHeight: 24, color: Colors.textPrimary, fontFamily: 'Inter' },
  body: { fontSize: 14, lineHeight: 20, color: Colors.textPrimary, fontFamily: 'Inter' },
  bodySmall: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary, fontFamily: 'Inter' },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    fontFamily: 'Inter',
  },
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 0.4,
    color: Colors.textMuted,
    fontFamily: 'Inter',
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    color: Colors.textPrimary,
    fontFamily: 'Manrope',
  },
};

export const Shadows = {
  sm: {
    shadowColor: 'rgba(108, 99, 255, 0.12)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: 'rgba(108, 99, 255, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
  },
  primary: {
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    shadowColor: shadowTint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
};
