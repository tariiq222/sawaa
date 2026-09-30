import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';

import { useDir } from '@/hooks/useDir';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export default function ClientTabsLayout() {
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();

  const tabs = [
    <NativeTabs.Trigger key="home" name="home">
      <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      <NativeTabs.Trigger.Label>{t('tabs.home')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="appointments" name="appointments">
      <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      <NativeTabs.Trigger.Label>{t('tabs.myAppointments')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="explore" name="explore">
      <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="explore" />
      <NativeTabs.Trigger.Label>{t('tabs.explore')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="account" name="account">
      <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
  ];

  return <NativeTabs tintColor={colors.teal[600]}>{dir.isRTL ? [...tabs].reverse() : tabs}</NativeTabs>;
}
