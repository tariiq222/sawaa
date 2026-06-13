import { useState } from 'react';
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
  sawaaColors,
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

  const { data: dayBookings = [], isLoading } = useEmployeeDayBookings(selectedDate);

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
              onDayPress={(day: { dateString: string }) => setSelectedDate(day.dateString)}
              markedDates={{
                [selectedDate]: {
                  selected: true,
                  selectedColor: sawaaColors.teal[600],
                },
              }}
              theme={{
                calendarBackground: 'transparent',
                todayTextColor: sawaaColors.teal[700],
                arrowColor: sawaaColors.teal[600],
                monthTextColor: sawaaColors.ink[900],
                dayTextColor: sawaaColors.ink[700],
                textSectionTitleColor: sawaaColors.ink[500],
                textDisabledColor: sawaaColors.ink[400],
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
          data={isLoading ? [] : dayBookings}
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
                    <Clock size={14} strokeWidth={1.5} color={sawaaColors.ink[400]} />
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
            ) : (
              <EmptyState
                icon="calendar-clear-outline"
                title={t('doctor.noAppointmentsToday')}
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

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: sawaaSpacing.lg },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: sawaaColors.ink[900],
    marginBottom: sawaaSpacing.lg,
  },
  calCard: { marginBottom: sawaaSpacing.lg },
  dayTitle: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    color: sawaaColors.ink[900],
    marginBottom: sawaaSpacing.md,
  },
  list: { paddingBottom: sawaaSpacing.xl },
  apptRow: { alignItems: 'center', gap: sawaaSpacing.md },
  timeCol: { alignItems: 'center', gap: sawaaSpacing.xs, minWidth: 60 },
  timeText: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: sawaaColors.ink[500],
  },
  apptMid: { flex: 1 },
  apptName: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.ink[900],
  },
  skeletonList: { gap: sawaaSpacing.sm },
  ctaWrap: { paddingVertical: sawaaSpacing.md, paddingBottom: 100 },
  ctaText: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.teal[700],
    textAlign: 'center',
  },
});
