import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
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

/** Native text semantics and canonical scale; caller style has final precedence. */
export function ThemedText({ children, variant = 'body', color, align, style, ...textProps }: ThemedTextProps) {
  const { theme, isRTL, language } = useTheme();
  const token = sawaaType[variant === 'label' ? 'micro' : variant];
  const weight = StyleSheet.flatten(style)?.fontWeight ?? token.weight;
  const secondary = variant === 'bodySm' || variant === 'label';
  return (
    <Text {...textProps} style={[
      { fontFamily: getFontName(language, String(weight)), fontWeight: token.weight,
        fontSize: token.fontSize, lineHeight: token.lineHeight,
        textAlign: align ?? (isRTL ? 'right' : 'left'), writingDirection: isRTL ? 'rtl' : 'ltr',
        color: secondary ? theme.colors.textSecondary : theme.colors.textPrimary },
      variant === 'label' ? { textTransform: 'uppercase', letterSpacing: 0.6 } : undefined,
      color ? { color } : undefined,
      style,
    ]}>{children}</Text>
  );
}
