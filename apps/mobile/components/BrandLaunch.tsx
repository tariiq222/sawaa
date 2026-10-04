import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { useReduceMotion } from '@/hooks/useA11y';
import { sawaaColors } from '@/theme/sawaa/tokens';

const GROW_MS = 700;
const EXIT_MS = 450;
const GROWN_SCALE = 1.12;
const EXIT_SCALE = 1.3;
/** Never hold the launch overlay longer than this while the first screen resolves. */
const MAX_WAIT_MS = 4000;
const ANDROID_LOGO_SIZE = 290;

/** Bridge the static native launch screen into a short, accessible brand reveal. */
export function BrandLaunch() {
  const reduceMotion = useReduceMotion();
  const pathname = usePathname();
  const { width, height } = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const [grown, setGrown] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  // `/` is the bootstrap route that restores the session and then redirects;
  // leaving it means the first real screen is mounted underneath.
  const canLeave = pathname !== '/' || timedOut;

  useEffect(() => {
    // The React overlay is mounted before the native splash disappears, so
    // loading fonts or persisted auth cannot expose a blank intermediate frame.
    void SplashScreen.hideAsync();
    const cap = setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => clearTimeout(cap);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setGrown(true);
      return;
    }
    const grow = Animated.timing(scale, {
      toValue: GROWN_SCALE, duration: GROW_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    grow.start(({ finished }) => {
      if (finished) setGrown(true);
    });
    return () => grow.stop();
  }, [reduceMotion, scale]);

  useEffect(() => {
    if (!grown || !canLeave) return;
    const fade = Animated.timing(opacity, {
      toValue: 0, duration: reduceMotion ? 120 : EXIT_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
    });
    const exit = reduceMotion
      ? fade
      : Animated.parallel([
          fade,
          // Continue the same outward motion so the reveal reads as one gesture.
          Animated.timing(scale, {
            toValue: EXIT_SCALE, duration: EXIT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true,
          }),
        ]);
    exit.start(({ finished }) => {
      if (finished) setVisible(false);
    });
    return () => exit.stop();
  }, [canLeave, grown, opacity, reduceMotion, scale]);

  if (!visible) return null;

  // iOS aspect-fits the square launch artwork to the screen; start at that
  // exact size so the handoff from the native splash has no visible jump.
  const logoSize = Platform.OS === 'ios' ? Math.min(width, height) : ANDROID_LOGO_SIZE;

  return (
    <Animated.View testID="brand-launch" accessibilityViewIsModal style={[styles.overlay, { opacity }]}>
      <Animated.Image source={require('@/assets/sawa/splash.png')} resizeMode="contain"
        style={{ width: logoSize, height: logoSize, transform: [{ scale }] }} accessibilityIgnoresInvertColors />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: sawaaColors.teal[500],
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
});
