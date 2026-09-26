import React from 'react';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useTranslation } from 'react-i18next';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export default function ClientTabsLayout() {
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();

  const tabs = [
    <NativeTabs.Trigger key="home" name="home" unstable_nativeProps={{ tabBarItemAccessibilityLabel: t('tabs.home') }}>
      <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      <NativeTabs.Trigger.Label hidden>{t('tabs.home')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="explore" name="explore" unstable_nativeProps={{ tabBarItemAccessibilityLabel: t('tabs.explore') }}>
      <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="explore" />
      <NativeTabs.Trigger.Label hidden>{t('tabs.explore')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="appointments" name="appointments" unstable_nativeProps={{ tabBarItemAccessibilityLabel: t('tabs.myAppointments') }}>
      <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md="calendar_month" />
      <NativeTabs.Trigger.Label hidden>{t('tabs.myAppointments')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="account" name="account" unstable_nativeProps={{ tabBarItemAccessibilityLabel: t('tabs.profile') }}>
      <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      <NativeTabs.Trigger.Label hidden>{t('tabs.profile')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
  ];

  return (
    <NativeTabs labelStyle={{ fontFamily: getFontName(dir.locale, '500') }} minimizeBehavior="onScrollDown" tintColor={colors.teal[600]}>
      {dir.isRTL ? [...tabs].reverse() : tabs}
    </NativeTabs>
  );
}
