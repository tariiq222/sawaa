import React, { useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronLeft, ChevronRight, CircleUserRound, House, Package, Users, UsersRound } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppIcon } from '@/components/ui/AppIcon';
import { FloatingActionBar } from '@/components/ui/FloatingActionBar';
import { Glass } from '@/theme/components/Glass';
import { useReduceMotion } from '@/hooks/useA11y';
import { useDir } from '@/hooks/useDir';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { getFontName } from '@/theme/fonts';
import { getSawaaGlassAppearance, getSawaaRoles } from '@/theme/sawaa/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export type GuestDockSection = 'home' | 'clinics' | 'therapists' | 'packages' | 'programs' | 'account';
type DiscoverySection = Exclude<GuestDockSection, 'home' | 'account'>;

const DISCOVERY_IMAGES: Record<DiscoverySection, ImageSourcePropType> = {
  clinics: require('@/assets/discovery/clinics.webp'),
  therapists: require('@/assets/discovery/therapists.webp'),
  packages: require('@/assets/discovery/packages.webp'),
  programs: require('@/assets/discovery/programs.webp'),
};

type DockItem = {
  id: GuestDockSection | 'account';
  label: string;
  sf: React.ComponentProps<typeof AppIcon>['sf'];
  fallback: LucideIcon;
  route: '/home' | '/public-list/clinics' | '/public-list/therapists' | '/public-list/packages' | '/public-list/programs' | '/guest-account';
};

function useDiscoveryItems(): (DockItem & { id: DiscoverySection })[] {
  const { t } = useTranslation();
  return [
    { id: 'clinics', label: t('clinics.title'), sf: 'building.2.fill', fallback: Building2, route: '/public-list/clinics' },
    { id: 'therapists', label: t('guest.therapists'), sf: 'person.2.fill', fallback: UsersRound, route: '/public-list/therapists' },
    { id: 'packages', label: t('guest.packages'), sf: 'shippingbox.fill', fallback: Package, route: '/public-list/packages' },
    { id: 'programs', label: t('guest.programs'), sf: 'person.3.fill', fallback: Users, route: '/public-list/programs' },
  ];
}

type GuestNavSection = 'home' | 'clinics' | 'therapists' | 'account';
type TabPosition = { x: number; width: number };
const LENS_OVERHANG = 10;
const LENS_REST_SCALE = 0.78;
let previousGuestSection: GuestNavSection = 'home';

function useGuestItems(): (DockItem & { id: GuestNavSection })[] {
  const { t } = useTranslation();
  return [
    { id: 'home', label: t('tabs.home'), sf: 'house.fill', fallback: House, route: '/home' },
    { id: 'clinics', label: t('clinics.title'), sf: 'building.2.fill', fallback: Building2, route: '/public-list/clinics' },
    { id: 'therapists', label: t('guest.therapists'), sf: 'person.2.fill', fallback: UsersRound, route: '/public-list/therapists' },
    { id: 'account', label: t('tabs.profile'), sf: 'person.crop.circle.fill', fallback: CircleUserRound, route: '/guest-account' },
  ];
}

export function GuestDock({ active }: { active: GuestDockSection }) {
  const router = useRouter();
  const dir = useDir();
  const colors = useSawaaColors();
  const { scheme } = useTheme();
  const reduceMotion = useReduceMotion();
  const items = useGuestItems();
  const positions = useRef<Partial<Record<GuestNavSection, TabPosition>>>({});
  const [layoutReady, setLayoutReady] = useState(false);
  const [positionRevision, setPositionRevision] = useState(0);
  const lensX = useRef(new Animated.Value(0)).current;
  const lensScale = useRef(new Animated.Value(LENS_REST_SCALE)).current;

  const setLensPressed = (pressed: boolean) => {
    lensScale.stopAnimation();
    const nextScale = pressed ? 1 : LENS_REST_SCALE;
    if (reduceMotion) lensScale.setValue(nextScale);
    else Animated.spring(lensScale, {
      toValue: nextScale, damping: 16, stiffness: 260, mass: 0.65, useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (!layoutReady || !(active in positions.current)) return;
    const target = positions.current[active as GuestNavSection];
    if (target === undefined) return;
    const from = positions.current[previousGuestSection] ?? target;
    lensX.setValue(from.x - LENS_OVERHANG);
    if (reduceMotion || from.x === target.x) lensX.setValue(target.x - LENS_OVERHANG);
    else Animated.spring(lensX, { toValue: target.x - LENS_OVERHANG, damping: 19, stiffness: 175, mass: 0.8, useNativeDriver: true }).start();
    previousGuestSection = active as GuestNavSection;
    return () => lensX.stopAnimation();
  }, [active, layoutReady, lensX, positionRevision, reduceMotion]);

  return (
    <FloatingActionBar variant="regular" allowOverflow>
      <View style={[styles.row, { flexDirection: dir.row }]} accessibilityRole="tablist">
        <Animated.View pointerEvents="none" testID="dock-glass-lens"
          style={[styles.lens, {
            width: (positions.current[active as GuestNavSection]?.width ?? 0) + LENS_OVERHANG * 2,
            opacity: layoutReady && active in positions.current ? 1 : 0,
            shadowColor: getSawaaRoles(scheme).backdrop.base,
            transform: [{ translateX: lensX }, { scale: lensScale }],
          }]}>
          <Glass variant={scheme === 'light' ? 'regular' : 'clear'}
            tint={getSawaaGlassAppearance(scheme).nativeTint}
            radius={44} style={styles.lensGlass}>
            <LinearGradient colors={getSawaaGlassAppearance(scheme).sheen}
              locations={[0, 0.28, 1]}
              start={{ x: 0, y: 0 }} end={{ x: 0.75, y: 1 }}
              style={styles.lensSheen} />
            <View pointerEvents="none" style={[styles.lensRim, {
              borderTopColor: getSawaaGlassAppearance(scheme).rim,
              borderBottomColor: getSawaaGlassAppearance(scheme).lowerRim,
            }]} />
          </Glass>
        </Animated.View>
        {items.map((item) => {
          const selected = active === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPressIn={() => setLensPressed(true)}
              onPressOut={() => setLensPressed(false)}
              onPress={() => router.replace(item.route)}
              onLayout={({ nativeEvent }) => {
                const { x, width } = nativeEvent.layout;
                const previous = positions.current[item.id];
                if (previous?.x === x && previous.width === width) return;
                positions.current[item.id] = { x, width };
                setPositionRevision((revision) => revision + 1);
                if (items.every(({ id }) => positions.current[id] !== undefined)) setLayoutReady(true);
              }}
              style={styles.item}
            >
              <AppIcon sf={item.sf} fallback={item.fallback} size={23}
                color={selected ? colors.teal[700] : colors.ink[700]} />
            </Pressable>
          );
        })}
      </View>
    </FloatingActionBar>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', height: 56, alignItems: 'center', position: 'relative' },
  item: { flex: 1, minWidth: 48, minHeight: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  lens: { position: 'absolute', left: 0, top: -16, height: 88, zIndex: 2, shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  lensGlass: { width: '100%', height: '100%' },
  lensSheen: { width: '100%', height: '100%', borderRadius: 44 },
  lensRim: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 44 },
  cards: { gap: 12 },
  card: { width: '100%', height: 166, borderRadius: 24, overflow: 'hidden' },
  cardImage: { width: '100%', height: 166, justifyContent: 'flex-end' },
  imageOverlay: { ...StyleSheet.absoluteFillObject },
  captionInner: { minHeight: 78, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10, justifyContent: 'center', gap: 2 },
  captionTop: { alignItems: 'center', gap: 8 },
  captionText: { flex: 1, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  description: { fontSize: 12, lineHeight: 18 },
});

export function GuestDiscoveryGrid() {
  const router = useRouter();
  const dir = useDir();
  const { scheme } = useTheme();
  const { t } = useTranslation();
  const roles = getSawaaRoles(scheme);
  const items = useDiscoveryItems();
  const font = getFontName(dir.locale, '400');
  const bold = getFontName(dir.locale, '700');
  const foreground = roles.action.foreground;

  return (
    <View style={styles.cards}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={styles.card}
          onPress={() => router.push(item.route)}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <ImageBackground source={DISCOVERY_IMAGES[item.id]} resizeMode="cover" style={styles.cardImage}>
            <LinearGradient
              colors={[roles.highlight[2], roles.backdrop.wash]}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={styles.imageOverlay}
            />
            <View style={styles.captionInner}>
              <View style={[styles.captionTop, { flexDirection: dir.row }]}>
                <AppIcon sf={item.sf} fallback={item.fallback} size={19} color={foreground} />
                <Text style={[styles.captionText, { fontFamily: bold, color: foreground, textAlign: dir.textAlign }]}>
                  {item.label}
                </Text>
                <AppIcon sf={dir.isRTL ? 'chevron.left' : 'chevron.right'}
                  fallback={dir.isRTL ? ChevronLeft : ChevronRight} size={17} color={foreground} />
              </View>
              <Text numberOfLines={2} style={[styles.description, { fontFamily: font, color: foreground, textAlign: dir.textAlign }]}>
                {t(`guest.${item.id}Description`)}
              </Text>
            </View>
          </ImageBackground>
        </Pressable>
      ))}
    </View>
  );
}
