import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { StatusPill } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/theme/useTheme';
import type { Employee } from '@/types/models';

interface EmployeeCardProps {
  employee: Employee;
  onPress: (id: string) => void;
  onBook?: (id: string) => void;
  compact?: boolean;
}

export function EmployeeCard({
  employee,
  onPress,
  onBook,
  compact,
}: EmployeeCardProps) {
  const { t } = useTranslation();
  const { theme, isRTL } = useTheme();

  const name = `${employee.user.firstName} ${employee.user.lastName}`;
  const specialtyName = isRTL ? employee.specialtyAr : employee.specialty;

  if (compact) {
    return (
      <Pressable
        onPress={() => onPress(employee.id)}
        style={({ pressed }) => [
          styles.compactCard,
          {
            backgroundColor: theme.colors.white,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <View style={styles.compactHeader}>
          <Avatar
            size={36}
            name={name}
            imageUrl={employee.user.avatarUrl}
          />
          <View style={styles.compactInfo}>
            <ThemedText variant="bodySm" style={{ fontWeight: '600', color: theme.colors.textPrimary }}>
              {name}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textSecondary}>
              {specialtyName}
            </ThemedText>
          </View>
        </View>
        <View style={styles.compactFooter}>
          <View style={styles.ratingRow}>
            <Star size={12} fill="#F59E0B" color="#F59E0B" />
            <ThemedText variant="caption">{employee.averageRating}</ThemedText>
          </View>
          <ThemedText variant="caption" color="#1D4ED8" style={{ fontWeight: '700' }}>
            {t('home.from')} {employee.clinicPrice} {t('home.sar')}
          </ThemedText>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(employee.id)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.white,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.row}>
        <Avatar
          size={48}
          name={name}
          imageUrl={employee.user.avatarUrl}
        />
        <View style={styles.info}>
          <ThemedText variant="subheading" numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText variant="bodySm" numberOfLines={1}>
            {specialtyName}
          </ThemedText>
          <View style={styles.ratingRow}>
            <Star size={13} fill="#F59E0B" color="#F59E0B" />
            <ThemedText variant="bodySm">
              {employee.averageRating}
            </ThemedText>
            <ThemedText variant="caption" color={theme.colors.textMuted}>
              ({employee.totalRatings} {t('home.rating')})
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.priceRow}>
        <ThemedText variant="subheading" color="#1D4ED8">
          {employee.clinicPrice} {t('home.sar')}
        </ThemedText>
        <StatusPill
          status={employee.isAvailableToday ? 'available' : 'pending'}
          label={
            employee.isAvailableToday
              ? t('home.availableToday')
              : t('home.nextAvailable')
          }
        />
      </View>

      {onBook && (
        <ThemedButton
          onPress={() => onBook(employee.id)}
          variant="primary"
          size="sm"
          full
        >
          {t('home.bookAppointment')}
        </ThemedButton>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: 16, gap: 12 },
  compactCard: { borderRadius: 12, padding: 12, minWidth: 155, gap: 10 },
  row: { flexDirection: 'row', gap: 14 },
  info: { flex: 1, gap: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactInfo: { flex: 1, gap: 1 },
  compactFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
