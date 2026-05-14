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
import { useReducedTransparency, useIncreasedContrast } from "../../hooks/useA11y";
import { GLASS_CFG, type GlassCfg as Cfg, type GlassVariant as Variant } from "../sawaa/tokens";

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
  const cfg = applyA11y(GLASS_CFG[variant], reduceTransparency, increaseContrast);

  const [pressedInternal, setPressedInternal] = useState(false);
  const pressed = pressedOverride ?? pressedInternal;

  const flat = StyleSheet.flatten(style) ?? {};
  const contentCenter = {
    ...(flat.alignItems != null ? { alignItems: flat.alignItems } : {}),
    ...(flat.justifyContent != null ? { justifyContent: flat.justifyContent } : {}),
  };

  const pressTransform: ViewStyle | undefined =
    (interactive || onPress) && pressed
      ? { transform: [{ scale: 0.96 }] }
      : undefined;

  const wrapperTransition: any =
    Platform.OS === "web" && (interactive || onPress)
      ? {
          transition:
            "transform 220ms cubic-bezier(0.2,0.9,0.25,1), box-shadow 220ms",
          cursor: "pointer",
        }
      : null;

  const body = (
    <>
      {Platform.OS === "web" ? null : (
        <>
          <BlurView
            intensity={cfg.nativeBlur}
            tint="light"
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: `rgba(255,255,255,${cfg.mainTintAlpha + 0.15})` },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: radius,
                borderWidth: 1,
                borderColor: `rgba(255,255,255,${cfg.borderAlpha + 0.15})`,
              },
            ]}
          />
          {tint ? (
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFillObject, { backgroundColor: tint }]}
            />
          ) : null}
        </>
      )}

      {Platform.OS === "web" ? <WebLayers cfg={cfg} radius={radius} tint={tint} pressed={pressed} /> : null}

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
}: {
  cfg: Cfg;
  radius: number;
  tint?: string;
  pressed: boolean;
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

  return (
    <View
      style={abs({
        borderRadius: radius,
        overflow: "hidden",
        isolation: "isolate",
      })}
    >
      <View style={abs({ backgroundColor: `rgba(255,255,255,${baseAlpha})` })} />
      <View
        style={abs({
          backgroundColor: `rgba(255,255,255,${cfg.mainTintAlpha})`,
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
            backgroundColor: `rgba(255,255,255,${cfg.bloomAlpha})`,
            filter: "blur(3px)",
            borderRadius: radius,
          })}
        />
      ) : null}
      <View
        style={abs({
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.25) 40%, rgba(255,255,255,0) 72%)",
          opacity: pressed ? 1 : 0,
          transform: `scale(${pressed ? 1 : 0.6})`,
          transition: "opacity 240ms ease-out, transform 340ms cubic-bezier(0.2,0.9,0.25,1)",
          mixBlendMode: "plus-lighter",
          borderRadius: radius,
        })}
      />
      <View
        style={abs({
          boxShadow: pressed
            ? "inset 0 2px 10px rgba(21,79,87,0.18), inset 0 0 0 1px rgba(21,79,87,0.08)"
            : "inset 0 0 0 rgba(0,0,0,0)",
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
          backgroundColor: "rgba(255,255,255,0.15)",
          backgroundBlendMode: "overlay",
          filter: "blur(6px)",
          borderRadius: radius,
        })}
      />
      <View
        style={abs({
          boxShadow: "inset 0 0 0 1px rgba(21,79,87,0.08)",
          mixBlendMode: "multiply",
          filter: "blur(4px)",
        })}
      />
      <View
        style={abs({
          boxShadow:
            "inset 0 2px 6px rgba(255,255,255,0.55), inset 0 -1px 2px rgba(255,255,255,0.2)",
          mixBlendMode: "plus-lighter",
          filter: "blur(1.5px)",
        })}
      />
      <View
        style={abs({
          border: `1px solid rgba(255,255,255,${cfg.borderAlpha})`,
          mixBlendMode: "plus-lighter",
          borderRadius: radius,
        })}
      />
      {tint ? <View style={abs({ backgroundColor: tint })} /> : null}
    </View>
  );
}
