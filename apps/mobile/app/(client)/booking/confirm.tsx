import React, { useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Calendar, ChevronLeft, ChevronRight, Clock, Video } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  AquaBackground,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
  withAlpha,
} from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FloatingActionBar } from '@/components/ui/FloatingActionBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { encodeBookingReturn } from '@/features/booking/guest-booking-flow';
import { useReduceMotion } from '@/hooks/useA11y';
import { useCatalogDepartments, usePublicCatalog } from '@/hooks/queries';
import { resolveConfirmCatalogSelection, resolveConfirmPrice } from '@/features/booking/confirm-catalog';
import { formatConfirmDate, formatConfirmTime } from '@/features/booking/confirm-format';
import { getFontName } from '@/theme/fonts';
import { formatCurrencyAmount } from '@/lib/currency-display';
import { goBackOrHome } from '@/lib/navigation';
import type { DeliveryType } from '@/types/booking-enums';

export default function BookingConfirmScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { clinicId, serviceId, employeeId, branchId, deliveryType, scheduledAt, durationOptionId, chargedPrice, currency } = useLocalSearchParams<{
    clinicId?: string;
    serviceId?: string;
    employeeId?: string;
    branchId?: string;
    deliveryType?: DeliveryType;
    scheduledAt?: string;
    durationOptionId?: string;
    chargedPrice?: string;
    currency?: string;
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
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;

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
    ? (dir.isRTL ? 'تعذّر تحميل الخدمة' : 'Failed to load service')
    : activeCatalogQuery.data && !service
      ? (dir.isRTL ? 'الخدمة غير متوفرة' : 'Service unavailable')
      : null;

  const scheduledDate = useMemo(
    () => (scheduledAt ? new Date(scheduledAt) : null),
    [scheduledAt],
  );

  const selectedDeliveryType = deliveryType ?? 'in_person';
  const isOnline = selectedDeliveryType === 'online';
  const kindAr = isOnline ? 'استشارة عن بُعد' : 'موعد عيادة';
  const kindEn = isOnline ? 'Remote consultation' : 'In-clinic visit';

  // Prefer the practitioner's charged price (integer halalas) selected in the
  // duration/delivery step — this is the price the backend will actually
  // invoice. Ordinary services may fall back to their base price, while a
  // DIRECT clinic requires the carried practitioner price because the hidden
  // catalog row is not the user's price. VAT is computed server-side.
  const { subtotal, total } = resolveConfirmPrice(service, directClinic, chargedPrice);
  const formatMoney = (halalas: number) => formatCurrencyAmount(halalas, currency ?? service?.currency, dir.isRTL);

  const rows = [
    {
      icon: <Video size={18} color={colors.teal[600]} strokeWidth={1.75} />,
      labelAr: 'نوع الزيارة',
      labelEn: 'Visit type',
      valueAr: kindAr,
      valueEn: kindEn,
      color: colors.teal[600],
    },
    {
      icon: <Calendar size={18} color={colors.teal[600]} strokeWidth={1.75} />,
      labelAr: 'التاريخ',
      labelEn: 'Date',
      valueAr: scheduledDate ? formatConfirmDate(scheduledDate, true) : '—',
      valueEn: scheduledDate ? formatConfirmDate(scheduledDate, false) : '—',
      color: colors.teal[600],
    },
    {
      icon: <Clock size={18} color={colors.teal[600]} strokeWidth={1.75} />,
      labelAr: 'الوقت',
      labelEn: 'Time',
      valueAr: scheduledDate ? formatConfirmTime(scheduledDate, true) : '—',
      valueEn: scheduledDate ? formatConfirmTime(scheduledDate, false) : '—',
      color: colors.teal[600],
    },
  ];

  const handleConfirm = () => {
    if (!service || subtotal == null || !scheduledAt || !branchId || !employeeId || !serviceId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (!signedIn) {
      router.push({
        pathname: '/(auth)/login',
        params: { booking: encodeBookingReturn({
          clinicId,
          serviceId, employeeId, branchId, deliveryType: selectedDeliveryType,
          scheduledAt, durationOptionId, amount: String(total),
          currency: currency ?? service.currency,
        }) },
      });
      return;
    }
    router.push({
      pathname: '/(client)/booking/payment',
      params: {
        clinicId,
        serviceId,
        employeeId,
        branchId,
        deliveryType: selectedDeliveryType,
        scheduledAt,
        durationOptionId,
        amount: String(total),
        currency: currency ?? service?.currency,
      },
    });
  };

  const canContinue = service != null && subtotal != null && scheduledDate != null && !!branchId;
  const localizedText = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;

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
          <BookingStepHeader step={3} onBack={() => goBackOrHome(router)} backAccessibilityLabel={t('a11y.buttonBack')} />
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700 }, localizedText]}>
            {dir.isRTL ? 'تأكيد الموعد' : 'Confirm booking'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, fontWeight: '400' }, localizedText]}>
            {dir.isRTL ? 'راجعي التفاصيل قبل التأكيد' : 'Review your details before confirming'}
          </Text>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl}>
            {rows.map((r, i) => (
              <View
                key={r.labelEn}
                style={[
                  styles.row,
                  { flexDirection: dir.row },
                  i < rows.length - 1 && styles.rowDivider,
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: withAlpha(r.color, 0.12) }]}>{r.icon}</View>
                <View style={styles.rowMid}>
                  <Text style={[styles.rowLabel, { fontFamily: f400, fontWeight: '400' }, localizedText]}>
                    {dir.isRTL ? r.labelAr : r.labelEn}
                  </Text>
                  <Text style={[styles.rowValue, { fontFamily: f700 }, localizedText]}>
                    {dir.isRTL ? r.valueAr : r.valueEn}
                  </Text>
                </View>
              </View>
            ))}
          </Glass>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(240).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl}>
            {loading ? (
              <View style={styles.skeletonBlock}>
                <Skeleton height={16} width="60%" />
                <Skeleton height={16} width="40%" />
              </View>
            ) : error ? (
              <EmptyState
                icon="cloud-offline-outline"
                tone="danger"
                title={error}
                actionLabel={dir.isRTL ? 'إعادة المحاولة' : 'Retry'}
                onAction={() => { void activeCatalogQuery.refetch(); }}
              />
            ) : service ? (
              <>
                <View style={[styles.priceRow, { flexDirection: dir.row }]}>
                  <Text style={[styles.priceLabel, { fontFamily: f500, fontWeight: '500' }, localizedText]}>
                    {directClinic
                      ? (dir.isRTL ? directClinic.nameAr : (directClinic.nameEn ?? directClinic.nameAr))
                      : (dir.isRTL ? service.nameAr : (service.nameEn ?? service.nameAr))}
                  </Text>
                  <Text style={[styles.priceValue, { fontFamily: f600, fontWeight: '600' }]}>
                    {subtotal == null ? '—' : formatMoney(subtotal)}
                  </Text>
                </View>
                {/* TODO(price-units): VAT/total must come from server invoice */}
                <View style={styles.priceDivider} />
                <View style={[styles.priceRow, { flexDirection: dir.row }]}>
                  <Text style={[styles.priceLabelBold, { fontFamily: f700 }, localizedText]}>
                    {dir.isRTL ? 'الإجمالي' : 'Total'}
                  </Text>
                  <Text style={[styles.priceTotal, { fontFamily: f700 }]}>
                    {subtotal == null ? '—' : formatMoney(total)}
                  </Text>
                </View>
              </>
            ) : null}
          </Glass>
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.delay(360).duration(700).easing(Easing.out(Easing.cubic))}
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
      >
        <FloatingActionBar>
          <View style={styles.ctaFlex}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canContinue }}
              onPress={handleConfirm}
              disabled={!canContinue}
              style={{ opacity: canContinue ? 1 : 0.45 }}
            >
              <Glass radius={26}>
                <View style={[styles.continueButton, { flexDirection: dir.row }]}>
                  <Text style={[styles.continueLabel, { fontFamily: f700 }]}>
                    {signedIn ? (dir.isRTL ? 'متابعة الدفع' : 'Continue to payment') : (dir.isRTL ? 'الدخول أو التسجيل للمتابعة' : 'Sign in or register to continue')}
                  </Text>
                  <GoIcon size={18} color={colors.ink[900]} strokeWidth={2} />
                </View>
              </Glass>
            </Pressable>
          </View>
        </FloatingActionBar>
      </Animated.View>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  continueButton: { minHeight: 52, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 8 },
  continueLabel: { flexShrink: 1, fontSize: 15, lineHeight: 23, color: colors.ink[900], textAlign: 'center' },
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
  row: { alignItems: 'center', gap: sawaaSpacing.md, padding: sawaaSpacing.md },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withAlpha(colors.ink[900], 0.06),
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: sawaaRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMid: { flex: 1 },
  rowLabel: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: colors.ink[500],
  },
  rowValue: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[900],
    marginTop: sawaaSpacing.xs,
  },
  priceRow: {
    justifyContent: 'space-between',
    paddingHorizontal: sawaaSpacing.lg,
    paddingVertical: sawaaSpacing.md,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[700],
  },
  priceLabelBold: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[900],
  },
  priceValue: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[900],
    fontVariant: ['tabular-nums'],
  },
  priceTotal: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    color: colors.teal[700],
    fontVariant: ['tabular-nums'],
  },
  priceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: withAlpha(colors.ink[900], 0.06),
    marginHorizontal: sawaaSpacing.lg,
  },
  skeletonBlock: { padding: sawaaSpacing.lg, gap: sawaaSpacing.md },
  ctaFlex: { flex: 1 },
});
