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
    <NativeTabs.Trigger key="home" name="home">
      <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      <NativeTabs.Trigger.Label>{t('tabs.home')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="records" name="records">
      <NativeTabs.Trigger.Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} md="description" />
      <NativeTabs.Trigger.Label>{t('tabs.records')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="appointments" name="appointments">
      <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      <NativeTabs.Trigger.Label>{t('tabs.sessions')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
  ];

  return (
    <NativeTabs labelStyle={{ fontFamily: getFontName(dir.locale, '500') }} minimizeBehavior="onScrollDown" tintColor={colors.teal[600]}>
      {dir.isRTL ? [...tabs].reverse() : tabs}
    </NativeTabs>
  );
}
