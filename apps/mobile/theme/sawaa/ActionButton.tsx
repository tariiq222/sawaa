import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '../fonts';
import { useTheme } from '../useTheme';
import { getSawaaColors, getSawaaRoles, sawaaRadius, withAlpha } from './tokens';

export interface ActionButtonProps {
  label: string;
  onPress?: () => void | Promise<void>;
  fontFamily?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  /** Preferred minimum size; content can grow with the system text size. */
  height?: number;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
  testID?: string;
  tone?: 'brand' | 'neutral';
}

interface Props extends ActionButtonProps {
  variant?: 'primary' | 'outline' | 'soft' | 'destructive' | 'plain';
}

/** Shared press, loading, localization and target-size contract for actions. */
export function ActionButton({ label, onPress, fontFamily, style, labelStyle, height = 56, disabled = false, loading = false, icon, accessibilityLabel, testID, tone = 'brand', variant = 'primary' }: Props) {
  const { scheme } = useTheme();
  const dir = useDir();
  const colors = getSawaaColors(scheme);
  const roles = getSawaaRoles(scheme);
  const pending = useRef(false);
  const [running, setRunning] = useState(false);
  const busy = loading || running;
  const inactive = disabled || busy || !onPress;
  const filled = variant === 'primary' || variant === 'destructive';
  const foreground = variant === 'destructive' ? roles.destructive.foreground : filled ? roles.action.foreground : tone === 'neutral' ? colors.ink[900] : colors.teal[700];
  const border = tone === 'neutral' ? colors.ink[500] : colors.teal[700];
  const minimum = Math.max(44, height);
  const contentStyle = [styles.content, { minHeight: minimum, flexDirection: dir.row }];

  const handlePress = () => {
    if (inactive || pending.current || !onPress) return;
    pending.current = true;
    try {
      const result = onPress();
      if (!result) {
        // Suppress another event in the same turn without a transient spinner.
        void Promise.resolve().then(() => { pending.current = false; });
        return;
      }
      setRunning(true);
      return result.finally(() => { pending.current = false; setRunning(false); });
    } catch (error) { pending.current = false; throw error; }
  };

  const content = <>
    {busy ? <ActivityIndicator color={foreground} /> : null}
    <Text style={[styles.label, { color: foreground, fontFamily: fontFamily ?? getFontName(dir.locale, '600'), writingDirection: dir.writingDirection }, labelStyle]}>{label}</Text>
    {!busy ? icon : null}
  </>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy }}
      testID={testID}
      disabled={inactive}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        { minHeight: minimum, opacity: inactive ? 0.55 : pressed ? 0.7 : 1 },
        variant === 'outline' ? { borderWidth: 1.5, borderColor: border } : null,
        variant === 'soft' ? { backgroundColor: withAlpha(colors.teal[600], 0.12) } : null,
        variant === 'destructive' ? { backgroundColor: roles.destructive.fill } : null,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={roles.action.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[contentStyle, styles.gradient, { shadowColor: roles.action.fill }]}>
          <LinearGradient colors={[roles.action.sheen, 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.sheen} pointerEvents="none" />
          <View style={[styles.topEdge, { backgroundColor: roles.action.sheen }]} pointerEvents="none" />
          {content}
        </LinearGradient>
      ) : <View style={contentStyle}>{content}</View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: sawaaRadius.pill },
  content: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12 },
  gradient: { borderRadius: sawaaRadius.pill, overflow: 'hidden', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 18, elevation: 6 },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: '55%' },
  topEdge: { position: 'absolute', top: 0, left: 12, right: 12, height: 1 },
  label: { fontSize: 17, letterSpacing: 0.2, textAlign: 'center', flexShrink: 1 },
});
