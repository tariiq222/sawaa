import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
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

export type GuestDockSection = 'home' | 'appointments' | 'explore' | 'clinics' | 'therapists' | 'packages' | 'programs' | 'account';
type DockItem = {
  id: GuestDockSection;
  label: string;
  sf: React.ComponentProps<typeof AppIcon>['sf'];
  fallback: LucideIcon;
  route: Href;
};

type GuestNavSection = 'home' | 'appointments' | 'explore' | 'account';
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
  const reduceMotion = useReduceMotion();
  const items = useGuestItems();
  const selectedSection: GuestNavSection = active === 'clinics' || active === 'therapists' || active === 'packages' || active === 'programs'
    ? 'explore'
    : active;
  const positions = useRef<Partial<Record<GuestNavSection, number>>>({});
  const [layoutReady, setLayoutReady] = useState(false);
  const [positionRevision, setPositionRevision] = useState(0);
  const lensX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!layoutReady || !(selectedSection in positions.current)) return;
    const target = positions.current[selectedSection];
    if (target === undefined) return;
    const from = positions.current[previousGuestSection] ?? target;
    lensX.setValue(from);
    if (reduceMotion || from === target) lensX.setValue(target);
    else Animated.spring(lensX, { toValue: target, damping: 19, stiffness: 175, mass: 0.8, useNativeDriver: true }).start();
    previousGuestSection = selectedSection;
    return () => lensX.stopAnimation();
  }, [selectedSection, layoutReady, lensX, positionRevision, reduceMotion]);

  return (
    <FloatingActionBar variant="regular">
      <View style={[styles.row, { flexDirection: dir.row }]} accessibilityRole="tablist">
        <Animated.View pointerEvents="none" testID="dock-glass-lens"
          style={[styles.lens, { opacity: layoutReady && selectedSection in positions.current ? 1 : 0, transform: [{ translateX: lensX }] }]}>
          <Glass variant="regular" radius={20} style={styles.lensGlass} />
        </Animated.View>
        {items.map((item) => {
          const selected = selectedSection === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => router.replace(item.route)}
              onLayout={({ nativeEvent }) => {
                const { x, width } = nativeEvent.layout;
                const next = x + (width - 68) / 2;
                if (positions.current[item.id] === next) return;
                positions.current[item.id] = next;
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
  label: { fontSize: 10, lineHeight: 13 },
  lens: { position: 'absolute', start: 0, top: 1, width: 68, height: 60 },
  lensGlass: { width: 68, height: 60 },
});
