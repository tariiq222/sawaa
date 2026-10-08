import React, { useMemo, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Building2, Calendar, ChevronLeft, ChevronRight, Clock, Stethoscope, UserRound, Video } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  AquaBackground,
  PrimaryButton,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
} from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { InfoRows } from '@/components/ui/InfoRows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { PaymentMethods } from '@/components/features/booking/PaymentMethods';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { bookingStep } from '@/features/booking/booking-entry';
import { encodeBookingReturn } from '@/features/booking/guest-booking-flow';
import { useReduceMotion } from '@/hooks/useA11y';
import { useCatalogDepartments, useClinics, usePublicCatalog, useTherapists } from '@/hooks/queries';
import { therapistDisplay } from '@/components/features/directory/TherapistCard';
import { resolveConfirmCatalogSelection, resolveConfirmPrice } from '@/features/booking/confirm-catalog';
import { formatConfirmDate, formatConfirmTime } from '@/features/booking/confirm-format';
import { useBookingPayment } from '@/features/booking/use-booking-payment';
import { getFontName } from '@/theme/fonts';
import { formatCurrencyAmount } from '@/lib/currency-display';
import { goBackOrHome } from '@/lib/navigation';
import type { DeliveryType } from '@/types/booking-enums';
/**
 * Step 2 of 2: review the appointment and pay on the same page, so the flow no
 * longer splits confirmation and payment into two screens.
 */
export default function BookingConfirmScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { clinicId, serviceId, employeeId, branchId, deliveryType, scheduledAt, durationOptionId, chargedPrice, currency, steps } = useLocalSearchParams<{
    clinicId?: string;
    serviceId?: string;
    employeeId?: string;
    branchId?: string;
    deliveryType?: DeliveryType;
    scheduledAt?: string;
    durationOptionId?: string;
    chargedPrice?: string;
    currency?: string;
    steps?: string;
  }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const [footerHeight, setFooterHeight] = useState(180);
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const f400 = getFontName(dir.locale, '400');
    const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;
  const clinicsQuery = useClinics();
  const therapistsQuery = useTherapists();
  const catalogQuery = usePublicCatalog(Boolean(serviceId));
  const departmentsQuery = useCatalogDepartments(Boolean(!clinicId && serviceId));
  const resolved = useMemo(() => resolveConfirmCatalogSelection(
    catalogQuery.data,
    departmentsQuery.data,
    clinicId,
    serviceId,
  ), [catalogQuery.data, departmentsQuery.data, clinicId, serviceId]);
  const { service, directClinic } = resolved;
  const activeCatalogQuery = clinicId ? catalogQuery : departmentsQuery;
  const loading = activeCatalogQuery.isLoading;
  const error = activeCatalogQuery.isError
    ? (t('booking.failedToLoadService'))
    : activeCatalogQuery.data && !service
      ? (t('booking.serviceUnavailable'))
      : null;
  const scheduledDate = useMemo(
    () => (scheduledAt && Number.isFinite(Date.parse(scheduledAt)) ? new Date(scheduledAt) : null),
    [scheduledAt],
  );
  const selectedDeliveryType = deliveryType ?? 'in_person';
  const isOnline = selectedDeliveryType === 'online';
  // Prefer the practitioner's charged price (integer halalas) selected in the
  // previous step — this is the price the backend will actually invoice.
  const { subtotal, total } = resolveConfirmPrice(service, directClinic, chargedPrice);
  const formatMoney = (halalas: number) => formatCurrencyAmount(halalas, currency ?? service?.currency, dir.isRTL);
  const canReview = !loading && !error && service != null
    && subtotal != null && Number.isSafeInteger(subtotal) && subtotal >= 0
    && scheduledDate != null && !!branchId && !!employeeId && !!serviceId;
  const payment = useBookingPayment({
    branchId,
    employeeId,
    serviceId,
    scheduledAt,
    durationOptionId,
    deliveryType: selectedDeliveryType,
    amount: total == null ? undefined : String(total),
    currency: currency ?? service?.currency,
  }, signedIn && canReview);

  const signIn = () => {
    if (!canReview) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push({
      pathname: '/(auth)/login',
      params: { booking: encodeBookingReturn({
        clinicId,
        serviceId: serviceId as string,
        employeeId: employeeId as string,
        branchId: branchId as string,
        deliveryType: selectedDeliveryType,
        scheduledAt: scheduledAt as string,
        durationOptionId,
        amount: String(total),
        currency: currency ?? service?.currency ?? 'SAR',
        ...(steps ? { steps } : {}),
      }) },
    });
  };
  const serviceName = directClinic
    ? (dir.isRTL ? directClinic.nameAr : (directClinic.nameEn ?? directClinic.nameAr))
    : service
      ? (dir.isRTL ? service.nameAr : (service.nameEn ?? service.nameAr))
      : null;
  const clinic = clinicId ? clinicsQuery.data?.find((entry) => entry.id === clinicId) : undefined;
  const clinicName = clinic ? (dir.isRTL ? clinic.nameAr : (clinic.nameEn ?? clinic.nameAr)) : null;
  const therapist = employeeId ? therapistsQuery.data?.find((entry) => entry.id === employeeId) : undefined;
  const specialistName = therapist ? therapistDisplay(therapist, dir.isRTL, t('therapists.unknownName')).name : null;
  const infoRows = [
    ...(serviceName ? [{ icon: Stethoscope, label: t('booking.service'), value: serviceName }] : []),
    ...(clinicName && !directClinic ? [{ icon: Building2, label: t('booking.clinic'), value: clinicName }] : []),
    ...(specialistName ? [{ icon: UserRound, label: t('booking.specialist'), value: specialistName }] : []),
    { icon: isOnline ? Video : Building2, label: t('booking.visitType'), value: t(isOnline ? 'booking.online' : 'booking.inPerson') },
    { icon: Calendar, label: t('booking.date'), value: scheduledDate ? formatConfirmDate(scheduledDate, dir.isRTL) : '—' },
    { icon: Clock, label: t('booking.time'), value: scheduledDate ? formatConfirmTime(scheduledDate, dir.isRTL) : '—' },
  ];
  const localizedText = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: footerHeight + sawaaSpacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}>
          <BookingStepHeader {...bookingStep('confirm', steps)} title={t('booking.confirmBooking')} onBack={() => goBackOrHome(router, signedIn ? '/(client)/(tabs)/home' : '/(guest)/home')} />
        </Animated.View>
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(120).duration(600).easing(Easing.out(Easing.cubic))}>
          {loading ? (
            <Glass radius={sawaaRadius.lg}>
              <View style={styles.skeletonBlock}>
                <Skeleton height={16} width="60%" />
                <Skeleton height={16} width="40%" />
              </View>
            </Glass>
          ) : error ? (
            <Glass radius={sawaaRadius.lg}>
              <EmptyState
                icon="cloud-offline-outline"
                tone="danger"
                title={error}
                actionLabel={t('common.retry')}
                onAction={() => { void activeCatalogQuery.refetch(); }}
              />
            </Glass>
          ) : (
            <InfoRows rows={infoRows} />
          )}
        </Animated.View>
        {signedIn && canReview ? (
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(220).duration(700).easing(Easing.out(Easing.cubic))} style={styles.methods}>
            <SectionHeader title={t('booking.paymentMethod')} />
            {payment.methodsLoading ? (
              <Text style={[styles.hintText, localizedText]}>{t('payment.methodsLoading')}</Text>
            ) : payment.methodsError ? (
              <EmptyState icon="cloud-offline-outline" tone="danger" title={t('payment.methodsError')}
                actionLabel={t('common.retry')} onAction={payment.retryMethods} />
            ) : payment.availableMethods.length === 0 ? (
              <EmptyState icon="card-outline" title={t('payment.methodsUnavailable')}
                actionLabel={t('common.retry')} onAction={payment.retryMethods} />
            ) : <PaymentMethods
              methods={payment.availableMethods}
              selected={payment.method}
              onSelect={(method) => { Haptics.selectionAsync(); payment.setMethod(method); }}
              dir={dir}
            />}
          </Animated.View>
        ) : null}
        {!loading && !error && service ? (
          <View style={[styles.totalRow, { flexDirection: dir.row }]}>
            <Text style={[styles.priceLabelBold, { fontFamily: f600 }, localizedText]}>
              {t('booking.total')}
            </Text>
            <Text style={[styles.priceTotal, { fontFamily: f700 }]}>
              {subtotal == null ? '—' : formatMoney(total)}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <FloatingCta onHeightChange={setFooterHeight}>
        {signedIn ? (
          <PrimaryButton
            label={payment.method === 'at_center'
              ? t(payment.submitting ? 'booking.confirmingBooking' : 'booking.confirmAtCenter')
              : payment.submitting
              ? (t('booking.processing'))
              : t('booking.payAmount', { amount: formatMoney(total) })}
            onPress={() => { void payment.pay(); }}
            disabled={!payment.canPay}
            loading={payment.submitting}
            fontFamily={f700}
          />
        ) : (
          <PrimaryButton
            label={t('booking.signInOrRegisterToContinue')}
            onPress={signIn}
            disabled={!canReview}
            fontFamily={f700}
          />
        )}
        {!signedIn ? (
          <View style={[styles.hint, { flexDirection: dir.row }]}>
            <GoIcon size={14} color={colors.ink[500]} strokeWidth={1.75} />
            <Text style={[styles.hintText, { fontFamily: f400 }, localizedText]}>
              {t('booking.paymentOpensAfterSignIn')}
            </Text>
          </View>
        ) : null}
      </FloatingCta>

      {signedIn && payment.submitting ? (
        <View style={styles.processing} pointerEvents="none">
          <ActivityIndicator color={colors.teal[600]} />
        </View>
      ) : null}
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.md },
  totalRow: { flexWrap: 'wrap', gap: sawaaSpacing.md, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: sawaaSpacing.xs },
  priceLabelBold: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[900],
  },
  priceTotal: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    color: colors.teal[700],
    fontVariant: ['tabular-nums'],
  },
  skeletonBlock: { padding: sawaaSpacing.lg, gap: sawaaSpacing.md },
  methods: { gap: sawaaSpacing.sm },
  hint: { alignItems: 'center', justifyContent: 'center', gap: sawaaSpacing.xs, marginTop: sawaaSpacing.xs },
  hintText: { fontSize: sawaaType.caption.fontSize, color: colors.ink[500] },
  processing: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
});
