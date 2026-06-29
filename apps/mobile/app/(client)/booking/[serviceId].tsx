import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Building2, ChevronLeft, ChevronRight, Video } from 'lucide-react-native';

import {
  AquaBackground,
  sawaaColors,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
  withAlpha,
} from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { formatHalalas } from '@/lib/money';
import {
  getPractitionerBookingOptions,
  toMobileDeliveryType,
  type PractitionerBookingOption,
} from './booking-options';

export default function BookingTypeScreen() {
  const { serviceId, employeeId } = useLocalSearchParams<{ serviceId: string; employeeId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;

  const [options, setOptions] = useState<PractitionerBookingOption[]>([]);
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

  const formatMoney = (halalas: number) =>
    `${formatHalalas(halalas, { locale: dir.isRTL ? 'ar-SA' : 'en-US' })} ⃁`;

  const handleSelect = (opt: PractitionerBookingOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(client)/booking/schedule',
      params: {
        serviceId,
        employeeId: employeeId ?? '',
        deliveryType: toMobileDeliveryType(opt.deliveryType),
        // Pass the chosen priced option forward so availability uses the right
        // duration and confirm/payment charge the practitioner's actual price.
        durationOptionId: opt.durationOptionId,
        durationMins: String(opt.durationMins),
        chargedPrice: String(opt.price),
        currency: opt.currency,
      },
    });
  };

  const iconFor = (deliveryType: 'IN_PERSON' | 'ONLINE') =>
    deliveryType === 'ONLINE' ? Video : Building2;
  const colorFor = (deliveryType: 'IN_PERSON' | 'ONLINE') =>
    deliveryType === 'ONLINE' ? sawaaColors.accent.violet : sawaaColors.teal[600];

  const labelFor = (opt: PractitionerBookingOption) => {
    if (opt.label) return opt.label;
    return opt.deliveryType === 'ONLINE'
      ? dir.isRTL ? 'استشارة عن بُعد' : 'Remote consultation'
      : dir.isRTL ? 'موعد عيادة' : 'In-clinic visit';
  };

  const descFor = (opt: PractitionerBookingOption) => {
    const mins = dir.isRTL ? `${opt.durationMins} دقيقة` : `${opt.durationMins} min`;
    const channel =
      opt.deliveryType === 'ONLINE'
        ? dir.isRTL ? 'أونلاين' : 'Online'
        : dir.isRTL ? 'حضوري' : 'In-person';
    return `${mins} · ${channel}`;
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: insets.bottom + sawaaSpacing['3xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}>
          <BookingStepHeader step={1} onBack={() => router.back()} />
        </Animated.View>

        {/* Title */}
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text
            style={[
              styles.title,
              { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {dir.isRTL ? 'اختر المدة ونوع الزيارة' : 'Select duration and visit type'}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {dir.isRTL ? 'اختر مدة الجلسة وطريقة الحضور.' : 'Choose session duration and attendance type.'}
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
          <EmptyState
            icon="calendar-outline"
            title={dir.isRTL ? 'لا توجد خيارات متاحة' : 'No options available'}
          />
        ) : (
          options.map((opt, i) => {
            const Icon = iconFor(opt.deliveryType);
            const color = colorFor(opt.deliveryType);
            return (
              <Animated.View
                key={`${opt.durationOptionId}-${opt.deliveryType}-${i}`}
                entering={reduceMotion ? undefined : FadeInDown.delay(160 + i * 80).duration(700).easing(Easing.out(Easing.cubic))}
              >
                <Glass
                  variant="strong"
                  radius={sawaaRadius.xl}
                  onPress={() => handleSelect(opt)}
                  interactive
                  style={styles.typeCard}
                >
                  <View style={[styles.typeRow, { flexDirection: dir.row }]}>
                    <View style={[styles.typeIcon, { backgroundColor: withAlpha(color, 0.12) }]}>
                      <Icon size={22} strokeWidth={1.75} color={color} />
                    </View>
                    <View style={styles.typeMid}>
                      <Text
                        style={[
                          styles.typeLabel,
                          { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection },
                        ]}
                      >
                        {labelFor(opt)}
                      </Text>
                      <Text
                        style={[
                          styles.typeDesc,
                          { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign, writingDirection: dir.writingDirection },
                        ]}
                      >
                        {descFor(opt)}
                      </Text>
                    </View>
                    <View style={styles.typeEnd}>
                      <Text
                        style={[styles.typePrice, { fontFamily: f600, fontWeight: '600' }]}
                      >
                        {formatMoney(opt.price)}
                      </Text>
                      <GoIcon size={16} color={sawaaColors.ink[400]} strokeWidth={2} />
                    </View>
                  </View>
                </Glass>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: sawaaColors.ink[900],
    marginVertical: sawaaSpacing.sm,
    paddingHorizontal: sawaaSpacing.xs,
  },
  subtitle: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: sawaaColors.ink[500],
    marginTop: -sawaaSpacing.xs,
    paddingHorizontal: sawaaSpacing.xs,
  },
  skeletonBlock: { gap: sawaaSpacing.lg },
  typeCard: { padding: sawaaSpacing.lg },
  typeRow: { alignItems: 'center', gap: sawaaSpacing.lg },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: sawaaRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeMid: { flex: 1 },
  typeEnd: { alignItems: 'center', gap: sawaaSpacing.xs, flexDirection: 'row' },
  typeLabel: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.ink[900],
  },
  typeDesc: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: sawaaColors.ink[500],
    marginTop: sawaaSpacing.xs,
  },
  typePrice: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.teal[700],
    fontVariant: ['tabular-nums'],
  },
});
