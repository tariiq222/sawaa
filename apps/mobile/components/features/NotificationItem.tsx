import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import {
  Calendar,
  CalendarX,
  Bell,
  CreditCard,
  Star,
  AlertTriangle,
  LucideIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { colors as sharedColors } from '@deqah/shared/tokens';

import { ThemedText } from '@/theme/components/ThemedText';
import { useTheme } from '@/theme/useTheme';
import type { Notification } from '@/types/models';

interface NotificationItemProps {
  notification: Notification;
  onPress: (id: string) => void;
  language: 'ar' | 'en';
}

interface TypeConfig {
  icon: LucideIcon;
  color: string;
}

const TYPE_MAP: Partial<Record<Notification['type'], TypeConfig>> = {
  booking_confirmed: { icon: Calendar, color: '#059669' },
  booking_cancelled: { icon: CalendarX, color: '#DC2626' },
  reminder: { icon: Bell, color: '#F59E0B' },
  payment_received: { icon: CreditCard, color: '#1D4ED8' },
  new_rating: { icon: Star, color: '#7C3AED' },
  problem_report: { icon: AlertTriangle, color: '#DC2626' },
};

const DEFAULT_TYPE_CONFIG: TypeConfig = { icon: Bell, color: sharedColors.textSecondary };

function getRelativeTime(
  dateStr: string,
  t: (key: string, opts?: Record<string, number>) => string,
): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.max(1, Math.floor(diff / 60_000));
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 60) return t('notifications.minutesAgo', { count: mins });
  if (hours < 24) return t('notifications.hoursAgo', { count: hours });
  return t('notifications.daysAgo', { count: days });
}

export function NotificationItem({
  notification,
  onPress,
  language,
}: NotificationItemProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const config = TYPE_MAP[notification.type] ?? DEFAULT_TYPE_CONFIG;
  const Icon = config.icon;

  const title =
    language === 'ar' ? notification.titleAr : notification.titleEn;
  const body =
    language === 'ar' ? notification.bodyAr : notification.bodyEn;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(notification.id);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: notification.isRead
            ? theme.colors.surface
            : theme.colors.white,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View
        style={[styles.iconCircle, { backgroundColor: `${config.color}14` }]}
      >
        <Icon size={20} strokeWidth={1.5} color={config.color} />
      </View>

      <View style={styles.content}>
        <ThemedText variant="subheading" numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText variant="bodySm" numberOfLines={2}>
          {body}
        </ThemedText>
        <ThemedText
          variant="caption"
          color={theme.colors.textSecondary}
          style={styles.time}
        >
          {getRelativeTime(notification.createdAt, t)}
        </ThemedText>
      </View>

      {!notification.isRead && (
        <View style={styles.unreadDot} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  time: {
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1D4ED8',
    marginTop: 8,
  },
});
