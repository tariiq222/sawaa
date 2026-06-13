import React from 'react';
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
import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import type { DeliveryType } from '@/types/booking-enums';

export default function BookingTypeScreen() {
  const { serviceId, employeeId } = useLocalSearchParams<{ serviceId: string; employeeId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;

  const types = [
    {
      deliveryType: 'in_person' as DeliveryType,
      icon: Building2,
      color: sawaaColors.teal[600],
      labelAr: 'موعد عيادة',
      labelEn: 'In-clinic visit',
      descAr: 'زيارة شخصية في العيادة',
      descEn: 'In-person at the clinic',
    },
    {
      deliveryType: 'online' as DeliveryType,
      icon: Video,
      color: sawaaColors.accent.violet,
      labelAr: 'استشارة عن بُعد',
      labelEn: 'Remote consultation',
      descAr: 'مرئي أو هاتفي — سيؤكد المعالج الطريقة',
      descEn: 'Video or phone — confirmed by therapist',
    },
  ];

  const handleSelect = (type: DeliveryType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(client)/booking/schedule',
      params: { serviceId, employeeId: employeeId ?? '', deliveryType: type },
    });
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
            {dir.isRTL ? 'اختر نوع الزيارة' : 'Select visit type'}
          </Text>
        </Animated.View>

        {/* Type cards — tap to select + advance */}
        {types.map((item, i) => (
          <Animated.View
            key={item.deliveryType}
            entering={reduceMotion ? undefined : FadeInDown.delay(160 + i * 80).duration(700).easing(Easing.out(Easing.cubic))}
          >
            <Glass
              variant="strong"
              radius={sawaaRadius.xl}
              onPress={() => handleSelect(item.deliveryType)}
              interactive
              style={styles.typeCard}
            >
              <View style={[styles.typeRow, { flexDirection: dir.row }]}>
                <View style={[styles.typeIcon, { backgroundColor: withAlpha(item.color, 0.12) }]}>
                  <item.icon size={22} strokeWidth={1.75} color={item.color} />
                </View>
                <View style={styles.typeMid}>
                  <Text
                    style={[
                      styles.typeLabel,
                      { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection },
                    ]}
                  >
                    {dir.isRTL ? item.labelAr : item.labelEn}
                  </Text>
                  <Text
                    style={[
                      styles.typeDesc,
                      { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign, writingDirection: dir.writingDirection },
                    ]}
                  >
                    {dir.isRTL ? item.descAr : item.descEn}
                  </Text>
                </View>
                <GoIcon size={16} color={sawaaColors.ink[400]} strokeWidth={2} />
              </View>
            </Glass>
          </Animated.View>
        ))}
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
});
