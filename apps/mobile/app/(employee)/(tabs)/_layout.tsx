import React from 'react';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useTranslation } from 'react-i18next';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export default function EmployeeTabsLayout() {
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();

  const tabs = [
    <NativeTabs.Trigger key="today" name="today">
      <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} md="today" />
      <NativeTabs.Trigger.Label>{t('tabs.today')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="calendar" name="calendar">
      <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      <NativeTabs.Trigger.Label>{t('tabs.calendar')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="clients" name="clients">
      <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
      <NativeTabs.Trigger.Label>{t('tabs.clients')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="profile" name="profile">
      <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="person" />
      <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
  ];

  return (
    <NativeTabs labelStyle={{ fontFamily: getFontName(dir.locale, '500') }} minimizeBehavior="onScrollDown" tintColor={colors.teal[600]}>
      {dir.isRTL ? [...tabs].reverse() : tabs}
    </NativeTabs>
  );
}
