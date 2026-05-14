import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/useTheme';

export function ChatTypingIndicator() {
  const { theme } = useTheme();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      );

    const anim1 = animate(dot1, 0);
    const anim2 = animate(dot2, 150);
    const anim3 = animate(dot3, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (dot: Animated.Value) => ({
    opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [
      { scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) },
    ],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surfaceHigh }]}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={`dot-${i}`}
          style={[styles.dot, { backgroundColor: theme.colors.textMuted }, dotStyle(dot)]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginLeft: 12,
    marginBottom: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
