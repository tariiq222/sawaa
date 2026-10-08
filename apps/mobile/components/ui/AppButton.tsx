import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { getSawaaColors, getSawaaRoles, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';

export interface AppButtonProps {
  label: React.ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  minHeight?: number;
  tone?: 'brand' | 'neutral';
}

/** Shared action renderer. Minimum targets grow with wrapped or enlarged labels. */
export function AppButton({ label, onPress, variant = 'primary', size = 'md', disabled, loading,
  icon, accessibilityLabel, style, minHeight, tone = 'brand' }: AppButtonProps) {
  const { scheme } = useTheme();
  const dir = useDir();
  const roles = getSawaaRoles(scheme);
  const palette = getSawaaColors(scheme);
  const inactive = Boolean(disabled || loading || !onPress);
  const filled = variant === 'primary' || variant === 'danger';
  const foreground = variant === 'primary' ? roles.action.foreground
    : variant === 'danger' ? roles.danger.foreground
      : tone === 'neutral' ? palette.ink[900] : palette.teal[scheme === 'light' ? 900 : 700];
  const border = tone === 'neutral' ? palette.ink[500] : palette.teal[700];
  const content = <>
    {loading ? <ActivityIndicator color={foreground} size="small" /> : icon}
    <Text style={[styles.label, { color: foreground, fontFamily: getFontName(dir.locale, sawaaType.action.weight),
      writingDirection: dir.writingDirection }]}>{label}</Text>
  </>;
  const contentStyle: ViewStyle = {
    minHeight: Math.max(44, minHeight ?? { sm: 44, md: 56, lg: 64 }[size]),
    paddingVertical: size === 'sm' ? sawaaSpacing.sm : sawaaSpacing.md,
    paddingHorizontal: size === 'lg' ? sawaaSpacing['2xl'] : sawaaSpacing.lg,
    flexDirection: dir.row, alignItems: 'center', justifyContent: 'center', gap: sawaaSpacing.sm,
    borderRadius: sawaaRadius.pill, overflow: 'hidden',
  };
  return <Pressable disabled={inactive} onPress={inactive ? undefined : onPress}
    accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? (typeof label === 'string' ? label : undefined)}
    accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
    style={({ pressed }) => [styles.button, !filled ? contentStyle : undefined,
      variant === 'secondary' ? { borderColor: border, borderWidth: 1.5 } : undefined,
      filled ? { borderWidth: 2, borderColor: pressed && !inactive ? foreground : 'transparent' } : undefined,
      !filled && pressed && !inactive ? { backgroundColor: roles.surfaceHigh } : undefined,
      { opacity: inactive ? 0.55 : 1 }, style]}>
    {variant === 'primary' ? <LinearGradient colors={roles.action.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={contentStyle}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: roles.action.sheen }]} />
      {content}
    </LinearGradient> : variant === 'danger' ? <View style={[contentStyle, { backgroundColor: roles.danger.fill }]}>{content}</View> : content}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { borderRadius: sawaaRadius.pill },
  label: { fontSize: sawaaType.action.fontSize, lineHeight: sawaaType.action.lineHeight,
    flexShrink: 1, minWidth: 0, textAlign: 'center' },
});
