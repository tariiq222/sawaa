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

  const tzLabel = dir.isRTL ? 'بتوقيتك المحلي' : 'Your local time';
  const noOpenings = slots.availabilityByDate && !Object.values(slots.availabilityByDate).some(Boolean);

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}>
          <BookingStepHeader step={1} onBack={() => goBackOrHome(router)} backAccessibilityLabel={t('a11y.buttonBack')} />
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {dir.isRTL ? 'اختاري موعداً' : 'Pick a time'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {dir.isRTL
              ? 'الأوقات المتاحة بحسب جدول المختصة'
              : "Available times based on the therapist's schedule"}
          </Text>
        </Animated.View>

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
            actionLabel={dir.isRTL ? 'إعادة المحاولة' : 'Retry'} onAction={slots.handleRetryDays} />
        ) : noOpenings ? (
          <EmptyState icon="calendar-outline"
            title={dir.isRTL ? 'لا مواعيد متاحة لهذا الحجز خلال ٣٠ يومًا' : 'No openings for this booking in the next 30 days'} />
        ) : null}

        {slots.dayIdx != null ? (
          <>
            <Animated.View
              entering={reduceMotion ? undefined : FadeInDown.delay(240).duration(600).easing(Easing.out(Easing.cubic))}
              style={[styles.slotsHead, { flexDirection: dir.row }]}
            >
              <Text style={[styles.slotsTitle, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                {dir.isRTL ? 'الأوقات المتاحة' : 'Available times'}
              </Text>
              <Text style={[styles.tz, { fontFamily: f400, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                {tzLabel}
              </Text>
            </Animated.View>

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
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: colors.ink[900],
    marginTop: 0,
    paddingHorizontal: sawaaSpacing.xs,
  },
  subtitle: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[500],
    marginTop: 0,
    paddingHorizontal: sawaaSpacing.xs,
  },
  slotsHead: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: sawaaSpacing.xs },
  slotsTitle: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[900],
  },
  tz: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: colors.ink[500],
  },
});
