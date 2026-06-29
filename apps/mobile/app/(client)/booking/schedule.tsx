import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { AquaBackground, sawaaColors, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { publicEmployeesService } from '@/services/client/employees';
import { branchesService } from '@/services/branches';
import { DaySelector } from '@/components/features/booking/DaySelector';
import { TimeSlotsGrid, type Slot } from '@/components/features/booking/TimeSlotsGrid';
import { BookingCta } from '@/components/features/booking/BookingCta';
import { useReduceMotion } from '@/hooks/useA11y';
import type { DeliveryType } from '@/types/booking-enums';

function toLocalDateOnly(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function BookingScheduleScreen() {
  const params = useLocalSearchParams<{
    serviceId?: string;
    employeeId?: string;
    branchId?: string;
    deliveryType?: DeliveryType;
    durationMins?: string;
    durationOptionId?: string;
    chargedPrice?: string;
    currency?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const days = useMemo(() => {
    const out: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);

  const [dayIdx, setDayIdx] = useState(0);
  const [branchId, setBranchId] = useState<string | null>(params.branchId ?? null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotIdx, setSlotIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const tzLabel = dir.isRTL ? 'بتوقيتك المحلي' : `Your local time`;

  useEffect(() => {
    if (branchId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await branchesService.getAll();
        if (cancelled) return;
        const main = list.find((b) => b.isMain) ?? list[0];
        if (main) setBranchId(main.id);
        else setError(dir.isRTL ? 'لا توجد فروع متاحة' : 'No branches available');
      } catch {
        if (!cancelled) setError(dir.isRTL ? 'تعذّر تحميل الفرع' : 'Failed to load branch');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId, dir.isRTL, reloadKey]);

  useEffect(() => {
    const employeeId = params.employeeId;
    if (!employeeId || !branchId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSlotIdx(null);
    (async () => {
      try {
        const selectedDeliveryType = params.deliveryType ?? 'in_person';
        const data = await publicEmployeesService.getSlots({
          employeeId,
          branchId,
          date: toLocalDateOnly(days[dayIdx]),
          serviceId: params.serviceId,
          durationOptionId: params.durationOptionId,
          durationMins: params.durationMins ? Number(params.durationMins) : undefined,
          deliveryType: selectedDeliveryType,
        });
        if (cancelled) return;
        setSlots(data ?? []);
      } catch {
        if (!cancelled) setError(dir.isRTL ? 'تعذّر تحميل الأوقات' : 'Failed to load times');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    params.employeeId,
    branchId,
    dayIdx,
    days,
    params.serviceId,
    params.durationOptionId,
    params.durationMins,
    params.deliveryType,
    dir.isRTL,
    reloadKey,
  ]);

  const selectedSlot = slotIdx != null ? slots[slotIdx] : null;
  const selectedDay = days[dayIdx];

  const handleRetry = () => setReloadKey((k) => k + 1);

  const handleConfirm = () => {
    if (!selectedSlot || !branchId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(client)/booking/confirm',
      params: {
        serviceId: params.serviceId,
        employeeId: params.employeeId ?? '',
        branchId,
        deliveryType: params.deliveryType ?? 'in_person',
        scheduledAt: selectedSlot.startTime,
        durationOptionId: params.durationOptionId,
        chargedPrice: params.chargedPrice,
        currency: params.currency,
      },
    });
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}>
          <BookingStepHeader
            step={2}
            onBack={() => router.back()}
            backAccessibilityLabel={t('a11y.buttonBack')}
          />
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text
            style={[
              styles.title,
              { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {dir.isRTL ? 'اختاري موعداً' : 'Pick a time'}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {dir.isRTL
              ? 'الأوقات المتاحة بحسب جدول المختصة'
              : "Available times based on the therapist's schedule"}
          </Text>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
          <DaySelector
            days={days}
            dayIdx={dayIdx}
            onSelect={setDayIdx}
            dir={dir}
            f500={f500}
            f700={f700}
          />
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(240).duration(600).easing(Easing.out(Easing.cubic))}
          style={[styles.slotsHead, { flexDirection: dir.row }]}
        >
          <Text
            style={[
              styles.slotsTitle,
              { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {dir.isRTL ? 'الأوقات المتاحة' : 'Available times'}
          </Text>
          <Text
            style={[
              styles.tz,
              { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {tzLabel}
          </Text>
        </Animated.View>

        <TimeSlotsGrid
          loading={loading}
          error={error}
          slots={slots}
          selectedIdx={slotIdx}
          onSelect={setSlotIdx}
          dir={dir}
          f500={f500}
          f600={f600}
          reduceMotion={reduceMotion}
          onRetry={handleRetry}
        />
      </ScrollView>

      <BookingCta
        selectedDay={selectedDay}
        selectedSlot={selectedSlot}
        onConfirm={handleConfirm}
        dir={dir}
        f400={f400}
        f700={f700}
      />
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: sawaaColors.ink[900],
    marginTop: sawaaSpacing.sm,
    paddingHorizontal: sawaaSpacing.xs,
  },
  subtitle: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: sawaaColors.ink[500],
    marginTop: sawaaSpacing.xs,
    paddingHorizontal: sawaaSpacing.xs,
  },
  slotsHead: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: sawaaSpacing.xs },
  slotsTitle: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.ink[900],
  },
  tz: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: sawaaColors.ink[500],
  },
});
