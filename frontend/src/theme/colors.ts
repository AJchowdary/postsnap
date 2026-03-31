/**
 * Quickpost design tokens — cool-toned light UI (Pomelli-aligned).
 * Use semantic `Colors` from `../constants/theme` in components; this file is the source of truth.
 */

export const palette = {
  primary: '#6C63FF',
  primaryDark: '#4B44CC',
  primaryLight: '#EEF0FF',
  accent: '#00D4AA',
  accentDark: '#00A888',
  accentLight: '#E6FAF7',
  bgBase: '#F8F9FF',
  bgSurface: '#FFFFFF',
  bgElevated: '#F0F2FF',
  border: '#E2E4F0',
  borderStrong: '#C8CBE0',
  textPrimary: '#1A1B2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textOnPrimary: '#FFFFFF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

export type Palette = typeof palette;

/** Soft shadow tint (primary channel) */
export const shadowTint = 'rgba(108, 99, 255, 0.08)';

/** Semantic map used across the app (includes legacy aliases). */
export const Colors = {
  ...palette,
  background: palette.bgBase,
  paper: palette.bgSurface,
  subtle: palette.bgElevated,
  surface: 'rgba(255,255,255,0.94)',
  surfaceContainer: palette.bgSurface,
  surfaceContainerHigh: palette.bgElevated,
  surfaceContainerHighest: '#E8EBFA',
  text: palette.textPrimary,
  textPrimary: palette.textPrimary,
  textSecondary: palette.textSecondary,
  textTertiary: palette.textMuted,
  textMuted: palette.textMuted,
  secondary: palette.accent,
  tertiary: palette.primaryDark,
  primaryGrad: palette.primaryDark,
  primaryMid: 'rgba(108, 99, 255, 0.15)',
  borderActive: 'rgba(108, 99, 255, 0.4)',
  successLight: 'rgba(16, 185, 129, 0.12)',
  /** Text/icons on successLight chip backgrounds */
  successOnLight: '#047857',
  errorLight: 'rgba(239, 68, 68, 0.1)',
  warningLight: 'rgba(245, 158, 11, 0.12)',
  /** Text/icons on warningLight chip backgrounds */
  warningOnLight: '#B45309',
  infoLight: 'rgba(59, 130, 246, 0.1)',
  /** Soft border on destructive / sign-out surfaces */
  errorBorderMuted: 'rgba(239, 68, 68, 0.25)',
  /** Modal / sheet scrims */
  overlay40: 'rgba(0, 0, 0, 0.4)',
  overlay55: 'rgba(0, 0, 0, 0.55)',
  /** Home hero gradient (LinearGradient stops) */
  homeHeroGradientStart: 'rgba(186, 158, 255, 0.28)',
  homeHeroGradientEnd: 'rgba(105, 156, 255, 0.2)',
  homeHeroIllustrationTint: 'rgba(186, 158, 255, 0.2)',
  inputBackground: palette.bgElevated,
  instagram: '#E1306C',
  facebook: '#1877F2',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type AppColors = typeof Colors;
