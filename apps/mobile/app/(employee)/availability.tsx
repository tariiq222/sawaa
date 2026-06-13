import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Switch, StyleSheet, Alert, Pressable, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import {
  AquaBackground,
  GlassSurface,
  PrimaryButton,
  sawaaColors,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
  withAlpha,
} from '@/theme/sawaa';
import { FloatingActionBar } from '@/components/ui/FloatingActionBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { useAppSelector } from '@/hooks/use-redux';
import { employeesService } from '@/services/employees';
import type { EmployeeAvailability } from '@/services/employees';

type DaySchedule = EmployeeAvailability;

const DEFAULT_SCHEDULE: DaySchedule[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i,
  isWorking: i >= 0 && i <= 4,
  startTime: '08:00',
  endTime: '17:00',
}));

export default function AvailabilityScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const user = useAppSelector((state) => state.auth.user);
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;

  useEffect(() => {
    const pid = user?.employeeId;
    if (!pid) {
      setLoading(false);
      return;
    }
    employeesService.getAvailabilitySchedule(pid).then((res) => {
      const data = res.data;
      if (res.success && Array.isArray(data) && data.length > 0) {
        setSchedule(
          DEFAULT_SCHEDULE.map((def) => {
            const found = data.find((d) => d.dayOfWeek === def.dayOfWeek);
            return found ?? def;
          }),
        );
      }
      setLoading(false);
    });
  }, [user?.employeeId]);

  const toggleDay = useCallback((dayIndex: number) => {
    setSchedule((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayIndex ? { ...d, isWorking: !d.isWorking } : d,
      ),
    );
  }, []);

  const handleSave = async () => {
    const pid = user?.employeeId;
    if (!pid) return;
    setSaving(true);
    try {
      const res = await employeesService.updateAvailabilitySchedule(
        pid,
        schedule.filter((d) => d.isWorking),
      );
      if (res.success) {
        Alert.alert(t('common.saved'), t('availability.saveSuccess'));
        router.back();
      } else {
        Alert.alert(t('common.error'), t('availability.saveError'));
      }
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
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <GlassSurface variant="base" radius={sawaaRadius.pill} style={styles.backCircle}>
            <View style={styles.backInner}>
              <BackIcon size={22} strokeWidth={1.5} color={sawaaColors.ink[900]} />
            </View>
          </GlassSurface>
        </Pressable>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {t('availability.title')}
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
                <GlassSurface variant="base" radius={sawaaRadius.lg} padding={sawaaSpacing.lg}>
                  <View style={[styles.dayRow, { flexDirection: dir.row }]}>
                    <Text
                      style={[styles.dayLabel, { fontFamily: f600, fontWeight: '600', textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
                    >
                      {t(`days.${day.dayOfWeek}`)}
                    </Text>
                    {day.isWorking && (
                      <View style={[styles.timeChip, { backgroundColor: withAlpha(sawaaColors.teal[600], 0.1) }]}>
                        <Text style={[styles.timeChipText, { fontFamily: f600, fontWeight: '600' }]}>
                          {day.startTime} - {day.endTime}
                        </Text>
                      </View>
                    )}
                    <Switch
                      value={day.isWorking}
                      onValueChange={() => toggleDay(day.dayOfWeek)}
                      trackColor={{ true: sawaaColors.teal[500] }}
                      accessibilityLabel={t(`days.${day.dayOfWeek}`)}
                    />
                  </View>
                </GlassSurface>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      {!loading && (
        <FloatingActionBar>
          <PrimaryButton
            label={t('availability.save')}
            onPress={handleSave}
            disabled={saving}
            fontFamily={f600}
            style={styles.saveBtn}
          />
        </FloatingActionBar>
      )}
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg },
  backBtn: { alignSelf: 'flex-start', marginBottom: sawaaSpacing.sm },
  backCircle: { width: 44, height: 44 },
  backInner: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: sawaaColors.ink[900],
    marginBottom: sawaaSpacing.xl,
  },
  skeletonList: { gap: sawaaSpacing.sm },
  dayList: { gap: sawaaSpacing.sm },
  dayRow: { alignItems: 'center', gap: sawaaSpacing.md },
  dayLabel: {
    flex: 1,
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.ink[900],
  },
  timeChip: {
    borderRadius: sawaaRadius.pill,
    paddingHorizontal: sawaaSpacing.sm,
    paddingVertical: sawaaSpacing.xs,
  },
  timeChipText: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: sawaaColors.teal[700],
  },
  saveBtn: { flex: 1 },
});
