import { useCallback, useEffect, useState, useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { View, ScrollView, StyleSheet, Alert, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Glass } from '@/theme/components/Glass';
import {
  AquaBackground,
  PrimaryButton,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
} from '@/theme/sawaa';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { Skeleton } from '@/components/ui/Skeleton';
import { GlassSwitch } from '@/components/ui/GlassSwitch';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { employeesService } from '@/services/employees';
import { toggleAvailabilityDay } from '@/services/employees';
import type { AvailabilityDayGroup, AvailabilityException, EmployeeAvailability } from '@/services/employees';

type DaySchedule = EmployeeAvailability;

type DayScheduleGroup = AvailabilityDayGroup;

const DEFAULT_SCHEDULE: DayScheduleGroup[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i,
  windows: i <= 4 ? [{ dayOfWeek: i, startTime: '08:00', endTime: '17:00', isActive: true }] : [],
}));

function groupSchedule(windows: DaySchedule[]): DayScheduleGroup[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    windows: windows.filter((window) => window.dayOfWeek === dayOfWeek),
  }));
}

export default function AvailabilityScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const [schedule, setSchedule] = useState<DayScheduleGroup[]>(DEFAULT_SCHEDULE);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);


  const toggleDay = useCallback((dayIndex: number) => {
    setSchedule((prev) => toggleAvailabilityDay(prev, dayIndex));
  }, []);

  useEffect(() => {
    employeesService.getAvailabilitySchedule().then((result) => {
      setSchedule(groupSchedule(result.windows));
      setExceptions(result.exceptions);
    }).catch(() => {
      setSchedule(groupSchedule([]));
      setLoadFailed(true);
      Alert.alert(t('common.error'), t('availability.saveError'));
    }).finally(() => setLoading(false));
  }, [t]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await employeesService.updateAvailabilitySchedule({
        windows: schedule.flatMap((day) => day.windows),
        exceptions,
      });
      Alert.alert(t('common.saved'), t('availability.saveSuccess'));
      router.back();
    } catch {
      Alert.alert(t('common.error'), t('availability.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AquaBackground>
      <Stack.Screen options={{ title: t('availability.title') }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={t('availability.hours')} onBack={() => router.back()} />

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.subtitle, { fontFamily: f400, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {t('availability.subtitle')}
          </Text>
        </Animated.View>

        {loading ? (
          <View style={styles.skeletonList}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} height={60} radius={sawaaRadius.lg} />
            ))}
          </View>
        ) : (
          <View style={styles.dayList}>
            {schedule.map((day, index) => (
              <Animated.View
                key={day.dayOfWeek}
                entering={reduceMotion ? undefined : FadeInDown.delay(120 + index * 60).duration(600).easing(Easing.out(Easing.cubic))}
              >
                <Glass variant="base" radius={sawaaRadius.lg} padding={sawaaSpacing.lg}>
                  <View style={[styles.dayRow, { flexDirection: dir.row }]}>
                    <Text
                      style={[styles.dayLabel, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
                    >
                      {t(`days.${day.dayOfWeek}`)}
                    </Text>
                    <GlassSwitch
                      value={day.windows.some((window) => window.isActive !== false)}
                      onValueChange={() => toggleDay(day.dayOfWeek)}
                      accessibilityLabel={t(`days.${day.dayOfWeek}`)}
                    />
                  </View>
                  {day.windows.some((window) => window.isActive !== false) ? (
                    <View style={styles.windows}>
                      {day.windows.filter((window) => window.isActive !== false).map((window) => (
                        <View key={`${window.startTime}-${window.endTime}`} style={[styles.windowRow, { flexDirection: dir.row }]}>
                          <View style={[styles.timeBox, { borderColor: colors.teal[700] }]}>
                            <Text style={[styles.timeText, { fontFamily: f600 }]}>{window.startTime}</Text>
                          </View>
                          <Text style={[styles.toText, { fontFamily: f400 }]}>{t('availability.to')}</Text>
                          <View style={[styles.timeBox, { borderColor: colors.teal[700] }]}>
                            <Text style={[styles.timeText, { fontFamily: f600 }]}>{window.endTime}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.offText, { fontFamily: f400, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                      {t('doctor.dayOff')}
                    </Text>
                  )}
                </Glass>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      {!loading && !loadFailed && (
        <FloatingCta>
          <PrimaryButton
            label={t('availability.save')}
            onPress={handleSave}
            disabled={saving}
            fontFamily={f600}
          />
        </FloatingCta>
      )}
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  subtitle: {
    fontSize: sawaaType.body.fontSize + 1,
    lineHeight: sawaaType.body.lineHeight + 4,
    color: colors.ink[700],
  },
  skeletonList: { gap: sawaaSpacing.sm },
  dayList: { gap: sawaaSpacing.sm },
  dayRow: { alignItems: 'center', justifyContent: 'space-between', gap: sawaaSpacing.md, minHeight: 44 },
  dayLabel: {
    flex: 1,
    fontSize: sawaaType.subheading.fontSize - 2,
    lineHeight: sawaaType.subheading.lineHeight,
    color: colors.ink[900],
  },
  windows: { gap: sawaaSpacing.sm, marginTop: sawaaSpacing.sm },
  windowRow: { alignItems: 'center', gap: sawaaSpacing.md },
  timeBox: {
    minWidth: 84,
    minHeight: 44,
    borderRadius: sawaaRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sawaaSpacing.md,
  },
  timeText: {
    fontSize: sawaaType.body.fontSize + 1,
    lineHeight: sawaaType.body.lineHeight + 2,
    color: colors.teal[700],
  },
  toText: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[700],
  },
  offText: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[700],
    marginTop: sawaaSpacing.xs,
  },
});
