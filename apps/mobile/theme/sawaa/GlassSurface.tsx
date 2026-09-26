import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { useReducedTransparency, useIncreasedContrast, useReduceMotion } from '../../hooks/useA11y';
import { useTheme } from '../useTheme';
import { sawaaBlur, getSawaaColors, getSawaaRoles, sawaaRadius } from './tokens';

type SurfaceVariant = 'base' | 'strong' | 'soft' | 'dark';
export type GlassSurfaceVariant = SurfaceVariant | 'regular' | 'clear';

export type GlassSurfaceProps = Omit<PressableProps, 'style' | 'children' | 'onPress'> & {
  variant?: GlassSurfaceVariant;
  tint?: string;
  radius?: number;
  padding?: number | ViewStyle['padding'];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  interactive?: boolean;
  pressed?: boolean;
  onPress?: PressableProps['onPress'];
};

function toSurfaceVariant(variant: GlassSurfaceVariant): SurfaceVariant {
  if (variant === 'regular') return 'base';
  if (variant === 'clear') return 'soft';
  return variant;
}

/**
 * Shared Sawaa surface, using the original GlassSurface treatment: native
 * Liquid Glass on supported iOS, otherwise a translucent fill and diagonal
 * highlight. The legacy Glass entry point delegates here too.
 */
export function GlassSurface({
  variant = 'base',
  tint,
  radius = sawaaRadius.xl,
  padding,
  style,
  children,
  interactive = false,
  onPress,
  onPressIn,
  onPressOut,
  onLongPress,
  delayLongPress,
  disabled,
  pressed: pressedOverride,
  ...viewProps
}: GlassSurfaceProps) {
  const surfaceVariant = toSurfaceVariant(variant);
  const isDark = surfaceVariant === 'dark';
  const reduceTransparency = useReducedTransparency();
  const increasedContrast = useIncreasedContrast();
  const reduceMotion = useReduceMotion();
  const { theme, scheme } = useTheme();
  const glassScheme = isDark || scheme === 'dark' ? 'dark' : 'light';
  const colors = getSawaaColors(glassScheme);
  const fillMap = {
    base: colors.glass.bg,
    strong: colors.glass.bgStrong,
    soft: colors.glass.bgSoft,
    dark: colors.glass.darkBg,
  };
  const borderMap = {
    base: colors.glass.border,
    strong: colors.glass.border,
    soft: colors.glass.borderSoft,
    dark: colors.glass.darkBorder,
  };
  const opaqueSurface = isDark
    ? colors.glass.opaqueDarkBg
    : theme.colors.surface ?? colors.glass.opaqueBg;
  const fallbackFill = fillMap[surfaceVariant];
  const usePressable = Boolean(interactive || onPress || onPressIn || onPressOut || onLongPress);
  const nativeGlass =
    Platform.OS === 'ios' &&
    !reduceTransparency &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable();
  const [pressedInternal, setPressedInternal] = useState(false);
  const pressed = pressedOverride ?? pressedInternal;
  const flat = StyleSheet.flatten(style) ?? {};
  const containerStyle: ViewStyle = {
    borderRadius: radius,
    position: 'relative',
    borderWidth: increasedContrast ? 2 : StyleSheet.hairlineWidth,
    borderColor: increasedContrast
      ? isDark ? colors.glass.opaqueDarkBorder : theme.colors.textPrimary
      : borderMap[surfaceVariant],
    overflow: 'hidden',
    backgroundColor: reduceTransparency
      ? opaqueSurface
      : Platform.OS === 'android' ? fallbackFill : 'transparent',
  };
  const pressTransform: ViewStyle | undefined = usePressable && pressed && !reduceMotion
    ? { transform: [{ scale: 0.96 }] }
    : undefined;
  const wrapperTransition = Platform.OS === 'web' && usePressable && !reduceMotion
    ? { transition: 'transform 220ms cubic-bezier(0.2,0.9,0.25,1)', cursor: 'pointer' } as ViewStyle
    : null;
  const wrapperStyle = [
    containerStyle,
    style,
    reduceTransparency ? { backgroundColor: opaqueSurface } : null,
    pressTransform,
    wrapperTransition,
  ];
  const body = (
    <>
      {nativeGlass ? (
        <GlassView
          style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
          glassEffectStyle={surfaceVariant === 'soft' ? 'clear' : 'regular'}
          colorScheme={glassScheme}
          tintColor={tint ?? (isDark ? colors.glass.darkBg : undefined)}
          isInteractive={usePressable}
        />
      ) : !reduceTransparency ? (
        <>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={sawaaBlur[surfaceVariant]}
              tint={glassScheme}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: fallbackFill }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={getSawaaRoles(glassScheme).highlight}
            locations={[0, 0.22, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {tint ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} pointerEvents="none" />
          ) : null}
        </>
      ) : null}
      <View style={[
        { position: 'relative', zIndex: 1 },
        flat.alignItems != null && { alignItems: flat.alignItems },
        flat.justifyContent != null && { justifyContent: flat.justifyContent },
        padding !== undefined && { padding },
      ]}>{children}</View>
    </>
  );
  const handlePressIn: NonNullable<GlassSurfaceProps['onPressIn']> = (event) => {
    setPressedInternal(true);
    onPressIn?.(event);
  };
  const handlePressOut: NonNullable<GlassSurfaceProps['onPressOut']> = (event) => {
    setPressedInternal(false);
    onPressOut?.(event);
  };

  if (usePressable) {
    return (
      <Pressable
        {...viewProps}
        disabled={disabled}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole={viewProps.accessibilityRole ?? 'button'}
        style={wrapperStyle}
      >
        {body}
      </Pressable>
    );
  }
  return <View {...viewProps} style={wrapperStyle}>{body}</View>;
}
