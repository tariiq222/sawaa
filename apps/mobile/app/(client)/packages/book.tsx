import React, { useEffect, useMemo, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AquaBackground, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { useBookPackageCredit, usePublicBranches, useSlots } from '@/hooks/queries';
import { getFontName } from '@/theme/fonts';
import { PackageBranchPicker } from '@/components/features/packages/PackageBranchPicker';
import { PackageBookingAction } from '@/components/features/packages/PackageBookingAction';
import { DaySelector } from '@/components/features/booking/DaySelector';
import { TimeSlotsGrid, type Slot } from '@/components/features/booking/TimeSlotsGrid';
import type { DeliveryType } from '@/types/booking-enums';
import { BackButton } from '@/components/ui/BackButton';

function dateOnly(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export default function PackageBookScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    creditId?: string;
    serviceId?: string;
    employeeId?: string;
    durationOptionId?: string;
    durationMins?: string;
    deliveryType?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const { t } = useTranslation();
  const book = useBookPackageCredit();
  const branchQuery = usePublicBranches();
  const branches = branchQuery.data ?? [];
  const [branchId, setBranchId] = useState<string>();
  const branchLoading = branchQuery.isFetching;
  const branchError = branchQuery.isError;
  const [dayIdx, setDayIdx] = useState(0);
  const [selection, setSelection] = useState<{ slot: Slot; branchId?: string; date: string } | null>(null);
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const days = useMemo(() => Array.from({ length: 30 }, (_, index) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + index);
    return day;
  }), []);
  const deliveryType: DeliveryType = params.deliveryType === 'ONLINE' ? 'online' : 'in_person';
  const slotsQuery = useSlots({
    employeeId: params.employeeId,
    branchId,
    date: dateOnly(days[dayIdx]),
    serviceId: params.serviceId,
    durationOptionId: params.durationOptionId,
    durationMins: params.durationMins ? Number(params.durationMins) : undefined,
    deliveryType,
  });

  useEffect(() => {
    const loaded = branchQuery.data;
    if (!loaded) return;
    setBranchId((current) => current && loaded.some((branch) => branch.id === current)
      ? current : loaded[0]?.id);
  }, [branchQuery.data]);

  const slots = (slotsQuery.data ?? []) as Slot[];
  const selectedDate = dateOnly(days[dayIdx]);
  const slotIdx = selection?.branchId === branchId && selection?.date === selectedDate
    ? slots.findIndex((slot) => slot.startTime === selection.slot.startTime && slot.endTime === selection.slot.endTime)
    : -1;
  const selectedSlot = slotIdx < 0 ? undefined : slots[slotIdx];

  useEffect(() => {
    if (selection && !slotsQuery.isLoading && !slotsQuery.isError && !selectedSlot) setSelection(null);
  }, [selection, selectedSlot, slotsQuery.isLoading, slotsQuery.isError]);
  const handleBook = async () => {
    if (!params.creditId || !branchId || !selectedSlot || slotsQuery.isError || book.isPending) return;
    try {
      await book.mutateAsync({
        creditId: params.creditId,
        branchId,
        scheduledAt: selectedSlot.startTime,
        ...(params.serviceId ? { serviceId: params.serviceId } : {}),
        ...(params.employeeId ? { employeeId: params.employeeId } : {}),
        ...(params.durationOptionId ? { durationOptionId: params.durationOptionId } : {}),
        deliveryType: deliveryType === 'online' ? 'ONLINE' : 'IN_PERSON',
      });
      Alert.alert(t('packages.bookingSuccess'), t('packages.bookingSuccessDescription'), [
        { text: t('packages.backToBalance'), onPress: () => router.replace('/(client)/packages/purchases') },
      ]);
    } catch {
      Alert.alert(t('packages.errorTitle'), t('packages.bookingError'));
    }
  };

  return (
    <AquaBackground>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + sawaaSpacing.lg, paddingBottom: 140 }]}>
        <View style={[styles.header, { flexDirection: dir.row }]}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>{t('packages.bookTitle')}</Text>
        </View>
        <Text style={[styles.subtitle, { fontFamily: f400, textAlign: dir.textAlign }]}>{t('packages.bookSubtitle')}</Text>
        {!params.employeeId || !params.serviceId ? (
          <Text style={[styles.warning, { fontFamily: f400, textAlign: dir.textAlign }]}>{t('packages.locked.support')}</Text>
        ) : (
          <>
            <DaySelector days={days} dayIdx={dayIdx} onSelect={(index) => { setDayIdx(index); setSelection(null); }} dir={dir} f500={f600} f700={f700} />
            <PackageBranchPicker
              branches={branches}
              branchId={branchId}
              loading={branchLoading}
              error={branchError}
              onSelect={(id) => { setBranchId(id); setSelection(null); }}
              onRetry={() => { void branchQuery.refetch(); }}
              dir={dir}
              f400={f400}
              f600={f600}
              f700={f700}
            />
            <Text style={[styles.section, { fontFamily: f700, textAlign: dir.textAlign }]}>{t('packages.chooseTime')}</Text>
            <TimeSlotsGrid
              loading={slotsQuery.isLoading}
              error={slotsQuery.isError ? t('packages.slotsError') : null}
              slots={slots}
              selectedIdx={slotIdx < 0 ? null : slotIdx}
              onSelect={(index) => { setSelection({ slot: slots[index], branchId, date: selectedDate }); }}
              dir={dir}
              f500={f600}
              f600={f600}
              reduceMotion={reduceMotion}
              onRetry={() => { void slotsQuery.refetch(); }}
            />
            <PackageBookingAction enabled={Boolean(selectedSlot && branchId && !slotsQuery.isError)} pending={book.isPending} onPress={handleBook} fontFamily={f700} />
          </>
        )}
      </ScrollView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.md },
  header: { alignItems: 'center', gap: sawaaSpacing.md },
  title: { flex: 1, color: colors.ink[900], fontSize: sawaaType.heading.fontSize },
  subtitle: { color: colors.ink[500], fontSize: sawaaType.body.fontSize },
  section: { color: colors.ink[900], fontSize: sawaaType.subheading.fontSize, marginTop: sawaaSpacing.md },
  warning: { color: colors.accent.amber, fontSize: sawaaType.body.fontSize },
});
