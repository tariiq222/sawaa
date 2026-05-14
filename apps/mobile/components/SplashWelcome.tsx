import { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ImageBackground,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Leaf, ShieldCheck, ArrowLeft, ArrowRight } from 'lucide-react-native';

import { Glass } from '@/theme';
import { sawaaTokens, sawaaColors } from '@/theme/sawaa/tokens';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

type Props = { onContinue: () => void };

export function SplashWelcome({ onContinue }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f700 = getFontName(dir.locale, '700');
  const ArrowIcon = dir.isRTL ? ArrowLeft : ArrowRight;

  // Content entrance
  const appear = useSharedValue(0);
  // Drifting blobs
  const blobA = useSharedValue(0);
  const blobB = useSharedValue(0);
  // Progress shimmer
  const shimmer = useSharedValue(0);
  // Logo breathe
  const breathe = useSharedValue(0);

  useEffect(() => {
    appear.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    blobA.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 9000, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    blobB.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 11000, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    breathe.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [appear, blobA, blobB, shimmer, breathe]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ translateY: interpolate(appear.value, [0, 1], [28, 0]) }],
  }));

  const blobAStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(blobA.value, [0, 1], [-30, 40]) },
      { translateY: interpolate(blobA.value, [0, 1], [0, 60]) },
      { scale: interpolate(blobA.value, [0, 1], [1, 1.15]) },
    ],
    opacity: interpolate(blobA.value, [0, 1], [0.55, 0.85]),
  }));

  const blobBStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(blobB.value, [0, 1], [30, -40]) },
      { translateY: interpolate(blobB.value, [0, 1], [20, -40]) },
      { scale: interpolate(blobB.value, [0, 1], [1.05, 0.95]) },
    ],
    opacity: interpolate(blobB.value, [0, 1], [0.45, 0.75]),
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.35, 1]),
    transform: [{ scaleX: interpolate(shimmer.value, [0, 1], [0.85, 1]) }],
  }));

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(breathe.value, [0, 1], [1, 1.04]) }],
  }));

  const breatheHaloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.35, 0.7]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [1, 1.18]) }],
  }));

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onContinue();
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('@/assets/bg.jpg')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      {/* Depth overlay to match app palette */}
      <LinearGradient
        colors={[
          'rgba(242,249,249,0.55)',
          'rgba(216,238,241,0.35)',
          'rgba(21,79,87,0.18)',
        ]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Drifting ambient blobs */}
      <Animated.View style={[styles.blob, styles.blobA, blobAStyle]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(118,185,196,0.55)', 'rgba(118,185,196,0)']}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <Animated.View style={[styles.blob, styles.blobB, blobBStyle]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(255,179,0,0.32)', 'rgba(255,179,0,0)']}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* Corner brackets */}
      <View style={[styles.bracket, styles.bracketTL]} pointerEvents="none" />
      <View style={[styles.bracket, styles.bracketTR]} pointerEvents="none" />
      <View style={[styles.bracket, styles.bracketBL]} pointerEvents="none" />
      <View style={[styles.bracket, styles.bracketBR]} pointerEvents="none" />

      <Animated.View
        style={[
          styles.content,
          contentStyle,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 },
        ]}
      >
        {/* Hero: logo + title */}
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <Animated.View style={[styles.halo, breatheHaloStyle]} pointerEvents="none" />
            <Animated.View style={breatheStyle}>
              <Glass variant="strong" radius={sawaaTokens.radius.pill} style={styles.logo}>
                <Leaf size={42} color={sawaaColors.teal[700]} strokeWidth={1.6} />
              </Glass>
            </Animated.View>
          </View>

          <Text
            style={[
              styles.title,
              { fontFamily: f700, writingDirection: dir.writingDirection },
            ]}
          >
            {t('splash.title')}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { fontFamily: f500, writingDirection: dir.writingDirection },
            ]}
          >
            {t('splash.tagline')}
          </Text>
        </View>

        {/* Footer: progress + CTA + privacy */}
        <View style={styles.footer}>
          <View style={[styles.progress, { flexDirection: dir.row }]}>
            <View style={[styles.dot, styles.dotInactive]} />
            <Animated.View style={[styles.dot, styles.dotActive, shimmerStyle]} />
            <View style={[styles.dot, styles.dotInactive]} />
          </View>

          <Pressable
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel={t('splash.cta')}
            style={({ pressed }) => [styles.ctaWrap, pressed && { transform: [{ scale: 0.98 }] }]}
          >
            <Glass variant="strong" radius={sawaaTokens.radius.pill} style={[styles.cta, { flexDirection: dir.row }]}>
              <Text
                style={[
                  styles.ctaText,
                  { fontFamily: f700, writingDirection: dir.writingDirection },
                ]}
              >
                {t('splash.cta')}
              </Text>
              <View style={styles.ctaIcon}>
                <ArrowIcon size={20} color={sawaaColors.teal[700]} strokeWidth={2.2} />
              </View>
            </Glass>
          </Pressable>

          <View style={[styles.privacy, { flexDirection: dir.row }]}>
            <ShieldCheck size={14} color={sawaaColors.ink[500]} strokeWidth={2} />
            <Text
              style={[
                styles.privacyText,
                { fontFamily: f400, writingDirection: dir.writingDirection },
              ]}
            >
              {t('splash.privacy')}
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F9F9' },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  halo: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  logo: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    color: sawaaColors.teal[700],
    textAlign: 'center',
    letterSpacing: 0.2,
    paddingHorizontal: 16,
  },
  subtitle: {
    fontSize: 15,
    color: sawaaColors.ink[500],
    textAlign: 'center',
    marginTop: 2,
  },
  footer: { width: '100%', alignItems: 'center', gap: 20 },
  progress: { alignItems: 'center', gap: 8, marginBottom: 4 },
  dot: { height: 4, borderRadius: 999 },
  dotInactive: { width: 18, backgroundColor: 'rgba(21,79,87,0.2)' },
  dotActive: { width: 44, backgroundColor: sawaaColors.teal[700] },
  ctaWrap: { width: '100%', alignItems: 'center' },
  cta: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    minWidth: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  ctaText: { color: sawaaColors.teal[700], fontSize: 16, letterSpacing: 0.3 },
  ctaIcon: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacy: { alignItems: 'center', gap: 6, opacity: 0.85 },
  privacyText: { fontSize: 12, color: sawaaColors.ink[500], letterSpacing: 0.2 },
  blob: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 999,
    overflow: 'hidden',
  },
  blobA: { top: -60, left: -80 },
  blobB: { bottom: -80, right: -60 },
  bracket: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  bracketTL: { top: 24, left: 20, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopLeftRadius: 18 },
  bracketTR: { top: 24, right: 20, borderTopWidth: 1.5, borderRightWidth: 1.5, borderTopRightRadius: 18 },
  bracketBL: { bottom: 24, left: 20, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderBottomLeftRadius: 18 },
  bracketBR: { bottom: 24, right: 20, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderBottomRightRadius: 18 },
});
