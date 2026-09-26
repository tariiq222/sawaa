import React from 'react';
import { Tabs } from 'expo-router';
import { CalendarDays, CircleUserRound, House, LayoutGrid } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppIcon } from '@/components/ui/AppIcon';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export default function ClientTabsLayout() {
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const insets = useSafeAreaInsets();

  const tabs = [
    <Tabs.Screen key="home" name="home" options={{
      title: t('tabs.home'), tabBarAccessibilityLabel: t('tabs.home'),
      tabBarIcon: ({ color, focused }) => <AppIcon sf={focused ? 'house.fill' : 'house'} fallback={House} size={19} color={color} />,
    }} />,
    <Tabs.Screen key="explore" name="explore" options={{
      title: t('tabs.explore'), tabBarAccessibilityLabel: t('tabs.explore'),
      tabBarIcon: ({ color, focused }) => <AppIcon sf={focused ? 'square.grid.2x2.fill' : 'square.grid.2x2'} fallback={LayoutGrid} size={19} color={color} />,
    }} />,
    <Tabs.Screen key="appointments" name="appointments" options={{
      title: t('tabs.myAppointments'), tabBarAccessibilityLabel: t('tabs.myAppointments'),
      tabBarIcon: ({ color }) => <AppIcon sf="calendar" fallback={CalendarDays} size={19} color={color} />,
    }} />,
    <Tabs.Screen key="account" name="account" options={{
      title: t('tabs.profile'), tabBarAccessibilityLabel: t('tabs.profile'),
      tabBarIcon: ({ color, focused }) => <AppIcon sf={focused ? 'person.crop.circle.fill' : 'person.crop.circle'} fallback={CircleUserRound} size={19} color={color} />,
    }} />,
  ];

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.teal[700],
      tabBarInactiveTintColor: colors.ink[700],
      tabBarActiveBackgroundColor: colors.teal[100],
      tabBarLabelStyle: { fontFamily: getFontName(dir.locale, '500'), fontSize: 10, lineHeight: 14 },
      tabBarItemStyle: { borderRadius: 25, marginVertical: 4 },
      tabBarStyle: {
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: insets.bottom + 8,
        height: 62,
        borderRadius: 31,
        borderTopWidth: 0,
        borderWidth: 1,
        borderColor: colors.glass.border,
        backgroundColor: colors.teal[50],
        overflow: 'hidden',
        shadowColor: colors.ink[900],
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      },
    }}>
      {dir.isRTL ? [...tabs].reverse() : tabs}
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="records" options={{ href: null }} />
    </Tabs>
  );
}
