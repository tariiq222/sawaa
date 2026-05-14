import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
  I18nManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { markOnboardingSeen } from '@/lib/onboarding';

type Slide = {
  key: string;
  title: string;
  body: string;
  emoji: string;
};

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    title: 'أهلاً بك في سَواء',
    body: 'رفيقك للراحة النفسية —\nمساحة آمنة، خاصة، وقريبة منكِ.',
    emoji: '🌿',
  },
  {
    key: 'mood',
    title: 'تتبّع مزاجك',
    body: 'سجلات يومية ورسوم بيانية\nترصد رحلتك خطوة بخطوة.',
    emoji: '📈',
  },
  {
    key: 'book',
    title: 'احجز جلستك',
    body: 'معالجون نفسيون معتمدون،\nجاهزون متى احتجتِ إليهم.',
    emoji: '🗓️',
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function ArrowIcon({ size = 14, color = '#fff' }: { size?: number; color?: string }) {
  // RTL: visual "next" arrow points to the start side (left in RTL)
  const flip = I18nManager.isRTL ? 1 : -1;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={flip === 1 ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SlideView({ slide, fontHeading, fontBody }: { slide: Slide; fontHeading: string; fontBody: string }) {
  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <Animated.View entering={FadeIn.duration(500)} style={styles.illustration}>
        <Glass variant="strong" radius={sawaaRadius.xl} style={styles.illustrationGlass}>
          <Text style={styles.emoji}>{slide.emoji}</Text>
        </Glass>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(120).duration(500)} style={styles.textBlock}>
        <Text style={[styles.title, { fontFamily: fontHeading }]}>{slide.title}</Text>
        <Text style={[styles.body, { fontFamily: fontBody }]}>{slide.body}</Text>
      </Animated.View>
    </View>
  );
}

export default function OnboardingScreen() {
  const f700 = getFontName('ar', '700');
  const f500 = getFontName('ar', '500');
  const f600 = getFontName('ar', '600');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  const isLast = activeIndex === SLIDES.length - 1;

  const finish = useCallback(async () => {
    await markOnboardingSeen();
    router.replace('/(client)/(tabs)/home');
  }, []);

  const handleNext = useCallback(() => {
    if (isLast) {
      void finish();
      return;
    }
    const next = activeIndex + 1;
    listRef.current?.scrollToOffset({ offset: next * SCREEN_WIDTH, animated: true });
    setActiveIndex(next);
  }, [activeIndex, isLast, finish]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0];
      if (first && typeof first.index === 'number') {
        setActiveIndex(first.index);
      }
    },
  ).current;

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SCREEN_WIDTH);
    if (idx !== activeIndex && idx >= 0 && idx < SLIDES.length) {
      setActiveIndex(idx);
    }
  }, [activeIndex]);

  const handleSkip = useCallback(() => {
    void finish();
  }, [finish]);

  return (
    <AquaBackground>
      <View style={styles.container}>
        <View style={styles.skipRow}>
          <Pressable onPress={handleSkip} hitSlop={10}>
            <Text style={[styles.skipText, { fontFamily: f500 }]}>تخطّي</Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(s) => s.key}
          renderItem={({ item }) => (
            <SlideView slide={item} fontHeading={f700} fontBody={f500} />
          )}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          style={styles.list}
        />

        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[styles.dot, i === activeIndex ? styles.dotActive : null]}
            />
          ))}
        </View>

        <View style={styles.ctaBar}>
          <Pressable onPress={handleNext} style={styles.ctaPress} accessibilityRole="button">
            <LinearGradient
              colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              <Text style={[styles.ctaText, { fontFamily: f700 }]}>
                {isLast ? 'ابدأ' : 'التالي'}
              </Text>
              <ArrowIcon />
            </LinearGradient>
          </Pressable>
          <Text style={[styles.hint, { fontFamily: f600 }]}>اسحب للتنقّل</Text>
        </View>
      </View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipRow: {
    position: 'absolute',
    top: 56,
    insetInlineEnd: 20,
    zIndex: 10,
  },
  skipText: { fontSize: 13, color: sawaaColors.ink[500] },
  list: { flex: 1, marginTop: 100 },
  slide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  illustration: {
    marginTop: 40,
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationGlass: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 96 },
  textBlock: {
    marginTop: 48,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    color: sawaaColors.ink[900],
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: sawaaColors.ink[700],
    textAlign: 'center',
    marginTop: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 24,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(10,60,60,0.2)',
  },
  dotActive: {
    width: 22,
    backgroundColor: sawaaColors.teal[600],
  },
  ctaBar: {
    paddingHorizontal: 24,
    paddingBottom: 42,
    alignItems: 'center',
    gap: 10,
  },
  ctaPress: { width: '100%' },
  cta: {
    height: 52,
    borderRadius: sawaaRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: sawaaColors.teal[600],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  ctaText: { color: '#fff', fontSize: 14 },
  hint: { fontSize: 11, color: sawaaColors.ink[500] },
});
