import React from 'react';
import { useDir } from '@/hooks/useDir';
import { useTranslation } from 'react-i18next';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { tabIcons } from '@/theme/sawaa/tabIcons';
import { useTabBarStyle } from '@/theme/sawaa/useTabBarStyle';

export default function EmployeeTabsLayout() {
  const { t } = useTranslation();
  const dir = useDir();
  const tabBar = useTabBarStyle();

  const tabs = [
    <NativeTabs.Trigger key="today" name="today">
      <NativeTabs.Trigger.Icon src={tabIcons.sun} renderingMode="template" />
      <NativeTabs.Trigger.Label>{t('tabs.today')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="calendar" name="calendar">
      <NativeTabs.Trigger.Icon src={tabIcons.calendar} renderingMode="template" />
      <NativeTabs.Trigger.Label>{t('tabs.calendar')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="clients" name="clients">
      <NativeTabs.Trigger.Icon src={tabIcons.users} renderingMode="template" />
      <NativeTabs.Trigger.Label>{t('tabs.clients')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
    <NativeTabs.Trigger key="profile" name="profile">
      <NativeTabs.Trigger.Icon src={tabIcons.account} renderingMode="template" />
      <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>,
  ];

  return (
    <NativeTabs minimizeBehavior="onScrollDown" {...tabBar}>
      {dir.isRTL ? [...tabs].reverse() : tabs}
    </NativeTabs>
  );
}
