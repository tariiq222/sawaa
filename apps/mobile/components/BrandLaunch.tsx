import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { useReduceMotion } from '@/hooks/useA11y';
import { sawaaColors } from '@/theme/sawaa/tokens';

/** Bridge the static native launch screen into a short, accessible brand reveal. */
export function BrandLaunch() {
  const reduceMotion = useReduceMotion();
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // The React overlay is mounted before the native splash disappears, so
    // loading fonts or persisted auth cannot expose a blank intermediate frame.
    void SplashScreen.hideAsync();
    const animation = reduceMotion
      ? Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true })
      : Animated.sequence([
          Animated.timing(scale, { toValue: 1.06, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 280, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]);
    animation.start(({ finished }) => {
      if (finished) setVisible(false);
    });
    return () => animation.stop();
  }, [opacity, reduceMotion, scale]);

  if (!visible) return null;

  return (
    <Animated.View accessibilityViewIsModal style={[styles.overlay, { opacity }]}>
      <Animated.Image source={require('@/assets/sawa/splash.png')} resizeMode="contain"
        style={[styles.logo, { transform: [{ scale }] }]} accessibilityIgnoresInvertColors />
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
  logo: { width: 290, height: 290 },
});
