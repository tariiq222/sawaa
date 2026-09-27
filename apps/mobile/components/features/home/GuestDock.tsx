import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { CircleUserRound, House, Search, CalendarDays } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { FloatingActionBar } from '@/components/ui/FloatingActionBar';
import { Glass } from '@/theme/components/Glass';
import { useReduceMotion } from '@/hooks/useA11y';
import { useDir } from '@/hooks/useDir';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { getFontName } from '@/theme/fonts';
import type { Href } from 'expo-router';
import { getSawaaGlassAppearance, getSawaaRoles } from '@/theme/sawaa/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export type GuestDockSection = 'home' | 'appointments' | 'explore' | 'clinics' | 'therapists' | 'packages' | 'programs' | 'account';
type DockItem = {
  id: GuestDockSection;
  label: string;
  sf: React.ComponentProps<typeof AppIcon>['sf'];
  fallback: LucideIcon;
  route: Href;
};

type GuestNavSection = 'home' | 'appointments' | 'explore' | 'account';
type TabPosition = { x: number; width: number };
const LENS_OVERHANG = 10;
const LENS_REST_SCALE = 0.78;
let previousGuestSection: GuestNavSection = 'home';

function useGuestItems(): (DockItem & { id: GuestNavSection })[] {
  const { t } = useTranslation();
  return [
    { id: 'home', label: t('tabs.home'), sf: 'house.fill', fallback: House, route: '/home' },
    { id: 'appointments', label: t('tabs.appointments'), sf: 'calendar', fallback: CalendarDays, route: '/appointments' },
    { id: 'explore', label: t('tabs.explore'), sf: 'square.grid.2x2.fill', fallback: Search, route: '/explore' },
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
  const selectedSection: GuestNavSection = active === 'clinics' || active === 'therapists' || active === 'packages' || active === 'programs'
    ? 'explore'
    : active;
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
    if (!layoutReady || !(selectedSection in positions.current)) return;
    const target = positions.current[selectedSection];
    if (target === undefined) return;
    const from = positions.current[previousGuestSection] ?? target;
    lensX.setValue(from.x - LENS_OVERHANG);
    if (reduceMotion || from.x === target.x) lensX.setValue(target.x - LENS_OVERHANG);
    else Animated.spring(lensX, { toValue: target.x - LENS_OVERHANG, damping: 19, stiffness: 175, mass: 0.8, useNativeDriver: true }).start();
    previousGuestSection = selectedSection;
    return () => lensX.stopAnimation();
  }, [selectedSection, layoutReady, lensX, positionRevision, reduceMotion]);

  return (
    <FloatingActionBar variant="regular" allowOverflow>
      <View style={[styles.row, { flexDirection: dir.row }]} accessibilityRole="tablist">
        <Animated.View pointerEvents="none" testID="dock-glass-lens"
          style={[styles.lens, {
            width: (positions.current[selectedSection]?.width ?? 0) + LENS_OVERHANG * 2,
            opacity: layoutReady && selectedSection in positions.current ? 1 : 0,
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
          const selected = selectedSection === item.id;
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
              <AppIcon sf={item.sf} fallback={item.fallback} size={20}
                color={selected ? colors.teal[700] : colors.ink[700]} />
              <Text numberOfLines={1} style={[styles.label, { color: selected ? colors.teal[700] : colors.ink[700], fontFamily: getFontName(dir.locale, '600') }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </FloatingActionBar>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', height: 64, alignItems: 'center', position: 'relative' },
  item: { flex: 1, minWidth: 48, minHeight: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 3, zIndex: 1 },
  lens: { position: 'absolute', left: 0, top: -12, height: 88, zIndex: 2, shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  lensGlass: { width: '100%', height: '100%' },
  lensSheen: { width: '100%', height: '100%', borderRadius: 44 },
  lensRim: { ...StyleSheet.absoluteFillObject, borderTopWidth: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 44 },
  label: { fontSize: 10, lineHeight: 13 },
});
