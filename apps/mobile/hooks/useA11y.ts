import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * `prefers-reduced-motion` (web) / `isReduceMotionEnabled` (iOS/Android).
 * When true, animations should be disabled or significantly simplified.
 */
export function useReduceMotion() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !window.matchMedia) return;
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setOn(mq.matches);
      const handler = (e: MediaQueryListEvent) => setOn(e.matches);
      mq.addEventListener?.("change", handler);
      return () => mq.removeEventListener?.("change", handler);
    }

    // Native: iOS/Android
    const a11y = AccessibilityInfo as unknown as {
      isReduceMotionEnabled?: () => Promise<boolean>;
      addEventListener: (
        event: string,
        handler: (value: boolean) => void,
      ) => { remove?: () => void };
    };

    a11y.isReduceMotionEnabled?.()
      .then((v) => setOn(!!v))
      .catch(() => {});

    const sub = a11y.addEventListener("reduceMotionChanged", (v) => setOn(!!v));
    return () => sub?.remove?.();
  }, []);

  return on;
}

/**
 * `prefers-reduced-transparency` (web) / `isReduceTransparencyEnabled` (iOS).
 * When true, Liquid Glass surfaces should collapse toward opaque so content
 * behind them doesn't bleed through.
 */
export function useReducedTransparency() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !window.matchMedia) return;
      const mq = window.matchMedia("(prefers-reduced-transparency: reduce)");
      setOn(mq.matches);
      const handler = (e: MediaQueryListEvent) => setOn(e.matches);
      mq.addEventListener?.("change", handler);
      return () => mq.removeEventListener?.("change", handler);
    }
    // Native
    AccessibilityInfo.isReduceTransparencyEnabled?.().then((v) => setOn(!!v));
    const sub = AccessibilityInfo.addEventListener(
      "reduceTransparencyChanged",
      (v) => setOn(!!v)
    );
    return () => sub?.remove?.();
  }, []);

  return on;
}

/**
 * `prefers-contrast: more` (web) / `isHighTextContrastEnabled` (iOS).
 * When true, Liquid Glass surfaces should thicken their border + raise the
 * specular highlight so edges are unambiguous.
 */
export function useIncreasedContrast() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || !window.matchMedia) return;
      const mq = window.matchMedia("(prefers-contrast: more)");
      setOn(mq.matches);
      const handler = (e: MediaQueryListEvent) => setOn(e.matches);
      mq.addEventListener?.("change", handler);
      return () => mq.removeEventListener?.("change", handler);
    }
    // Native — iOS 13+. These APIs are typed loosely on RN, so we narrow them
    // to a structural shape rather than reach for `any`.
    const a11y = AccessibilityInfo as unknown as {
      isHighTextContrastEnabled?: () => Promise<boolean>;
      addEventListener: (
        event: string,
        handler: (value: boolean) => void,
      ) => { remove?: () => void };
    };
    a11y.isHighTextContrastEnabled?.()
      .then((v) => setOn(!!v))
      .catch(() => {});
    const sub = a11y.addEventListener("highTextContrastChanged", (v) => setOn(!!v));
    return () => sub?.remove?.();
  }, []);

  return on;
}
