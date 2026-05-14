import { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Switch,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { useTheme } from '@/theme/useTheme';
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
  const { theme } = useTheme();
  const user = useAppSelector((state) => state.auth.user);
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Stack.Screen options={{ title: t('availability.title') }} />
        <ActivityIndicator
          style={styles.loader}
          size="large"
          color={theme.colors.primary}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Stack.Screen options={{ title: t('availability.title') }} />
      <ScrollView contentContainerStyle={styles.content}>
        {schedule.map((day) => (
          <View
            key={day.dayOfWeek}
            style={[styles.row, { borderBottomColor: theme.colors.border }]}
          >
            <ThemedText style={styles.dayLabel}>
              {t(`days.${day.dayOfWeek}`)}
            </ThemedText>
            <Switch
              value={day.isWorking}
              onValueChange={() => toggleDay(day.dayOfWeek)}
              trackColor={{ true: theme.colors.primary }}
            />
            {day.isWorking && (
              <ThemedText style={styles.timeLabel}>
                {day.startTime} - {day.endTime}
              </ThemedText>
            )}
          </View>
        ))}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
        <ThemedButton
          onPress={handleSave}
          loading={saving}
          variant="primary"
          size="lg"
          full
        >
          {t('availability.save')}
        </ThemedButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1 },
  content: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayLabel: { flex: 1, fontSize: 16 },
  timeLabel: { fontSize: 14, marginStart: 12 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
});
