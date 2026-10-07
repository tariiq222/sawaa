import React from 'react';
import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '../useTheme';
import { getFontName } from '../fonts';
import { sawaaType } from '../sawaa/tokens';

type TextVariant = 'display' | 'displaySm' | 'heading' | 'subheading' | 'body' | 'bodySm' | 'caption' | 'label';
interface ThemedTextProps {
  children: React.ReactNode;
  variant?: TextVariant;
  color?: string;
  align?: 'left' | 'center' | 'right' | 'auto';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/** Canonical Sawaa scale; explicit color overrides variants, style overrides both. */
export function ThemedText({ children, variant = 'body', color, align, style, numberOfLines }: ThemedTextProps) {
  const { theme, isRTL, language } = useTheme();
  const token = sawaaType[variant === 'label' ? 'micro' : variant];
  const weight = StyleSheet.flatten(style)?.fontWeight ?? token.weight;
  const secondary = variant === 'bodySm' || variant === 'label';
  return (
    <Text numberOfLines={numberOfLines} style={[
      { fontFamily: getFontName(language, String(weight)), fontWeight: token.weight, fontSize: token.fontSize, lineHeight: token.lineHeight,
        textAlign: align ?? (isRTL ? 'right' : 'left'), writingDirection: isRTL ? 'rtl' : 'ltr',
        color: secondary ? theme.colors.textSecondary : theme.colors.textPrimary },
      variant === 'label' ? { textTransform: 'uppercase', letterSpacing: 0.6 } : null,
      color ? { color } : null,
      style,
    ]}>{children}</Text>
  );
}
