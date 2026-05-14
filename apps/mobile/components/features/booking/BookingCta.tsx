import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import type { DirState } from '@/hooks/useDir';
import { formatTime, type Slot } from './TimeSlotsGrid';

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface BookingCtaProps {
  selectedDay: Date;
  selectedSlot: Slot | null;
  onConfirm: () => void;
  bottomInset: number;
  dir: DirState;
  f400: string;
  f700: string;
}

export function BookingCta({
  selectedDay,
  selectedSlot,
  onConfirm,
  bottomInset,
  dir,
  f400,
  f700,
}: BookingCtaProps) {
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;
  const dayLabel = dir.isRTL ? DAYS_AR[selectedDay.getDay()] : DAYS_EN_SHORT[selectedDay.getDay()];
  const dayNum = dir.isRTL ? selectedDay.getDate().toLocaleString('ar-SA') : selectedDay.getDate();

  return (
    <Animated.View
      entering={FadeInDown.delay(420).duration(800).easing(Easing.out(Easing.cubic))}
      style={[styles.ctaWrap, { bottom: bottomInset + 20 }]}
    >
      <Glass variant="strong" radius={sawaaRadius.pill} style={styles.ctaPill}>
        <View style={[styles.ctaRow, { flexDirection: dir.row }]}>
          <View style={styles.ctaSummary}>
            <Text style={[styles.ctaSummaryTop, { fontFamily: f400 }]}>
              {selectedSlot
                ? `${dayLabel} ${dayNum} · ${formatTime(selectedSlot.startTime, dir.isRTL)}`
                : dir.isRTL
                  ? 'اختاري وقتاً'
                  : 'Pick a time'}
            </Text>
            <Text style={[styles.ctaSummaryBot, { fontFamily: f700 }]}>
              {dir.isRTL ? 'تأمين مقبول' : 'Insurance accepted'}
            </Text>
          </View>
          <Pressable onPress={onConfirm} disabled={!selectedSlot} style={styles.ctaBtnPress}>
            <LinearGradient
              colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.ctaBtn, !selectedSlot && { opacity: 0.55 }]}
            >
              <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>
                {dir.isRTL ? 'تأكيد' : 'Confirm'}
              </Text>
              <GoIcon size={14} color="#fff" strokeWidth={2} />
            </LinearGradient>
          </Pressable>
        </View>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ctaWrap: { position: 'absolute', left: 16, right: 16 },
  ctaPill: { padding: 6 },
  ctaRow: { alignItems: 'center', gap: 8, height: 46 },
  ctaSummary: { flex: 1, paddingHorizontal: 10 },
  ctaSummaryTop: { fontSize: 10, color: sawaaColors.ink[500] },
  ctaSummaryBot: { fontSize: 12, color: sawaaColors.ink[900], marginTop: 2 },
  ctaBtnPress: { height: 46 },
  ctaBtn: {
    paddingHorizontal: 18,
    borderRadius: 999,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: sawaaColors.teal[600],
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  ctaBtnText: { color: '#fff', fontSize: 13 },
});
