import React, { useEffect, useMemo, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Building2, Check, ChevronRight, Video } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  AquaBackground,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
  withAlpha,
} from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { DaySelector } from '@/components/features/booking/DaySelector';
import { TimeSlotsGrid } from '@/components/features/booking/TimeSlotsGrid';
import { BookingCta } from '@/components/features/booking/BookingCta';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { formatCurrencyAmount } from '@/lib/currency-display';
import { goBackOrHome } from '@/lib/navigation';
import { useBookingSlots } from '@/features/booking/use-booking-slots';
import {
  getPractitionerBookingOptions,
  toMobileDeliveryType,
  type PractitionerBookingOption,
} from '@/features/booking/booking-options';
import { bookingStepPath } from '@/features/booking/guest-booking-flow';
/**
 * Step 1 of 2: duration, visit type and time on one page. The visitor picks a
 * priced option, availability loads for exactly that option, and the CTA
 * carries the full selection into the review + payment page.
 */
export default function BookingTypeScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { clinicId, serviceId, employeeId, branchId: branchParam } = useLocalSearchParams<{
    clinicId?: string;
    serviceId: string;
    employeeId?: string;
    branchId?: string;
  }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const [options, setOptions] = useState<PractitionerBookingOption[]>([]);
  const [selected, setSelected] = useState<PractitionerBookingOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!serviceId || !employeeId) {
      setLoading(false);
      setError(dir.isRTL ? 'بيانات الحجز غير مكتملة' : 'Booking details are incomplete');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await getPractitionerBookingOptions(serviceId, employeeId);
        if (cancelled) return;
        setOptions(data.options ?? []);
      } catch {
        if (!cancelled) setError(dir.isRTL ? 'تعذّر تحميل الخيارات' : 'Failed to load options');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceId, employeeId, dir.isRTL, reloadKey]);
  const slots = useBookingSlots({
    serviceId,
    employeeId,
    branchId: branchParam,
    durationOptionId: selected?.durationOptionId,
    durationMins: selected ? String(selected.durationMins) : undefined,
    deliveryType: selected ? toMobileDeliveryType(selected.deliveryType) : undefined,
    enabled: Boolean(selected) && !loading && !error,
  });
  const formatMoney = (halalas: number, currency: string) => formatCurrencyAmount(halalas, currency, dir.isRTL);
  const choose = (opt: PractitionerBookingOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    slots.clearSelection();
    setSelected(opt);
  };
  const handleContinue = () => {
    if (!selected || !slots.selectedSlot || !slots.branchId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: bookingStepPath('confirm', signedIn),
      params: {
        clinicId,
        serviceId,
        employeeId: employeeId ?? '',
        branchId: slots.branchId,
        deliveryType: toMobileDeliveryType(selected.deliveryType),
        scheduledAt: slots.selectedSlot.startTime,
        durationOptionId: selected.durationOptionId,
        chargedPrice: String(selected.price),
        currency: selected.currency,
      },
    });
  };
  const iconFor = (deliveryType: 'IN_PERSON' | 'ONLINE') =>
    deliveryType === 'ONLINE' ? Video : Building2;
  const labelFor = (opt: PractitionerBookingOption) => {
    if (opt.label) return opt.label;
    return opt.deliveryType === 'ONLINE'
      ? dir.isRTL ? 'استشارة عن بُعد' : 'Remote consultation'
      : dir.isRTL ? 'موعد عيادة' : 'In-clinic visit';
  };
  const descFor = (opt: PractitionerBookingOption) => {
    const mins = dir.isRTL ? `${opt.durationMins} دقيقة` : `${opt.durationMins} min`;
    const channel = opt.deliveryType === 'ONLINE'
      ? dir.isRTL ? 'أونلاين' : 'Online'
      : dir.isRTL ? 'حضوري' : 'In-person';
    return `${mins} · ${channel}`;
  };
  const tzLabel = dir.isRTL ? 'بتوقيتك المحلي' : 'Your local time';
  const noOpenings = slots.availabilityByDate && !Object.values(slots.availabilityByDate).some(Boolean);
  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: insets.bottom + 140 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}>
          <BookingStepHeader step={1} onBack={() => goBackOrHome(router)} backAccessibilityLabel={t('a11y.buttonBack')} />
        </Animated.View>
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {dir.isRTL ? 'اختر المدة والوقت' : 'Choose duration and time'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {dir.isRTL
              ? 'اختر مدة الجلسة وطريقة الحضور، ثم الوقت المناسب.'
              : 'Pick the session duration and attendance type, then a time.'}
          </Text>
        </Animated.View>

        {loading ? (
          <View style={styles.skeletonBlock}>
            <Skeleton height={84} radius={sawaaRadius.xl} />
            <Skeleton height={84} radius={sawaaRadius.xl} />
            <Skeleton height={84} radius={sawaaRadius.xl} />
          </View>
        ) : error ? (
          <EmptyState
            icon="cloud-offline-outline"
            tone="danger"
            title={error}
            actionLabel={dir.isRTL ? 'إعادة المحاولة' : 'Retry'}
            onAction={() => setReloadKey((k) => k + 1)}
          />
        ) : options.length === 0 ? (
          <EmptyState icon="calendar-outline" title={dir.isRTL ? 'لا توجد خيارات متاحة' : 'No options available'} />
        ) : (
          <>
            {options.map((opt, i) => {
              const Icon = iconFor(opt.deliveryType);
              const isSelected = selected?.durationOptionId === opt.durationOptionId
                && selected?.deliveryType === opt.deliveryType
                && selected?.durationMins === opt.durationMins;
              return (
                <Animated.View
                  key={`${opt.durationOptionId}-${opt.deliveryType}-${i}`}
                  entering={reduceMotion ? undefined : FadeInDown.delay(120 + i * 60).duration(600).easing(Easing.out(Easing.cubic))}
                >
                  <Glass
                    variant="strong"
                    radius={sawaaRadius.xl}
                    onPress={() => choose(opt)}
                    interactive
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    style={[styles.typeCard, isSelected && { borderWidth: 2, borderColor: colors.teal[600] }]}
                  >
                    <View style={[styles.typeRow, { flexDirection: dir.row }]}>
                      <View style={[styles.typeIcon, { backgroundColor: withAlpha(colors.teal[600], 0.12) }]}>
                        <Icon size={22} strokeWidth={1.75} color={colors.teal[600]} />
                      </View>
                      <View style={styles.typeMid}>
                        <Text style={[styles.typeLabel, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                          {labelFor(opt)}
                        </Text>
                        <Text style={[styles.typeDesc, { fontFamily: f400, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                          {descFor(opt)}
                        </Text>
                      </View>
                      <View style={styles.typeEnd}>
                        <Text style={[styles.typePrice, { fontFamily: f600 }]}>
                          {formatMoney(opt.price, opt.currency)}
                        </Text>
                        {isSelected ? (
                          <View style={[styles.checkCircle, { backgroundColor: colors.teal[600] }]}>
                            <Check size={13} color={colors.teal[50]} strokeWidth={3} />
                          </View>
                        ) : (
                          <ChevronRight size={16} color={colors.ink[400]} strokeWidth={2} />
                        )}
                      </View>
                    </View>
                  </Glass>
                </Animated.View>
              );
            })}

            {selected ? (
              <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(160).duration(600).easing(Easing.out(Easing.cubic))}>
                <DaySelector
                  days={slots.days}
                  dayIdx={slots.dayIdx}
                  availabilityByDate={slots.availabilityByDate}
                  onSelect={slots.setDayIdx}
                  dir={dir}
                  f500={f500}
                  f700={f700}
                />

                {slots.daysLoading ? (
                  <Text style={[styles.tz, { fontFamily: f400, textAlign: dir.textAlign }]}>
                    {dir.isRTL ? 'جارٍ التحقق من الأيام المتاحة…' : 'Checking available days…'}
                  </Text>
                ) : slots.daysError ? (
                  <EmptyState
                    icon="cloud-offline-outline"
                    tone="danger"
                    title={slots.daysError}
                    actionLabel={dir.isRTL ? 'إعادة المحاولة' : 'Retry'}
                    onAction={slots.handleRetryDays}
                  />
                ) : noOpenings ? (
                  <EmptyState
                    icon="calendar-outline"
                    title={dir.isRTL ? 'لا مواعيد متاحة لهذا الحجز خلال ٣٠ يومًا' : 'No openings for this booking in the next 30 days'}
                  />
                ) : null}

                {slots.dayIdx != null ? (
                  <>
                    <View style={[styles.slotsHead, { flexDirection: dir.row }]}>
                      <Text style={[styles.slotsTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
                        {dir.isRTL ? 'الأوقات المتاحة' : 'Available times'}
                      </Text>
                      <Text style={[styles.tz, { fontFamily: f400, textAlign: dir.textAlign }]}>{tzLabel}</Text>
                    </View>
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
              </Animated.View>
            ) : null}
          </>
        )}
      </ScrollView>

      {selected ? (
        <BookingCta
          selectedDay={slots.selectedDay}
          selectedSlot={slots.selectedSlot}
          chargedPrice={String(selected.price)}
          currency={selected.currency}
          onConfirm={handleContinue}
          dir={dir}
          f400={f400}
          f700={f700}
        />
      ) : null}
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.md },
  title: {
    fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight,
    color: colors.ink[900],
    marginVertical: sawaaSpacing.xs,
    paddingHorizontal: sawaaSpacing.xs,
  },
  subtitle: {
    fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[500],
    marginTop: -sawaaSpacing.xs,
    paddingHorizontal: sawaaSpacing.xs,
  },
  skeletonBlock: { gap: sawaaSpacing.lg },
  typeCard: { padding: sawaaSpacing.md },
  typeRow: { alignItems: 'center', gap: sawaaSpacing.md },
  typeIcon: {
    width: 44, height: 44,
    borderRadius: sawaaRadius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  typeMid: { flex: 1 },
  typeEnd: { alignItems: 'center', gap: sawaaSpacing.xs, flexDirection: 'row' },
  checkCircle: { width: 22, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  typeLabel: {
    fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[900],
  },
  typeDesc: {
    fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[500],
    marginTop: sawaaSpacing.xs,
  },
  typePrice: {
    fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight,
    color: colors.teal[700],
    fontVariant: ['tabular-nums'],
  },
  slotsHead: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: sawaaSpacing.xs },
  slotsTitle: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[900] },
  tz: { fontSize: sawaaType.micro.fontSize, lineHeight: sawaaType.micro.lineHeight, color: colors.ink[500] },
});
