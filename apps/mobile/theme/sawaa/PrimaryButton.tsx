import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { sawaaColors } from './tokens';

interface Props {
  label: string;
  onPress?: () => void;
  fontFamily?: string;
  style?: ViewStyle;
  height?: number;
  disabled?: boolean;
  icon?: React.ReactNode;
}

/**
 * Primary pill button — teal gradient with glass sheen + top-edge highlight.
 * Matches the "ابدأ الآن / تسجيل جديد" CTA style from the welcome screen.
 * Use everywhere a primary action is surfaced so the app stays visually uniform.
 */
export function PrimaryButton({ label, onPress, fontFamily, style, height = 52, disabled, icon }: Props) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[{ opacity: disabled ? 0.55 : 1 }, style]}
    >
      <LinearGradient
        colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { height, borderRadius: 999 }]}
      >
        {/* Specular sheen on top half */}
        <LinearGradient
          colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.sheen}
          pointerEvents="none"
        />
        <View style={styles.topEdge} pointerEvents="none" />
        <Text style={[styles.label, fontFamily ? { fontFamily } : null]}>{label}</Text>
        {icon}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
    shadowColor: sawaaColors.teal[600],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: '55%' },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  label: { color: '#fff', fontSize: 15, letterSpacing: 0.2 },
});
