import React, { useState } from "react";
import {
  View,
  Pressable,
  Platform,
  StyleSheet,
  PressableProps,
  ViewStyle,
  StyleProp,
} from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { GlassWebLayers } from './GlassWebLayers';
import { useReducedTransparency, useIncreasedContrast, useReduceMotion } from "../../hooks/useA11y";
import { useTheme } from "../useTheme";
import {
  GLASS_CFG,
  getSawaaColors,
  getSawaaRoles,
  getSawaaGlassAppearance,
  type GlassCfg as Cfg,
  type GlassVariant as LegacyVariant,
} from "../sawaa/tokens";

function applyA11y(cfg: Cfg, reduceT: boolean, increaseC: boolean): Cfg {
  let out = { ...cfg };
  if (reduceT) {
    out.baseTintAlpha = 0.85;
    out.mainTintAlpha = 0.45;
    out.bloomAlpha = 0;
    out.mainBlur = 0;
    out.nativeBlur = 0;
  }
  if (increaseC) {
    out.borderAlpha = Math.min(0.95, out.borderAlpha * 1.8);
  }
  return out;
}

export type GlassVariant = LegacyVariant | 'base' | 'soft' | 'dark';

export type GlassProps = Omit<PressableProps, 'style' | 'children' | 'onPress'> & {
  variant?: GlassVariant;
  tint?: string;
  radius?: number;
  padding?: number | ViewStyle['padding'];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  interactive?: boolean;
  pressed?: boolean;
  onPress?: PressableProps['onPress'];
};

function toLegacyVariant(variant: GlassVariant): LegacyVariant {
  if (variant === 'clear' || variant === 'soft') return 'clear';
  if (variant === 'strong') return 'strong';
  return 'regular';
}

export const Glass = ({
  variant = "regular",
  tint,
  radius = 24,
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
}: GlassProps) => {
  const reduceTransparency = useReducedTransparency();
  const increaseContrast = useIncreasedContrast();
  const reduceMotion = useReduceMotion();
  const { theme, scheme } = useTheme();
  const forceDark = variant === 'dark';
  const glassScheme = forceDark ? 'dark' : scheme;
  const isDarkAppearance = glassScheme === 'dark';
  const sawaaColors = getSawaaColors(glassScheme);
  const roles = getSawaaRoles(glassScheme);
  const appearance = getSawaaGlassAppearance(glassScheme);
  const cfgVariant = toLegacyVariant(variant);
  const cfg = applyA11y(GLASS_CFG[cfgVariant], reduceTransparency, increaseContrast);
  const usePressable = Boolean(interactive || onPress || onPressIn || onPressOut || onLongPress);
  const useNativeGlass =
    Platform.OS === 'ios' &&
    !reduceTransparency &&
    isGlassEffectAPIAvailable() &&
    isLiquidGlassAvailable();

  const [pressedInternal, setPressedInternal] = useState(false);
  const pressed = pressedOverride ?? pressedInternal;

  const flat = StyleSheet.flatten(style) ?? {};
  const contentCenter = {
    ...(flat.alignItems != null ? { alignItems: flat.alignItems } : {}),
    ...(flat.justifyContent != null ? { justifyContent: flat.justifyContent } : {}),
  };
  // A square surface rounded to (at least) its own half-width is a circle, and
  // the straight lower rim below would cut across its arc — the button then
  // reads as a square with a flattened bottom.
  const isCircular =
    typeof flat.width === 'number' &&
    typeof flat.height === 'number' &&
    Math.abs(flat.width - flat.height) <= 1 &&
    radius >= flat.width / 2;

  const pressTransform: ViewStyle | undefined =
    usePressable && pressed && !reduceMotion
      ? { transform: [{ scale: 0.96 }] }
      : undefined;

  const wrapperTransition =
    Platform.OS === "web" && usePressable && !reduceMotion
      ? {
          transition:
            "transform 220ms cubic-bezier(0.2,0.9,0.25,1), box-shadow 220ms",
          cursor: "pointer",
        } as ViewStyle
      : null;

  const fallbackFill = appearance.fallbackFill;
  const opaqueSurface = forceDark ? sawaaColors.glass.opaqueDarkBg : theme.colors.surface ?? sawaaColors.glass.opaqueBg;
  const glassEffectStyle = variant === 'clear' || variant === 'soft' ? 'clear' : 'regular';
  const containerStyle: ViewStyle = {
    borderRadius: radius,
    position: 'relative',
    overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
    borderWidth: increaseContrast ? 2 : 1,
    borderColor: increaseContrast
      ? forceDark ? sawaaColors.glass.opaqueDarkBorder : theme.colors.textPrimary
      : appearance.rim,
    backgroundColor: reduceTransparency
      ? opaqueSurface
      : Platform.OS === 'android'
        ? fallbackFill
        : 'transparent',
  };

  const body = (
    <>
      {Platform.OS === "web" ? null : useNativeGlass ? (
        <>
          <GlassView
            style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
            glassEffectStyle={glassEffectStyle}
            colorScheme={glassScheme}
            tintColor={tint ?? appearance.nativeTint}
            isInteractive={usePressable}
          />
          <LinearGradient
            colors={appearance.sheen}
            locations={[0, 0.4, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
        </>
      ) : (
        <>
          {!reduceTransparency ? (
            <BlurView
              intensity={cfg.nativeBlur}
              tint={isDarkAppearance ? 'dark' : 'light'}
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: appearance.fallbackBlur,
                },
              ]}
            />
          ) : null}
          {!reduceTransparency ? (
            <>
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFillObject, { backgroundColor: fallbackFill }]}
              />
              <LinearGradient
                colors={roles.highlight}
                locations={[0, 0.22, 0.55, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
            </>
          ) : null}
          {tint && !reduceTransparency ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: tint }]} />
          ) : null}
        </>
      )}

      {Platform.OS === "web" && !reduceTransparency ? (
        <GlassWebLayers cfg={cfg} radius={radius} tint={tint} pressed={pressed} isDark={isDarkAppearance} reduceMotion={reduceMotion} />
      ) : null}

      {!reduceTransparency && Platform.OS === 'ios' && !isCircular ? (
        <View pointerEvents="none" style={{ position: 'absolute', start: 10, end: 10, bottom: 0, height: 2, borderRadius: radius, backgroundColor: appearance.lowerRim }} />
      ) : null}

      <View style={[
        { position: "relative", zIndex: 1 },
        contentCenter,
        padding !== undefined && { padding },
      ]}>{children}</View>
    </>
  );

  const wrapperStyle = [
    containerStyle,
    style,
    reduceTransparency ? { backgroundColor: opaqueSurface } : null,
    pressTransform,
    wrapperTransition,
  ];

  const handlePressIn: NonNullable<GlassProps['onPressIn']> = (event) => {
    setPressedInternal(true);
    onPressIn?.(event);
  };
  const handlePressOut: NonNullable<GlassProps['onPressOut']> = (event) => {
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
};
