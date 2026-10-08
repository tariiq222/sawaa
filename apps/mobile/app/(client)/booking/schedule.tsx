import React from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { ScrollView, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

import { AquaBackground, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { bookingStepPath } from '@/features/booking/guest-booking-flow';
import { useBookingSlots } from '@/features/booking/use-booking-slots';
import { getFontName } from '@/theme/fonts';
import { DaySelector } from '@/components/features/booking/DaySelector';
import { TimeSlotsGrid } from '@/components/features/booking/TimeSlotsGrid';
import { BookingCta } from '@/components/features/booking/BookingCta';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useReduceMotion } from '@/hooks/useA11y';
import { goBackOrHome } from '@/lib/navigation';
import type { DeliveryType } from '@/types/booking-enums';

/**
 * Time-only variant of step 1. The merged booking page carries duration + time
 * together; this route stays for existing links and shares the same slot state
 * hook so there is a single availability implementation.
 */
export default function BookingScheduleScreen() {
  const colors = useSawaaColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    clinicId?: string;
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
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const slots = useBookingSlots({
    serviceId: params.serviceId,
    employeeId: params.employeeId,
    branchId: params.branchId,
    durationOptionId: params.durationOptionId,
    durationMins: params.durationMins,
    deliveryType: params.deliveryType ?? 'in_person',
  });

  const handleConfirm = () => {
    if (!slots.selectedSlot || !slots.branchId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: bookingStepPath('confirm', signedIn),
      params: {
        clinicId: params.clinicId,
        serviceId: params.serviceId,
        employeeId: params.employeeId ?? '',
        branchId: slots.branchId,
        deliveryType: params.deliveryType ?? 'in_person',
        scheduledAt: slots.selectedSlot.startTime,
        durationOptionId: params.durationOptionId?.trim() || undefined,
        chargedPrice: params.chargedPrice,
        currency: params.currency,
      },
    });
  };

  const tzLabel = t('booking.yourLocalTime');
  const noOpenings = slots.availabilityByDate && !Object.values(slots.availabilityByDate).some(Boolean);

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: insets.bottom + 160 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}>
          <BookingStepHeader step={1} total={2} title={t('booking.selectDate')} onBack={() => goBackOrHome(router, signedIn ? '/(client)/(tabs)/home' : '/(guest)/home')} />
        </Animated.View>

        <SectionHeader title={dir.isRTL ? 'اليوم' : 'Day'} />

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
          <DaySelector
            days={slots.days}
            dayIdx={slots.dayIdx}
            availabilityByDate={slots.availabilityByDate}
            onSelect={slots.setDayIdx}
            dir={dir}
            f500={f500}
            f700={f700}
          />
        </Animated.View>

        {slots.daysLoading ? (
          <Text style={[styles.tz, { fontFamily: f400, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'جارٍ التحقق من الأيام المتاحة…' : 'Checking available days…'}
          </Text>
        ) : slots.daysError ? (
          <EmptyState icon="cloud-offline-outline" tone="danger" title={slots.daysError}
            actionLabel={t('common.retry')} onAction={slots.handleRetryDays} />
        ) : noOpenings ? (
          <EmptyState icon="calendar-outline"
            title={dir.isRTL ? 'لا مواعيد متاحة لهذا الحجز خلال ٣٠ يومًا' : 'No openings for this booking in the next 30 days'} />
        ) : null}

        {slots.dayIdx != null ? (
          <>
            <SectionHeader title={dir.isRTL ? 'الوقت' : 'Time'} />
            <Text style={[styles.tz, { fontFamily: f400, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
              {tzLabel}
            </Text>

            {slots.loading || slots.error || slots.slots.length > 0 ? (
              <TimeSlotsGrid
                loading={slots.loading}
                error={slots.error}
                slots={slots.slots}
                selectedIdx={slots.slotIdx}
                onSelect={slots.setSlotIdx}
                dir={dir}
                f500={f500}
                f600={f600}
                reduceMotion={reduceMotion}
                onRetry={slots.handleRetry}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <BookingCta
        selectedDay={slots.selectedDay}
        selectedSlot={slots.selectedSlot}
        chargedPrice={params.chargedPrice}
        currency={params.currency}
        onConfirm={handleConfirm}
        dir={dir}
        f400={f400}
        f700={f700}
      />
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.md },
  tz: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[500],
  },
});
