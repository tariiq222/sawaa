import React, { useState } from "react";
import {
  View,
  Pressable,
  Platform,
  StyleSheet,
  ViewStyle,
  StyleProp,
  GestureResponderEvent,
} from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { useReducedTransparency, useIncreasedContrast, useReduceMotion } from "../../hooks/useA11y";
import { useTheme } from "../useTheme";
import { GLASS_CFG, getSawaaColors, getGlassEffects, type GlassCfg as Cfg, type GlassVariant as Variant } from "../sawaa/tokens";

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

type GlassProps = {
  variant?: Variant;
  tint?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  interactive?: boolean;
  onPress?: (e: GestureResponderEvent) => void;
  pressed?: boolean;
  accessibilityLabel?: string;
};

export const Glass = ({
  variant = "regular",
  tint,
  radius = 24,
  style,
  children,
  interactive,
  onPress,
  pressed: pressedOverride,
  accessibilityLabel,
}: GlassProps) => {
  const reduceTransparency = useReducedTransparency();
  const increaseContrast = useIncreasedContrast();
  const reduceMotion = useReduceMotion();
  const { theme, scheme } = useTheme();
  const isDarkAppearance = scheme === 'dark';
  const sawaaColors = getSawaaColors(scheme);
  const effects = getGlassEffects(isDarkAppearance);
  const cfg = applyA11y(GLASS_CFG[variant], reduceTransparency, increaseContrast);
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

  const pressTransform: ViewStyle | undefined =
    (interactive || onPress) && pressed && !reduceMotion
      ? { transform: [{ scale: 0.96 }] }
      : undefined;

  const wrapperTransition: any =
    Platform.OS === "web" && (interactive || onPress) && !reduceMotion
      ? {
          transition:
            "transform 220ms cubic-bezier(0.2,0.9,0.25,1), box-shadow 220ms",
          cursor: "pointer",
        }
      : null;

  const body = (
    <>
      {Platform.OS === "web" ? null : useNativeGlass ? (
        <>
          <GlassView
            style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
            glassEffectStyle={variant === 'clear' ? 'clear' : 'regular'}
            colorScheme={scheme}
            isInteractive={Boolean(interactive || onPress)}
          />
          {increaseContrast ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                { borderRadius: radius, borderWidth: 2, borderColor: theme.colors.textPrimary },
              ]}
            />
          ) : null}
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
                  backgroundColor: isDarkAppearance
                    ? sawaaColors.glass.darkBg
                    : effects.tint(cfg.mainTintAlpha + 0.15),
                },
              ]}
            />
          ) : null}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: radius,
                borderWidth: increaseContrast ? 2 : 1,
                borderColor: increaseContrast
                  ? theme.colors.textPrimary
                  : isDarkAppearance
                    ? sawaaColors.glass.darkBorder
                    : effects.border(cfg.borderAlpha + 0.15),
              },
            ]}
          />
          {tint && !reduceTransparency ? (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFillObject, { backgroundColor: tint }]}
            />
          ) : null}
        </>
      )}

      {Platform.OS === "web" && !reduceTransparency ? (
        <WebLayers cfg={cfg} radius={radius} tint={tint} pressed={pressed} isDark={isDarkAppearance} reduceMotion={reduceMotion} />
      ) : null}

      <View style={[
        { flex: 1, position: "relative", zIndex: 1 },
        contentCenter,
      ]}>{children}</View>
    </>
  );

  const wrapperStyle = [
    { borderRadius: radius, position: "relative" as const },
    Platform.OS !== "web" && { overflow: "hidden" as const },
    style,
    reduceTransparency && { backgroundColor: theme.colors.surface },
    pressTransform,
    wrapperTransition,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressedInternal(true)}
        onPressOut={() => setPressedInternal(false)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={wrapperStyle}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={wrapperStyle}>{body}</View>;
};

function WebLayers({
  cfg,
  radius,
  tint,
  pressed,
  isDark,
  reduceMotion,
}: {
  cfg: Cfg;
  radius: number;
  tint?: string;
  pressed: boolean;
  isDark: boolean;
  reduceMotion: boolean;
}) {
  const abs = (extra: any): any => ({
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    pointerEvents: "none",
    ...extra,
  });

  const baseAlpha = pressed ? cfg.baseTintAlpha + 0.05 : cfg.baseTintAlpha;
  const effects = getGlassEffects(isDark);
  const animatedPress = pressed && !reduceMotion;

  return (
    <View
      style={abs({
        borderRadius: radius,
        overflow: "hidden",
        isolation: "isolate",
      })}
    >
      <View style={abs({ backgroundColor: effects.tint(baseAlpha) })} />
      <View
        style={abs({
          backgroundColor: effects.tint(cfg.mainTintAlpha),
          backdropFilter: `blur(${cfg.mainBlur}px) saturate(180%)`,
          WebkitBackdropFilter: `blur(${cfg.mainBlur}px) saturate(180%)`,
        })}
      />
      {cfg.bloomAlpha > 0 ? (
        <View
          style={abs({
            left: 5,
            right: 5,
            top: 6,
            bottom: 6,
            backgroundColor: effects.tint(cfg.bloomAlpha),
            filter: "blur(3px)",
            borderRadius: radius,
          })}
        />
      ) : null}
      <View
        style={abs({
          background:
            effects.pressGlow,
          opacity: animatedPress ? 1 : 0,
          transform: `scale(${animatedPress ? 1 : 0.6})`,
          transition: reduceMotion ? 'none' : "opacity 240ms ease-out, transform 340ms cubic-bezier(0.2,0.9,0.25,1)",
          mixBlendMode: "plus-lighter",
          borderRadius: radius,
        })}
      />
      <View
        style={abs({
          boxShadow: pressed
            ? effects.pressedShadow
            : effects.restingShadow,
          transition: "box-shadow 220ms ease-out",
          borderRadius: radius,
        })}
      />
      <View
        style={abs({
          top: 0,
          bottom: "60%",
          left: 0,
          right: 0,
          backgroundColor: effects.sheen,
          backgroundBlendMode: "overlay",
          filter: "blur(6px)",
          borderRadius: radius,
        })}
      />
      <View
        style={abs({
          boxShadow: effects.innerShadow,
          mixBlendMode: "multiply",
          filter: "blur(4px)",
        })}
      />
      <View
        style={abs({
          boxShadow:
            effects.edgeShadow,
          mixBlendMode: "plus-lighter",
          filter: "blur(1.5px)",
        })}
      />
      <View
        style={abs({
          border: `1px solid ${effects.border(cfg.borderAlpha)}`,
          mixBlendMode: "plus-lighter",
          borderRadius: radius,
        })}
      />
      {tint ? <View style={abs({ backgroundColor: tint })} /> : null}
    </View>
  );
}
