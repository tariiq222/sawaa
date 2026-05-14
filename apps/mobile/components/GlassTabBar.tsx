import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';

import { Glass } from '@/theme';
import { sawaaTokens, sawaaColors } from '@/theme/sawaa/tokens';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

type IconMap = Record<string, LucideIcon>;

type GlassTabBarProps = BottomTabBarProps & {
  icons: IconMap;
  badges?: Record<string, number | undefined>;
};

export function GlassTabBar({ state, descriptors, navigation, icons, badges }: GlassTabBarProps) {
  const dir = useDir();
  const insets = useSafeAreaInsets();

  return (
    <Glass
      variant="strong"
      radius={sawaaTokens.radius.pill}
      style={[
        styles.tabBar,
        { bottom: insets.bottom + 14, left: 14, right: 14 },
      ]}
    >
      <View style={[styles.tabBarInner, { flexDirection: dir.row }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TabItem
              key={route.key}
              label={label}
              Icon={icons[route.name]}
              focused={isFocused}
              onPress={onPress}
              badge={badges?.[route.name]}
            />
          );
        })}
      </View>
    </Glass>
  );
}

function TabItem({
  label,
  Icon,
  focused,
  onPress,
  badge,
}: {
  label: string;
  Icon?: LucideIcon;
  focused: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const dir = useDir();
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const color = focused ? sawaaColors.teal[700] : sawaaColors.ink[700];
  const hasBadge = !!badge && badge > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.tabItem}
    >
      <View style={styles.tabItemInner}>
        {focused ? <View style={styles.activePill} pointerEvents="none" /> : null}
        <View style={styles.iconRow}>
          {Icon ? <Icon size={22} color={color} strokeWidth={1.7} /> : null}
          {hasBadge ? <View style={styles.badgeDot} /> : null}
        </View>
        <Text
          style={[
            styles.label,
            { fontFamily: focused ? f700 : f600, color },
            { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tabBarInner: {
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tabItemInner: {
    alignItems: 'center',
    gap: 3,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    left: -10,
    right: -10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  iconRow: {
    width: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 10.5 },
  badgeDot: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: sawaaColors.accent.coral,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
});
