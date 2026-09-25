import React from 'react';
import { Platform, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useReducedTransparency, useIncreasedContrast } from '../../hooks/useA11y';
import { useTheme } from '../useTheme';
import { sawaaBlur, getSawaaColors, getSawaaRoles, sawaaRadius } from './tokens';

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

const makeFillMap = (sawaaColors: ReturnType<typeof getSawaaColors>): Record<Variant, string> => ({
  base: sawaaColors.glass.bg,
  strong: sawaaColors.glass.bgStrong,
  soft: sawaaColors.glass.bgSoft,
  dark: sawaaColors.glass.darkBg,
});

const makeBorderMap = (sawaaColors: ReturnType<typeof getSawaaColors>): Record<Variant, string> => ({
  base: sawaaColors.glass.border,
  strong: sawaaColors.glass.border,
  soft: sawaaColors.glass.borderSoft,
  dark: sawaaColors.glass.darkBorder,
});

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
  const reduceTransparency = useReducedTransparency();
  const increasedContrast = useIncreasedContrast();
  const { theme, scheme } = useTheme();
  const glassScheme = isDark || scheme === 'dark' ? 'dark' : 'light';
  const isDarkAppearance = glassScheme === 'dark';
  const sawaaColors = getSawaaColors(glassScheme);
  const fillMap = makeFillMap(sawaaColors);
  const borderMap = makeBorderMap(sawaaColors);
  const opaqueSurface = isDark
    ? sawaaColors.glass.opaqueDarkBg
    : theme.colors.surface ?? sawaaColors.glass.opaqueBg;
  const fallbackFill = fillMap[variant];
  const fallbackBorder = borderMap[variant];
  const nativeGlass =
    Platform.OS === 'ios' &&
    !reduceTransparency &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable();
  const containerStyle: ViewStyle = {
    borderRadius: radius,
    borderWidth: increasedContrast ? 2 : StyleSheet.hairlineWidth,
    borderColor: increasedContrast
      ? isDark
        ? sawaaColors.glass.opaqueDarkBorder
        : theme.colors.textPrimary
      : fallbackBorder,
    overflow: 'hidden',
    backgroundColor: reduceTransparency
      ? opaqueSurface
      : Platform.OS === 'android'
        ? fallbackFill
        : 'transparent',
  };

  const highlightColors = getSawaaRoles(glassScheme).highlight;

  return (
    <View
      style={[
        containerStyle,
        style,
        reduceTransparency && { backgroundColor: opaqueSurface },
      ]}
      {...rest}
    >
      {Platform.OS === 'ios' && nativeGlass ? (
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle={variant === 'soft' ? 'clear' : 'regular'}
          colorScheme={glassScheme}
          tintColor={isDark ? sawaaColors.glass.darkBg : undefined}
        />
      ) : (
        <>
          {Platform.OS === 'ios' && !reduceTransparency && (
            <BlurView
              intensity={intensityMap[variant]}
              tint={isDarkAppearance ? 'dark' : tintMap[variant]}
              style={StyleSheet.absoluteFill}
            />
          )}
          {!reduceTransparency ? (
            <>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: fallbackFill }]} pointerEvents="none" />
              <LinearGradient
                colors={highlightColors}
                locations={[0, 0.22, 0.55, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            </>
          ) : null}
        </>
      )}
      <View style={{ padding }}>{children}</View>
    </View>
  );
}
