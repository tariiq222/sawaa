import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';
import { useTheme } from '../useTheme';
import { getFontName } from '../fonts';
import { sawaaType } from '../sawaa/tokens';

type TextVariant = 'display' | 'displaySm' | 'heading' | 'subheading' | 'body' | 'bodySm' | 'caption' | 'label';
interface ThemedTextProps extends TextProps {
  children: React.ReactNode;
  variant?: TextVariant;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'auto';
}

/** Canonical metrics with legacy variant aliases and native text semantics. */
export function ThemedText({ children, variant = 'body', color, align, style, ...textProps }: ThemedTextProps) {
  const { theme, isRTL, language } = useTheme();
  const role = variant === 'displaySm' ? 'heading' : variant === 'label' ? 'micro' : variant;
  const metric = sawaaType[role];
  const weight = StyleSheet.flatten(style)?.fontWeight ?? metric.weight;
  return (
    <Text {...textProps} style={[
      { fontSize: metric.fontSize, lineHeight: metric.lineHeight,
        fontFamily: getFontName(language, String(weight)),
        textAlign: align ?? (isRTL ? 'right' : 'left'), writingDirection: isRTL ? 'rtl' : 'ltr',
        color: variant === 'bodySm' || variant === 'label' ? theme.colors.textSecondary : theme.colors.textPrimary },
      color ? { color } : undefined,
      style,
    ]}>{children}</Text>
  );
}
