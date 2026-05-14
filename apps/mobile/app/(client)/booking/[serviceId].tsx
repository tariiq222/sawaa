import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Building2, ChevronLeft, ChevronRight, Video } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

type BookingType = 'in_person' | 'online';

export default function BookingTypeScreen() {
  const { serviceId, employeeId } = useLocalSearchParams<{ serviceId: string; employeeId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;

  const types = [
    {
      type: 'in_person' as BookingType,
      icon: Building2,
      color: sawaaColors.teal[600],
      labelAr: 'موعد عيادة',
      labelEn: 'In-clinic visit',
      descAr: 'زيارة شخصية في العيادة',
      descEn: 'In-person at the clinic',
    },
    {
      type: 'online' as BookingType,
      icon: Video,
      color: sawaaColors.accent.violet,
      labelAr: 'استشارة عن بُعد',
      labelEn: 'Remote consultation',
      descAr: 'مرئي أو هاتفي — سيؤكد المعالج الطريقة',
      descEn: 'Video or phone — confirmed by therapist',
    },
  ];

  const handleSelect = (type: BookingType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(client)/booking/schedule',
      params: { serviceId, employeeId: employeeId ?? '', type },
    });
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back + progress */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <View style={[styles.topRow, { flexDirection: dir.row }]}>
            <Glass variant="strong" radius={22} onPress={() => router.back()} interactive style={styles.backBtn}>
              <BackIcon size={22} color={sawaaColors.ink[700]} strokeWidth={1.75} />
            </Glass>
            <Text style={[styles.step, { fontFamily: f600 }]}>
              {dir.isRTL ? 'خطوة ١ من ٣' : 'Step 1 of 3'}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '33%' }]} />
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'اختر نوع الزيارة' : 'Select visit type'}
          </Text>
        </Animated.View>

        {/* Type cards — tap to select + advance */}
        {types.map((item, i) => (
          <Animated.View
            key={item.type}
            entering={FadeInDown.delay(160 + i * 80).duration(700).easing(Easing.out(Easing.cubic))}
          >
            <Glass
              variant="strong"
              radius={sawaaRadius.xl}
              onPress={() => handleSelect(item.type)}
              interactive
              style={styles.typeCard}
            >
              <View style={[styles.typeRow, { flexDirection: dir.row }]}>
                <View style={[styles.typeIcon, { backgroundColor: `${item.color}1e` }]}>
                  <item.icon size={22} strokeWidth={1.75} color={item.color} />
                </View>
                <View style={styles.typeMid}>
                  <Text style={[styles.typeLabel, { fontFamily: f700, textAlign: dir.textAlign }]}>
                    {dir.isRTL ? item.labelAr : item.labelEn}
                  </Text>
                  <Text style={[styles.typeDesc, { fontFamily: f400, textAlign: dir.textAlign }]}>
                    {dir.isRTL ? item.descAr : item.descEn}
                  </Text>
                </View>
                <BackIcon size={16} color={sawaaColors.ink[400]} strokeWidth={2} style={{ transform: [{ scaleX: -1 }] }} />
              </View>
            </Glass>
          </Animated.View>
        ))}
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },
  topRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  step: { fontSize: 12, color: sawaaColors.ink[500] },
  progressTrack: {
    height: 4, borderRadius: 2, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginBottom: 8,
  },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: sawaaColors.teal[600] },
  title: { fontSize: 22, color: sawaaColors.ink[900], marginVertical: 8, paddingHorizontal: 4 },
  typeCard: { padding: 16 },
  typeRow: { alignItems: 'center', gap: 14 },
  typeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  typeMid: { flex: 1 },
  typeLabel: { fontSize: 15, color: sawaaColors.ink[900] },
  typeDesc: { fontSize: 12, color: sawaaColors.ink[500], marginTop: 2 },
});
