import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useTheme } from '@/theme/useTheme';
import { getSawaaColors, getSawaaRoles, sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa/tokens';

export interface AppButtonProps {
  label: React.ReactNode;
  onPress?: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  textStyle?: StyleProp<TextStyle>;
  fontFamily?: string;
  minHeight?: number;
  height?: number;
  tone?: 'brand' | 'neutral';
}

/** Shared action renderer with the latest synchronous and asynchronous press lock. */
export function AppButton({ label, onPress, variant = 'primary', size = 'md', disabled, loading,
  icon, accessibilityLabel, testID, style, labelStyle, textStyle, fontFamily, minHeight, height,
  tone = 'brand' }: AppButtonProps) {
  const { scheme } = useTheme();
  const dir = useDir();
  const roles = getSawaaRoles(scheme);
  const palette = getSawaaColors(scheme);
  const pending = useRef(false);
  const [running, setRunning] = useState(false);
  const busy = Boolean(loading || running);
  const inactive = Boolean(disabled || busy || !onPress);
  const filled = variant === 'primary' || variant === 'danger';
  const foreground = variant === 'primary' ? roles.action.foreground
    : variant === 'danger' ? roles.danger.foreground
      : tone === 'neutral' ? palette.ink[900] : palette.teal[scheme === 'light' ? 900 : 700];
  const border = tone === 'neutral' ? palette.ink[500] : palette.teal[700];
  const handlePress = () => {
    if (inactive || pending.current || !onPress) return;
    pending.current = true;
    try {
      const result = onPress();
      if (!result) {
        void Promise.resolve().then(() => { pending.current = false; });
        return;
      }
      setRunning(true);
      return result.finally(() => { pending.current = false; setRunning(false); });
    } catch (error) { pending.current = false; throw error; }
  };
  const content = <>
    {busy ? <ActivityIndicator color={foreground} size="small" /> : icon}
    <Text style={[styles.label, { color: foreground,
      fontFamily: fontFamily ?? getFontName(dir.locale, sawaaType.action.weight),
      writingDirection: dir.writingDirection }, labelStyle, textStyle]}>{label}</Text>
  </>;
  const minimum = Math.max(44, minHeight ?? height ?? { sm: 44, md: 56, lg: 64 }[size]);
  const contentStyle: ViewStyle = {
    minHeight: minimum,
    paddingVertical: size === 'sm' ? sawaaSpacing.sm : sawaaSpacing.md,
    paddingHorizontal: size === 'lg' ? sawaaSpacing['2xl'] : sawaaSpacing.lg,
    flexDirection: dir.row, alignItems: 'center', justifyContent: 'center', gap: sawaaSpacing.sm,
    borderRadius: sawaaRadius.pill, overflow: 'hidden',
  };
  return <Pressable disabled={inactive} onPress={handlePress} testID={testID}
    accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? (typeof label === 'string' ? label : undefined)}
    accessibilityState={{ disabled: inactive, busy }}
    style={({ pressed }) => [styles.button, { minHeight: minimum }, !filled ? contentStyle : undefined,
      variant === 'secondary' ? { borderColor: border, borderWidth: 1.5 } : undefined,
      variant === 'soft' ? { backgroundColor: withAlpha(palette.teal[600], 0.12) } : undefined,
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
