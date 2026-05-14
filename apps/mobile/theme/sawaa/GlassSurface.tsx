import React from 'react';
import { Platform, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { sawaaBlur, sawaaColors, sawaaRadius } from './tokens';

type Variant = 'base' | 'strong' | 'soft' | 'dark';

interface Props extends ViewProps {
  variant?: Variant;
  radius?: number;
  padding?: number | ViewStyle['padding'];
  children?: React.ReactNode;
}

const intensityMap: Record<Variant, number> = {
  base: sawaaBlur.base,
  strong: sawaaBlur.strong,
  soft: sawaaBlur.soft,
  dark: sawaaBlur.dark,
};

const tintMap: Record<Variant, 'light' | 'dark' | 'default'> = {
  base: 'light',
  strong: 'light',
  soft: 'light',
  dark: 'dark',
};

const fillMap: Record<Variant, string> = {
  base: sawaaColors.glass.bg,
  strong: sawaaColors.glass.bgStrong,
  soft: sawaaColors.glass.bgSoft,
  dark: sawaaColors.glass.darkBg,
};

const borderMap: Record<Variant, string> = {
  base: sawaaColors.glass.border,
  strong: sawaaColors.glass.border,
  soft: sawaaColors.glass.borderSoft,
  dark: sawaaColors.glass.darkBorder,
};

/**
 * Liquid glass surface — mirrors `.lg` / `.lg-strong` / `.lg-soft` / `.lg-dark`
 * from sawaa-design/v2/styles.css. Uses expo-blur for backdrop blur and a
 * diagonal gradient overlay to approximate the specular highlight.
 */
export function GlassSurface({
  variant = 'base',
  radius = sawaaRadius.xl,
  padding,
  style,
  children,
  ...rest
}: Props) {
  const isDark = variant === 'dark';
  const containerStyle: ViewStyle = {
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: borderMap[variant],
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'android' ? fillMap[variant] : 'transparent',
  };

  const highlightColors = isDark
    ? (['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.10)'] as const)
    : (['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.25)'] as const);

  return (
    <View style={[containerStyle, style]} {...rest}>
      {Platform.OS === 'ios' && (
        <BlurView
          intensity={intensityMap[variant]}
          tint={tintMap[variant]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fillMap[variant] }]} pointerEvents="none" />
      <LinearGradient
        colors={highlightColors}
        locations={[0, 0.22, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={{ padding }}>{children}</View>
    </View>
  );
}
