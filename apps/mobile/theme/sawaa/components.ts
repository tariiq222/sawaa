import { ViewStyle, TextStyle } from 'react-native';
import { sawaaTokens } from './tokens';

/**
 * Unified Sawaa component styles — replaces scattered Themed* + hardcoded colors.
 * All colors reference sawaaTokens (supports tenant branding override).
 */

// ============ SawaaButton ============
export const SawaaButton = {
  primary: {
    backgroundColor: sawaaTokens.primary.light,
    paddingVertical: sawaaTokens.spacing.md,
    paddingHorizontal: sawaaTokens.spacing.lg,
    borderRadius: sawaaTokens.radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  } as ViewStyle,

  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: sawaaTokens.primary.light,
    paddingVertical: sawaaTokens.spacing.md,
    paddingHorizontal: sawaaTokens.spacing.lg,
    borderRadius: sawaaTokens.radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  } as ViewStyle,

  disabled: {
    opacity: 0.5,
  } as ViewStyle,

  text: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
  } as TextStyle,
};

// ============ SawaaCard ============
export const SawaaCard = {
  container: {
    backgroundColor: sawaaTokens.colors.glass.bg,
    borderRadius: sawaaTokens.radius.lg,
    padding: sawaaTokens.spacing.lg,
    borderWidth: 1,
    borderColor: sawaaTokens.colors.glass.border,
  } as ViewStyle,

  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  } as ViewStyle,
};

// ============ SawaaText ============
export const SawaaText = {
  heading: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: sawaaTokens.colors.ink[900],
  } as TextStyle,

  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: sawaaTokens.colors.ink[500],
  } as TextStyle,

  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: sawaaTokens.colors.ink[400],
  } as TextStyle,

  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: sawaaTokens.colors.ink[700],
  } as TextStyle,
};

// ============ Unified Export ============
export const SawaaComponents = {
  Button: SawaaButton,
  Card: SawaaCard,
  Text: SawaaText,
};
