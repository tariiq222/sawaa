import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import type { PublicMobileHomeCard, MobileHomeDestination } from '@/services/mobile-home-cards';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { getSawaaRoles, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useTheme } from '@/theme/useTheme';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';

const destinationRoutes: Record<MobileHomeDestination, { guest: Href; client: Href }> = {
  CLINICS: { guest: '/public-list/clinics', client: '/(client)/clinics' },
  SERVICES: { guest: '/explore', client: '/(client)/(tabs)/explore' },
  SPECIALISTS: { guest: '/public-list/therapists', client: '/(client)/therapists' },
  PACKAGES: { guest: '/public-list/packages', client: '/(client)/packages' },
  PROGRAMS: { guest: '/public-list/programs', client: '/(client)/groups' },
};

interface HomeCardsCarouselProps {
  cards: PublicMobileHomeCard[];
  signedIn?: boolean;
}

export function HomeCardsCarousel({ cards, signedIn = false }: HomeCardsCarouselProps) {
  const dir = useDir();
  const router = useRouter();
  const colors = useSawaaColors();
  const { scheme } = useTheme();
  const roles = getSawaaRoles(scheme);
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const [activeCardId, setActiveCardId] = useState<string | undefined>(cards[0]?.id);
  const [entryDirection, setEntryDirection] = useState(dir.isRTL ? 1 : -1);
  const [failedImages, setFailedImages] = useState<Record<string, string>>({});
  const activeIndexRef = useRef(0);
  const latestGestureRef = useRef({ isRTL: dir.isRTL, cardCount: cards.length });
  const selectCardRef = useRef<(index: number, physicalDirection?: number) => void>(() => undefined);
  const opacity = useRef(new Animated.Value(1)).current;
  const offsetX = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<{ stop: () => void } | null>(null);
  const hasAnimatedCardRef = useRef(false);

  const activeIndexFound = cards.findIndex((card) => card.id === activeCardId);
  const activeIndex = activeIndexFound < 0 ? 0 : activeIndexFound;
  const activeCard = cards[activeIndex];
  const displayedCardId = activeCard?.id;
  latestGestureRef.current = { isRTL: dir.isRTL, cardCount: cards.length };
  activeIndexRef.current = activeIndex;

  useEffect(() => {
    if (cards.length === 0) {
      setActiveCardId(undefined);
      activeIndexRef.current = 0;
      return;
    }
    if (!cards.some((card) => card.id === activeCardId)) {
      setActiveCardId(cards[0].id);
      activeIndexRef.current = 0;
    }
  }, [activeCardId, cards]);

  const selectCard = useCallback((targetIndex: number, physicalDirection?: number) => {
    const currentIndex = activeIndexRef.current;
    const nextIndex = Math.max(0, Math.min(cards.length - 1, targetIndex));
    if (nextIndex === currentIndex || !cards[nextIndex]) return;
    activeIndexRef.current = nextIndex;
    const logicalStep = nextIndex > currentIndex ? 1 : -1;
    setEntryDirection(physicalDirection ?? (dir.isRTL ? logicalStep : -logicalStep));
    setActiveCardId(cards[nextIndex].id);
  }, [cards, dir.isRTL]);
  selectCardRef.current = selectCard;

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      latestGestureRef.current.cardCount > 1
      && Math.abs(gesture.dx) > 12
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
    onPanResponderRelease: (_event, gesture) => {
      if (Math.abs(gesture.dx) < 48 || Math.abs(gesture.dx) <= Math.abs(gesture.dy)) return;
      const isNext = latestGestureRef.current.isRTL ? gesture.dx > 0 : gesture.dx < 0;
      selectCardRef.current(activeIndexRef.current + (isNext ? 1 : -1), gesture.dx > 0 ? 1 : -1);
    },
  })).current;

  useEffect(() => {
    if (!displayedCardId) return;
    animationRef.current?.stop();
    if (!hasAnimatedCardRef.current || reduceMotion) {
      opacity.setValue(1);
      offsetX.setValue(0);
      hasAnimatedCardRef.current = true;
      return;
    }
    opacity.setValue(0);
    offsetX.setValue(-entryDirection * 16);
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(offsetX, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]);
    animationRef.current = animation;
    animation.start();
    return () => animation.stop();
  }, [displayedCardId, entryDirection, offsetX, opacity, reduceMotion]);

  useEffect(() => () => animationRef.current?.stop(), []);

  if (cards.length === 0 || !activeCard) return null;

  const title = (dir.isRTL ? activeCard.titleAr : activeCard.titleEn)?.trim() || activeCard.titleAr;
  const description = ((dir.isRTL ? activeCard.descriptionAr : activeCard.descriptionEn)?.trim()
    || activeCard.descriptionAr?.trim()) ?? '';
  const imageAlt = ((dir.isRTL ? activeCard.imageAltAr : activeCard.imageAltEn)?.trim()
    || activeCard.imageAltAr?.trim() || title);
  const canShowImage = Boolean(activeCard.imageUrl && failedImages[activeCard.id] !== activeCard.imageUrl);
  const route = activeCard.destination ? destinationRoutes[activeCard.destination] : undefined;
  const onPress = route ? () => router.push(signedIn ? route.client : route.guest) : undefined;


  return (
    <View style={styles.container}>
      <Animated.View
        testID="home-cards-viewport"
        {...panResponder.panHandlers}
        style={[styles.viewport, { opacity, transform: [{ translateX: offsetX }] }]}
      >
        <Glass
          variant="strong"
          radius={20}
          style={styles.card}
          onPress={onPress}
          interactive={Boolean(onPress)}
          accessibilityRole={onPress ? 'button' : undefined}
          accessibilityLabel={onPress ? [
            title,
            ...(description && description !== title ? [description] : []),
            ...(activeCard.imageUrl && imageAlt !== title && imageAlt !== description ? [imageAlt] : []),
          ].join('. ') : undefined}
          accessibilityHint={onPress ? t('home.mobileCardOpenHint') : undefined}
          padding={0}
        >
          <View style={styles.cardContent}>
            {canShowImage ? (
              <>
                <Image
                  source={{ uri: activeCard.imageUrl! }}
                  accessibilityRole="image"
                  accessibilityLabel={imageAlt}
                  style={styles.backgroundImage}
                  resizeMode="cover"
                  onError={() => setFailedImages((previous) => ({ ...previous, [activeCard.id]: activeCard.imageUrl! }))}
                />
              </>
            ) : null}
            <View style={[styles.copy, { backgroundColor: roles.surface, padding: sawaaSpacing.md, alignItems: dir.alignStart }]}>
              <Text style={[styles.title, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                {title}
              </Text>
              {description ? (
                <Text style={[styles.description, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                  {description}
                </Text>
              ) : null}
            </View>
          </View>
        </Glass>
      </Animated.View>
      {cards.length > 1 ? (
        <View style={[styles.pagination, { flexDirection: dir.row }]}>
          {cards.map((card, index) => (
            <Pressable
              key={card.id}
              accessibilityRole="button"
              accessibilityLabel={t('home.mobileCardPage', { current: index + 1, total: cards.length })}
              accessibilityState={{ selected: index === activeIndex }}
              hitSlop={4}
              onPress={() => selectCard(index)}
              style={styles.pageButton}
            >
              <View style={[styles.dot, { borderColor: colors.teal[700] }, index === activeIndex && { backgroundColor: colors.teal[700] }]} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 2 },
  viewport: { width: '100%', overflow: 'hidden' },
  card: { width: '100%', minHeight: 180 },
  cardContent: { width: '100%', minHeight: 180, position: 'relative', justifyContent: 'flex-end', overflow: 'hidden' },
  backgroundImage: { ...StyleSheet.absoluteFillObject },
  copy: { gap: 4 },
  title: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight, flexShrink: 1 },
  description: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, flexShrink: 1 },
  pagination: { alignItems: 'center', justifyContent: 'center' },
  pageButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent', borderWidth: 1 },
});
