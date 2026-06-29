import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Calendar, ChevronLeft, ChevronRight, Clock, Video } from 'lucide-react-native';

import {
  AquaBackground,
  sawaaColors,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
  withAlpha,
} from '@/theme/sawaa';
import { GlassSurface } from '@/theme/sawaa/GlassSurface';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FloatingActionBar } from '@/components/ui/FloatingActionBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import {
  publicCatalogService,
  type PublicService,
} from '@/services/client/catalog';
import { formatHalalas } from '@/lib/money';
import type { DeliveryType } from '@/types/booking-enums';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTime(d: Date, isRTL: boolean): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h < 12 ? (isRTL ? 'ص' : 'AM') : (isRTL ? 'م' : 'PM');
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function formatDate(d: Date, isRTL: boolean): string {
  const month = isRTL ? MONTHS_AR[d.getMonth()] : MONTHS_EN[d.getMonth()];
  const day = isRTL ? d.getDate().toLocaleString('ar-SA') : d.getDate();
  const year = isRTL ? d.getFullYear().toLocaleString('ar-SA') : d.getFullYear();
  return isRTL ? `${day} ${month} ${year}` : `${month} ${day}, ${year}`;
}

export default function BookingConfirmScreen() {
  const { serviceId, employeeId, branchId, deliveryType, scheduledAt, durationOptionId, chargedPrice, currency } = useLocalSearchParams<{
    serviceId?: string;
    employeeId?: string;
    branchId?: string;
    deliveryType?: DeliveryType;
    scheduledAt?: string;
    durationOptionId?: string;
    chargedPrice?: string;
    currency?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;

  const [service, setService] = useState<PublicService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!serviceId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const departments = await publicCatalogService.listDepartments();
        if (cancelled) return;
        const found = departments
          .flatMap((d) => d.services)
          .find((s) => s.id === serviceId);
        setService(found ?? null);
        if (!found) setError(dir.isRTL ? 'الخدمة غير متوفرة' : 'Service unavailable');
      } catch {
        if (!cancelled) setError(dir.isRTL ? 'تعذّر تحميل الخدمة' : 'Failed to load service');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [serviceId, dir.isRTL, reloadKey]);

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
  // invoice. Fall back to the service base price only when no option was
  // carried (P1-22: previously always showed the base price). VAT/total are
  // computed server-side on the invoice — not derived client-side here.
  const carriedPrice = chargedPrice != null && chargedPrice !== '' ? Number(chargedPrice) : null;
  const subtotal =
    carriedPrice != null && Number.isFinite(carriedPrice)
      ? carriedPrice
      : service
        ? Number(service.price)
        : 0;
  const total = subtotal;
  const formatMoney = (halalas: number) =>
    `${formatHalalas(halalas, { locale: dir.isRTL ? 'ar-SA' : 'en-US' })} ⃁`;

  const rows = [
    {
      icon: <Video size={18} color={sawaaColors.accent.violet} strokeWidth={1.75} />,
      labelAr: 'نوع الزيارة',
      labelEn: 'Visit type',
      valueAr: kindAr,
      valueEn: kindEn,
      color: sawaaColors.accent.violet,
    },
    {
      icon: <Calendar size={18} color={sawaaColors.teal[600]} strokeWidth={1.75} />,
      labelAr: 'التاريخ',
      labelEn: 'Date',
      valueAr: scheduledDate ? formatDate(scheduledDate, true) : '—',
      valueEn: scheduledDate ? formatDate(scheduledDate, false) : '—',
      color: sawaaColors.teal[600],
    },
    {
      icon: <Clock size={18} color={sawaaColors.accent.amber} strokeWidth={1.75} />,
      labelAr: 'الوقت',
      labelEn: 'Time',
      valueAr: scheduledDate ? formatTime(scheduledDate, true) : '—',
      valueEn: scheduledDate ? formatTime(scheduledDate, false) : '—',
      color: sawaaColors.accent.amber,
    },
  ];

  const handleConfirm = () => {
    if (!service || !scheduledAt || !branchId || !employeeId || !serviceId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push({
      pathname: '/(client)/booking/payment',
      params: {
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

  const canContinue = service != null && scheduledDate != null && !!branchId;
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
          <BookingStepHeader step={3} onBack={() => router.back()} />
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
          <GlassSurface variant="strong" radius={sawaaRadius.xl}>
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
          </GlassSurface>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(240).duration(700).easing(Easing.out(Easing.cubic))}>
          <GlassSurface variant="strong" radius={sawaaRadius.xl}>
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
                onAction={() => setReloadKey((k) => k + 1)}
              />
            ) : service ? (
              <>
                <View style={[styles.priceRow, { flexDirection: dir.row }]}>
                  <Text style={[styles.priceLabel, { fontFamily: f500, fontWeight: '500' }, localizedText]}>
                    {dir.isRTL ? service.nameAr : (service.nameEn ?? service.nameAr)}
                  </Text>
                  <Text style={[styles.priceValue, { fontFamily: f600, fontWeight: '600' }]}>
                    {formatMoney(subtotal)}
                  </Text>
                </View>
                {/* TODO(price-units): VAT/total must come from server invoice */}
                <View style={styles.priceDivider} />
                <View style={[styles.priceRow, { flexDirection: dir.row }]}>
                  <Text style={[styles.priceLabelBold, { fontFamily: f700 }, localizedText]}>
                    {dir.isRTL ? 'الإجمالي' : 'Total'}
                  </Text>
                  <Text style={[styles.priceTotal, { fontFamily: f700 }]}>{formatMoney(total)}</Text>
                </View>
              </>
            ) : null}
          </GlassSurface>
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.delay(360).duration(700).easing(Easing.out(Easing.cubic))}
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
      >
        <FloatingActionBar>
          <View style={styles.ctaFlex}>
            <PrimaryButton
              label={dir.isRTL ? 'متابعة الدفع' : 'Continue to payment'}
              onPress={handleConfirm}
              disabled={!canContinue}
              fontFamily={f700}
              icon={<GoIcon size={16} color={sawaaColors.teal[50]} strokeWidth={2} />}
            />
          </View>
        </FloatingActionBar>
      </Animated.View>
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
  row: { alignItems: 'center', gap: sawaaSpacing.lg, padding: sawaaSpacing.lg },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withAlpha(sawaaColors.ink[900], 0.06),
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
    color: sawaaColors.ink[500],
  },
  rowValue: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.ink[900],
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
    color: sawaaColors.ink[700],
  },
  priceLabelBold: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.ink[900],
  },
  priceValue: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.ink[900],
    fontVariant: ['tabular-nums'],
  },
  priceTotal: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    color: sawaaColors.teal[700],
    fontVariant: ['tabular-nums'],
  },
  priceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: withAlpha(sawaaColors.ink[900], 0.06),
    marginHorizontal: sawaaSpacing.lg,
  },
  skeletonBlock: { padding: sawaaSpacing.lg, gap: sawaaSpacing.md },
  ctaFlex: { flex: 1 },
});
