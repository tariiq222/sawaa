import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { getFontName } from '../fonts';

type TextVariant =
  | 'display'
  | 'displaySm'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodySm'
  | 'caption'
  | 'label';

interface ThemedTextProps {
  children: React.ReactNode;
  variant?: TextVariant;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'auto';
  style?: TextStyle;
  numberOfLines?: number;
}

/**
 * DS Typography Scale:
 * Display    — 36px Bold
 * Display SM — 28px Bold
 * Heading    — 20px Semibold
 * Subheading — 16px Semibold
 * Body       — 14px Regular
 * Body SM    — 13px Regular / Secondary color
 * Caption    — 12px Regular
 * Label      — 11px Semibold / Uppercase / +5% tracking
 *
 * Rule: Never stack bold on bold.
 */
export function ThemedText({
  children,
  variant = 'body',
  color,
  align,
  style,
  numberOfLines,
}: ThemedTextProps) {
  const { theme, isRTL, language } = useTheme();

  const HEADING_VARIANTS: ReadonlySet<TextVariant> = new Set(['display', 'displaySm', 'heading', 'subheading']);

  const weight = style?.fontWeight ?? (HEADING_VARIANTS.has(variant)
    ? (variant === 'heading' || variant === 'subheading' ? '600' : '700')
    : variant === 'label' ? '600' : '400');
  const fontFamily = getFontName(language, String(weight));

  const variantStyles: Record<TextVariant, TextStyle> = {
    // IBM font aliases encode each heading weight.
    display: { fontSize: 36, lineHeight: 45 },
    displaySm: { fontSize: 28, lineHeight: 35 },
    heading: { fontSize: 20, lineHeight: 26 },
    subheading: { fontSize: 16, lineHeight: 22 },
    // Preserve the typography scale while using the bundled IBM family.
    body: { fontSize: 14, fontWeight: '400', lineHeight: 21 },
    bodySm: {
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    caption: { fontSize: 12, fontWeight: '400', lineHeight: 18 },
    label: {
      fontSize: 11,
      fontWeight: '600',
      lineHeight: 16,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: theme.colors.textSecondary,
    },
  };

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily,
          textAlign: align ?? (isRTL ? 'right' : 'left'),
          writingDirection: isRTL ? 'rtl' : 'ltr',
          color: color ?? theme.colors.textPrimary,
        },
        variantStyles[variant],
        style,
      ]}
    >
      {children}
    </Text>
  );
}
