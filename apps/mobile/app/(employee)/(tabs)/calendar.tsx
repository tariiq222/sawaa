import { useState, useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { View, FlatList, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar as RNCalendar } from 'react-native-calendars';
import { router } from 'expo-router';

import {
  AquaBackground,
  GlassSurface,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
} from '@/theme/sawaa';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { useEmployeeDayBookings } from '@/hooks/queries/useEmployeeDayBookings';
import { getStatusLabel } from '@/lib/status-helpers';

export default function CalendarScreen() {
  const { theme } = useTheme();
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0],
  );

  const { data: dayBookings = [], isLoading, isError, refetch } = useEmployeeDayBookings(selectedDate);

  const dayTitle = new Date(selectedDate).toLocaleDateString(dir.isRTL ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <AquaBackground>
      <View style={[styles.container, { paddingTop: insets.top + sawaaSpacing.lg }]}>
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {t('employee.calendar')}
          </Text>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(100).duration(600).easing(Easing.out(Easing.cubic))}>
          <GlassSurface variant="strong" radius={sawaaRadius.xl} padding={sawaaSpacing.sm} style={styles.calCard}>
            <RNCalendar
              key={theme.colors.surface}
              onDayPress={(day: { dateString: string }) => setSelectedDate(day.dateString)}
              markedDates={{
                [selectedDate]: {
                  selected: true,
                  selectedColor: theme.colors.primaryFill,
                  selectedTextColor: theme.colors.primaryForeground,
                },
              }}
              theme={{
                calendarBackground: 'transparent',
                todayTextColor: colors.teal[700],
                arrowColor: colors.teal[600],
                monthTextColor: colors.ink[900],
                dayTextColor: colors.ink[700],
                textSectionTitleColor: colors.ink[500],
                textDisabledColor: colors.ink[400],
                textDayFontFamily: f400,
                textMonthFontFamily: f700,
                textDayHeaderFontFamily: f600,
                textDayFontSize: sawaaType.body.fontSize,
                textMonthFontSize: sawaaType.subheading.fontSize,
                textDayHeaderFontSize: sawaaType.caption.fontSize,
              }}
            />
          </GlassSurface>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(180).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.dayTitle, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {dayTitle}
          </Text>
        </Animated.View>

        <FlatList
          data={isLoading || isError ? [] : dayBookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: sawaaSpacing.sm }} />}
          renderItem={({ item, index }) => (
            <Animated.View
              entering={reduceMotion ? undefined : FadeInDown.delay(240 + index * 70).duration(600).easing(Easing.out(Easing.cubic))}
            >
              <GlassSurface variant="base" radius={sawaaRadius.lg} padding={sawaaSpacing.md}>
                <View style={[styles.apptRow, { flexDirection: dir.row }]}>
                  <View style={[styles.timeCol, { flexDirection: dir.row }]}>
                    <Clock size={14} strokeWidth={1.5} color={colors.ink[400]} />
                    <Text style={[styles.timeText, { writingDirection: dir.writingDirection }]}>
                      {item.startTime}
                    </Text>
                  </View>
                  <View style={styles.apptMid}>
                    <Text
                      numberOfLines={1}
                      style={[styles.apptName, { fontFamily: f600, fontWeight: '600', textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
                    >
                      {item.client ? `${item.client.firstName} ${item.client.lastName}` : t('doctor.clientRecord')}
                    </Text>
                  </View>
                  <StatusPill status={item.status} label={t(getStatusLabel(item.status))} />
                </View>
              </GlassSurface>
            </Animated.View>
          )}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.skeletonList}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} height={56} radius={sawaaRadius.lg} />
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
        />

        <View style={styles.ctaWrap}>
          <Pressable
            onPress={() => router.push('/(employee)/availability')}
            accessibilityRole="button"
          >
            <GlassSurface variant="strong" radius={sawaaRadius.pill} padding={sawaaSpacing.md}>
              <Text style={[styles.ctaText, { fontFamily: f600, fontWeight: '600', writingDirection: dir.writingDirection }]}>
                {t('doctor.manageAvailability')}
              </Text>
            </GlassSurface>
          </Pressable>
        </View>
      </View>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  container: { flex: 1, paddingHorizontal: sawaaSpacing.lg },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: colors.ink[900],
    marginBottom: sawaaSpacing.lg,
  },
  calCard: { marginBottom: sawaaSpacing.lg },
  dayTitle: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    color: colors.ink[900],
    marginBottom: sawaaSpacing.md,
  },
  list: { paddingBottom: sawaaSpacing.xl },
  apptRow: { alignItems: 'center', gap: sawaaSpacing.md },
  timeCol: { alignItems: 'center', gap: sawaaSpacing.xs, minWidth: 60 },
  timeText: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[500],
  },
  apptMid: { flex: 1 },
  apptName: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[900],
  },
  skeletonList: { gap: sawaaSpacing.sm },
  ctaWrap: { paddingVertical: sawaaSpacing.md, paddingBottom: 100 },
  ctaText: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.teal[700],
    textAlign: 'center',
  },
});
