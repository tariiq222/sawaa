import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CircleUserRound, House, Search, CalendarDays } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppIcon } from '@/components/ui/AppIcon';
import { Glass } from '@/theme/components/Glass';
import { useReduceMotion } from '@/hooks/useA11y';
import { useDir } from '@/hooks/useDir';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { getFontName } from '@/theme/fonts';
import type { Href } from 'expo-router';
import { sawaaRadius, sawaaSpacing, withAlpha } from '@/theme/sawaa/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export type GuestDockSection = 'home' | 'appointments' | 'explore' | 'clinics' | 'therapists' | 'packages' | 'programs' | 'account';
type DockItem = {
  id: GuestDockSection;
  label: string;
  sf: React.ComponentProps<typeof AppIcon>['sf'];
  selectedSf: React.ComponentProps<typeof AppIcon>['sf'];
  fallback: LucideIcon;
  route: Href;
};

type GuestNavSection = 'home' | 'appointments' | 'explore' | 'account';
type TabPosition = { x: number; width: number };
const LENS_REST_SCALE = 1;
let previousGuestSection: GuestNavSection = 'home';

function useGuestItems(): (DockItem & { id: GuestNavSection })[] {
  const { t } = useTranslation();
  return [
    { id: 'home', label: t('tabs.home'), sf: 'house', selectedSf: 'house.fill', fallback: House, route: '/home' },
    { id: 'appointments', label: t('tabs.appointments'), sf: 'calendar', selectedSf: 'calendar', fallback: CalendarDays, route: '/appointments' },
    { id: 'explore', label: t('tabs.explore'), sf: 'square.grid.2x2', selectedSf: 'square.grid.2x2.fill', fallback: Search, route: '/explore' },
    { id: 'account', label: t('tabs.profile'), sf: 'person.crop.circle', selectedSf: 'person.crop.circle.fill', fallback: CircleUserRound, route: '/guest-account' },
  ];
}

export function GuestDock({ active }: { active: GuestDockSection }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    const nextScale = pressed ? 0.96 : LENS_REST_SCALE;
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
    lensX.setValue(from.x);
    if (reduceMotion || from.x === target.x) lensX.setValue(target.x);
    else Animated.spring(lensX, { toValue: target.x, damping: 19, stiffness: 175, mass: 0.8, useNativeDriver: true }).start();
    previousGuestSection = selectedSection;
    return () => lensX.stopAnimation();
  }, [selectedSection, layoutReady, lensX, positionRevision, reduceMotion]);

  return (
    <View pointerEvents="box-none" style={[styles.dockPosition, { bottom: Math.max(sawaaSpacing.sm, insets.bottom - sawaaSpacing.sm) }]}>
      <Glass variant="regular" tint={withAlpha(colors.teal[500], scheme === 'dark' ? 0.12 : 0.08)}
        radius={sawaaRadius.pill} padding={sawaaSpacing.xs}>
      <View style={[styles.row, { flexDirection: dir.row }]} accessibilityRole="tablist">
        <Animated.View pointerEvents="none" testID="dock-glass-lens"
          style={[styles.lens, {
            width: positions.current[selectedSection]?.width ?? 0,
            opacity: layoutReady && selectedSection in positions.current ? 1 : 0,
            transform: [{ translateX: lensX }, { scale: lensScale }],
          }]}>
          <Glass variant="regular" tint={withAlpha(colors.teal[600], scheme === 'dark' ? 0.26 : 0.2)}
            radius={sawaaRadius.pill} style={styles.lensGlass}>
            <View style={[styles.lensFill, { backgroundColor: withAlpha(colors.teal[500], scheme === 'dark' ? 0.15 : 0.12) }]} />
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
              <AppIcon sf={selected ? item.selectedSf : item.sf} fallback={item.fallback} size={24}
                color={selected ? colors.teal[700] : colors.ink[900]} />
              <Text numberOfLines={1} style={[styles.label, { color: selected ? colors.teal[700] : colors.ink[900], fontFamily: getFontName(dir.locale, '600') }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  dockPosition: { position: 'absolute', start: sawaaSpacing.lg, end: sawaaSpacing.lg },
  row: { width: '100%', height: 60, alignItems: 'center', position: 'relative' },
  item: { flex: 1, minWidth: 48, minHeight: 60, borderRadius: sawaaRadius.pill, alignItems: 'center', justifyContent: 'center', gap: 3, zIndex: 1 },
  lens: { position: 'absolute', left: 0, top: 0, height: 60, zIndex: 0 },
  lensGlass: { width: '100%', height: '100%' },
  lensFill: { width: '100%', height: '100%', borderRadius: sawaaRadius.pill },
  label: { fontSize: 12, lineHeight: 16 },
});
