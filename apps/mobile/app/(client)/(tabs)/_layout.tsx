import React from 'react';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';

import { useDir } from '@/hooks/useDir';
import { tabIcons } from '@/theme/sawaa/tabIcons';
import { useTabBarStyle } from '@/theme/sawaa/useTabBarStyle';

export default function ClientTabsLayout() {
  const { t } = useTranslation();
  const dir = useDir();
  const tabBar = useTabBarStyle();

  const tabs = [
    <NativeTabs.Trigger key="home" name="home">
      <NativeTabs.Trigger.Icon src={tabIcons.house} renderingMode="template" />
      <NativeTabs.Trigger.Label>{t('tabs.home')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="appointments" name="appointments">
      <NativeTabs.Trigger.Icon src={tabIcons.calendar} renderingMode="template" />
      <NativeTabs.Trigger.Label>{t('tabs.myAppointments')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="explore" name="explore">
      <NativeTabs.Trigger.Icon src={tabIcons.grid} renderingMode="template" />
      <NativeTabs.Trigger.Label>{t('tabs.explore')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="account" name="account">
      <NativeTabs.Trigger.Icon src={tabIcons.account} renderingMode="template" />
      <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
  ];

  return <NativeTabs {...tabBar}>{dir.isRTL ? [...tabs].reverse() : tabs}</NativeTabs>;
}
