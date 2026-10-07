import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Glass } from '@/theme/components/Glass';
import { sawaaRadius, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { getFontName } from '@/theme/fonts';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { resolveDeliveryType } from '@/types/booking-enums';
import type { ClientBookingRow } from '@/services/client/bookings';

interface RecordCardProps {
  booking: ClientBookingRow;
  index: number;
  onPress: () => void;
}

export function RecordCard({ booking, index, onPress }: RecordCardProps) {
  const colors = useSawaaColors();
  const { theme } = useTheme();
  const dir = useDir();
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;
  const name = (dir.isRTL ? booking.employee?.nameAr ?? booking.employee?.nameEn : booking.employee?.nameEn ?? booking.employee?.nameAr) ?? '—';
  const service = (dir.isRTL ? booking.service?.nameAr ?? booking.service?.nameEn : booking.service?.nameEn ?? booking.service?.nameAr) ?? '';
  const locale = dir.isRTL ? 'ar-SA' : 'en-US';
  const date = new Date(booking.scheduledAt).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  const time = new Date(booking.scheduledAt).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const label = [t('booking.viewAppointment'), name, service, date, time].filter(Boolean).join(' · ');

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(120 + Math.min(index, 5) * 60).duration(550).easing(Easing.out(Easing.cubic))}>
      <Glass variant="strong" radius={sawaaRadius.xl}>
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.inner}>
          <View style={[styles.row, { flexDirection: dir.row }]}>
            <LinearGradient colors={theme.colors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
              <Text style={{ fontFamily: f700, fontSize: 18, color: theme.colors.primaryForeground }}>{name.charAt(0)}</Text>
            </LinearGradient>
            <View style={styles.mid}>
              <Text style={{ fontFamily: f700, fontSize: 14, textAlign: dir.textAlign, color: colors.ink[900] }}>{name}</Text>
              {service ? <Text style={{ fontFamily: f400, fontSize: 12, textAlign: dir.textAlign, color: colors.ink[500] }}>{service}</Text> : null}
            </View>
            <Chevron size={16} color={colors.ink[400]} strokeWidth={2} />
          </View>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: withAlpha(colors.ink[900], 0.1) }} />
          <View style={[styles.bottom, { flexDirection: dir.row }]}>
            {[{ label: t('records.date'), value: date }, { label: t('records.time'), value: time }].map((entry) => (
              <View key={entry.label} style={{ flex: 1, gap: 2, alignItems: dir.isRTL ? 'flex-end' : 'flex-start' }}>
                <Text style={{ fontFamily: f400, fontSize: 11, color: colors.ink[400] }}>{entry.label}</Text>
                <Text style={{ fontFamily: f600, fontSize: 13, color: colors.ink[900] }}>{entry.value}</Text>
              </View>
            ))}
            {resolveDeliveryType(booking.deliveryType) === 'online' ? (
              <View style={[styles.tag, { backgroundColor: withAlpha(colors.teal[600], 0.12) }]}>
                <Video size={11} color={colors.teal[700]} strokeWidth={2} />
                <Text style={{ fontFamily: f600, fontSize: 11, color: colors.teal[700] }}>{t('records.video')}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  inner: { padding: 14, gap: 12 },
  row: { alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  mid: { flex: 1, gap: 3 },
  bottom: { alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
});
