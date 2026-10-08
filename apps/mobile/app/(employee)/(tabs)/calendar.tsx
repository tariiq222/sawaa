import { useState, useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { View, FlatList, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import {
  AquaBackground,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
} from '@/theme/sawaa';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmployeeAppointmentCard } from '@/components/features/employee/EmployeeAppointmentCard';
import { OutlineButton } from '@/components/features/employee/OutlineButton';
import { WeekStrip } from '@/components/features/employee/WeekStrip';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { useEmployeeDayBookings } from '@/hooks/queries/useEmployeeDayBookings';
import { fromDateKey, shiftDateKey, toDateKey } from '@/lib/employee-schedule';

export default function CalendarScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const f700 = getFontName(dir.locale, '700');

  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));

  const { data: dayBookings = [], isLoading, isError, refetch } = useEmployeeDayBookings(selectedDate);

  const dayTitle = fromDateKey(selectedDate).toLocaleDateString(dir.isRTL ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const header = (
    <View style={styles.header}>
      <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
        >
          {t('employee.calendar')}
        </Text>
      </Animated.View>

      <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(100).duration(600).easing(Easing.out(Easing.cubic))}>
        <WeekStrip
          selectedKey={selectedDate}
          onSelect={setSelectedDate}
          onShiftWeek={(direction) => setSelectedDate((key) => shiftDateKey(key, direction * 7))}
        />
      </Animated.View>

      <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(180).duration(600).easing(Easing.out(Easing.cubic))}>
        <SectionHeader title={dayTitle} />
      </Animated.View>
    </View>
  );

  return (
    <AquaBackground>
      <FlatList
        data={isLoading || isError ? [] : dayBookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + sawaaSpacing.lg }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={{ height: sawaaSpacing.sm }} />}
        renderItem={({ item, index }) => (
          <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.delay(240 + Math.min(index, 6) * 70).duration(600).easing(Easing.out(Easing.cubic))}
          >
            <EmployeeAppointmentCard
              booking={item}
              labelPrefix={dayTitle}
              onPress={() => router.push(`/(employee)/appointment/${item.id}`)}
            />
          </Animated.View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.skeletonList}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={76} radius={sawaaRadius.lg} />
              ))}
            </View>
          ) : isError ? (
            <EmptyState
              icon="alert-circle-outline"
              title={t('common.error')}
              actionLabel={t('common.retry')}
              onAction={() => { void refetch(); }}
              tone="danger"
            />
          ) : (
            <EmptyState
              icon="calendar-clear-outline"
              title={t('common.noResults')}
            />
          )
        }
        ListFooterComponent={
          <View style={styles.cta}>
            <OutlineButton
              label={t('availability.manage')}
              onPress={() => router.push('/(employee)/availability')}
              icon={<Clock size={20} color={colors.teal[700]} strokeWidth={1.75} />}
            />
          </View>
        }
      />
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  list: { paddingHorizontal: sawaaSpacing.lg, paddingBottom: 140 },
  header: { gap: sawaaSpacing.lg, marginBottom: sawaaSpacing.md },
  title: {
    fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight,
    color: colors.ink[900],
  },
  skeletonList: { gap: sawaaSpacing.sm },
  cta: { marginTop: sawaaSpacing.xl },
});
