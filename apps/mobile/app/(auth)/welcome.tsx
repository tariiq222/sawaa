import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { AquaBackground, sawaaRadius, withAlpha } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { getSawaaRoles } from '@/theme/sawaa/tokens';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { useDir } from '@/hooks/useDir';

function LeafIcon({ size = 14, color }: { size?: number; color?: string }) {
  const colors = useSawaaColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C7 6 4 10 4 14a8 8 0 0 0 16 0c0-4-3-8-8-12Z"
        stroke={color ?? colors.teal[700]}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path d="M12 22V10" stroke={color ?? colors.teal[700]} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

function ArrowIcon({ size = 14, color }: { size?: number; color?: string }) {
  const { theme } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={color ?? theme.colors.primaryForeground} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Orb({
  size,
  top,
  left,
  delay = 0,
  floatOffset = 0,
}: {
  size: number;
  top: number;
  left: number;
  delay?: number;
  floatOffset?: number;
}) {
  const colors = useSawaaColors();
  const { scheme } = useTheme();
  const highlights = getSawaaRoles(scheme).highlight;
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withDelay(
      1800,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 4800 + floatOffset, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 4800 + floatOffset, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [float, floatOffset]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value * 4 - 2 }],
  }));

  const uid = `${size}-${top}-${left}`;
  const body = `body-${uid}`;
  const hi = `hi-${uid}`;
  const rim = `rim-${uid}`;
  return (
    <Animated.View
      entering={ZoomIn.delay(delay).duration(1400).easing(Easing.bezier(0.22, 1, 0.36, 1))}
      style={{ position: 'absolute', top: top - 10, left: left - 10, width: size + 20, height: size + 20 }}
    >
    <Animated.View style={[{ width: '100%', height: '100%' }, floatStyle]}>
    <Svg
      width={size + 20}
      height={size + 20}
    >
      <Defs>
        {/* Sphere body — soft bright core, gentle teal wash */}
        <RadialGradient id={body} cx="38%" cy="32%" r="72%">
          <Stop offset="0%" stopColor={highlights[0]} stopOpacity={0.72} />
          <Stop offset="40%" stopColor={colors.teal[50]} stopOpacity={0.45} />
          <Stop offset="80%" stopColor={colors.teal[100]} stopOpacity={0.28} />
          <Stop offset="100%" stopColor={colors.teal[200]} stopOpacity={0.22} />
        </RadialGradient>
        {/* Specular hotspot — soft highlight */}
        <RadialGradient id={hi} cx="38%" cy="28%" r="30%">
          <Stop offset="0%" stopColor={highlights[0]} stopOpacity={0.55} />
          <Stop offset="70%" stopColor={highlights[0]} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={highlights[0]} stopOpacity={0} />
        </RadialGradient>
        {/* Rim — subtle ring */}
        <RadialGradient id={rim} cx="50%" cy="50%" r="50%">
          <Stop offset="88%" stopColor={highlights[0]} stopOpacity={0} />
          <Stop offset="98%" stopColor={highlights[0]} stopOpacity={0.45} />
          <Stop offset="100%" stopColor={highlights[0]} stopOpacity={0.12} />
        </RadialGradient>
      </Defs>
      {/* cast shadow — soft */}
      <Circle cx={size / 2 + 10} cy={size / 2 + 13} r={size / 2 - 2} fill={withAlpha(colors.ink[900], 0.09)} />
      {/* body */}
      <Circle cx={size / 2 + 10} cy={size / 2 + 10} r={size / 2 - 1} fill={`url(#${body})`} />
      {/* rim highlight */}
      <Circle cx={size / 2 + 10} cy={size / 2 + 10} r={size / 2 - 1} fill={`url(#${rim})`} />
      {/* specular hotspot */}
      <Circle cx={size / 2 + 10} cy={size / 2 + 10} r={size / 2 - 1} fill={`url(#${hi})`} />
    </Svg>
    </Animated.View>
    </Animated.View>
  );
}

function Orbs({ brandText, brandFont }: { brandText: string; brandFont: string }) {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.orbsContainer}>
      <Orb size={60} top={40} left={0} delay={400} floatOffset={600} />
      <Orb size={150} top={20} left={40} delay={0} floatOffset={0} />
      <Orb size={90} top={110} left={130} delay={700} floatOffset={1200} />
      <Animated.View
        pointerEvents="none"
        entering={FadeIn.delay(1300).duration(1100).easing(Easing.out(Easing.cubic))}
        style={styles.orbBrandWrap}
      >
        <Text style={[styles.orbBrand, { fontFamily: brandFont }]}>{brandText}</Text>
      </Animated.View>
    </View>
  );
}

export default function WelcomeScreen() {
  const { theme } = useTheme();
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const dir = useDir();
  const f700 = getFontName(dir.locale, '700');
  const f600 = getFontName(dir.locale, '600');
  const f500 = getFontName(dir.locale, '500');

  return (
    <AquaBackground>
      <View style={styles.container}>
        <View style={styles.orbsWrap}>
          <Orbs brandText={t('welcome.brand', 'سَواء')} brandFont={f700} />
        </View>

        <Animated.View
          entering={FadeInDown.delay(1600).duration(1000).easing(Easing.out(Easing.cubic))}
          style={styles.textBlock}
        >
          <Text style={[styles.headline, { fontFamily: f700 }]}>
            {t('welcome.headline', 'رحلتك للسواء تبدأ هنا')}
          </Text>
          <Text style={[styles.sub, { fontFamily: f500, fontWeight: '500' }]}>
            {t('welcome.sub', 'جلسات سرّية مع أفضل المعالجين النفسيين،\nخلال لحظات — أينما كنتِ.')}
          </Text>
          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(2000).duration(1000).easing(Easing.out(Easing.cubic))}
          style={styles.ctaBar}
        >
        <Glass variant="strong" radius={sawaaRadius.pill} style={styles.ctaInner}>
          <View style={styles.ctaRow}>
            <Pressable onPress={() => router.push('/(auth)/login')} hitSlop={8} style={styles.ctaSecondary}>
              <Text style={[styles.ctaSecondaryText, { fontFamily: f600, fontWeight: '600' }]}>
                {t('welcome.signIn', 'تسجيل دخول')}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.push('/(auth)/register')} style={styles.ctaPrimaryPress}>
              <LinearGradient
                colors={theme.colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaPrimary}
              >
                {/* Specular sheen on top half */}
                <LinearGradient
                  colors={[withAlpha(theme.colors.primaryForeground, 0.38), withAlpha(theme.colors.primaryForeground, 0)]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.ctaSheen}
                  pointerEvents="none"
                />
                <View style={styles.ctaTopEdge} pointerEvents="none" />
                <Text style={[styles.ctaPrimaryText, { fontFamily: f700, color: theme.colors.primaryForeground }]}>
                  {t('welcome.signUp', 'تسجيل جديد')}
                </Text>
                <ArrowIcon />
              </LinearGradient>
            </Pressable>
          </View>
        </Glass>
        </Animated.View>
      </View>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  orbsWrap: { alignItems: 'center', marginTop: 120 },
  orbsContainer: { width: 240, height: 240, position: 'relative' },
  orbBrandWrap: {
    position: 'absolute',
    top: 20,
    left: 40,
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbBrand: {
    fontSize: 28,
    color: colors.teal[600],
    opacity: 0.72,
    letterSpacing: 0.5,
    textShadowColor: colors.glass.border,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  textBlock: { position: 'absolute', bottom: 180, start: 36, end: 36, alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  brand: { fontSize: 13, color: colors.teal[700] },
  headline: { fontSize: 28, lineHeight: 36, textAlign: 'center', color: colors.ink[900] },
  sub: { fontSize: 14, lineHeight: 22, textAlign: 'center', color: colors.ink[700], marginTop: 10 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: withAlpha(colors.ink[900], 0.2) },
  dotActive: { width: 22, backgroundColor: colors.teal[600] },
  ctaBar: { position: 'absolute', bottom: 42, start: 16, end: 16 },
  ctaInner: { padding: 6 },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 46,
    paddingHorizontal: 6,
  },
  ctaSecondary: { paddingHorizontal: 14, height: '100%', justifyContent: 'center' },
  ctaSecondaryText: { fontSize: 13, color: colors.ink[700] },
  ctaPrimaryPress: { width: 185, height: '100%' },
  ctaPrimary: {
    flex: 1,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
    shadowColor: colors.teal[600],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  ctaSheen: { position: 'absolute', top: 0, start: 0, end: 0, bottom: '55%' },
  ctaTopEdge: {
    position: 'absolute',
    top: 0,
    start: 12,
    end: 12,
    height: 1,
    backgroundColor: colors.glass.border,
  },
  ctaPrimaryText: { fontSize: 13 },
});
