import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MessageCircle,
  Video,
  XCircle,
} from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useBooking, useCancelBooking } from '@/hooks/queries';
import { JoinVideoCallButton } from '@/components/features/JoinVideoCallButton';

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const { data: booking } = useBooking(id);
  const cancelMutation = useCancelBooking();
  const cancelling = cancelMutation.isPending;

  const therapistName = booking
    ? (dir.isRTL
        ? booking.employee?.nameAr ?? booking.employee?.nameEn
        : booking.employee?.nameEn ?? booking.employee?.nameAr) ?? '—'
    : '—';
  const isOnline = booking?.bookingType === 'online';
  const scheduledDate = booking
    ? new Date(booking.scheduledAt).toLocaleDateString(dir.isRTL ? 'ar-SA' : 'en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : '—';
  const scheduledTime = booking
    ? `${new Date(booking.scheduledAt).toLocaleTimeString(dir.isRTL ? 'ar-SA' : 'en-US', {
        hour: 'numeric', minute: '2-digit',
      })} · ${booking.durationMins} ${dir.isRTL ? 'دقيقة' : 'min'}`
    : '—';
  const branchLocation = booking
    ? (dir.isRTL
        ? booking.branch?.nameAr ?? booking.branch?.nameEn
        : booking.branch?.nameEn ?? booking.branch?.nameAr) ?? '—'
    : '—';

  const rows = [
    { icon: <Calendar size={18} color={sawaaColors.teal[600]} strokeWidth={1.75} />, color: sawaaColors.teal[600], labelAr: 'التاريخ', labelEn: 'Date', value: scheduledDate },
    { icon: <Clock size={18} color={sawaaColors.accent.amber} strokeWidth={1.75} />, color: sawaaColors.accent.amber, labelAr: 'الوقت', labelEn: 'Time', value: scheduledTime },
    { icon: <Video size={18} color={sawaaColors.accent.violet} strokeWidth={1.75} />, color: sawaaColors.accent.violet, labelAr: 'نوع الجلسة', labelEn: 'Session type', value: isOnline ? (dir.isRTL ? 'جلسة فيديو' : 'Video call') : (dir.isRTL ? 'حضوري' : 'In person') },
    { icon: <MapPin size={18} color={sawaaColors.accent.rose} strokeWidth={1.75} />, color: sawaaColors.accent.rose, labelAr: 'الموقع', labelEn: 'Location', value: isOnline ? (dir.isRTL ? 'رابط سيُرسل قبل الموعد' : 'Link sent before session') : branchLocation },
  ];

  const askCancel = () => {
    if (!id || cancelling) return;
    Alert.alert(
      dir.isRTL ? 'إلغاء الحجز' : 'Cancel booking',
      dir.isRTL ? 'هل تريد إلغاء هذا الحجز؟' : 'Cancel this booking?',
      [
        { text: dir.isRTL ? 'رجوع' : 'Back', style: 'cancel' },
        {
          text: dir.isRTL ? 'إلغاء الحجز' : 'Cancel',
          style: 'destructive',
          onPress: () => {
            cancelMutation.mutate(
              { id, reason: dir.isRTL ? 'إلغاء من العميل' : 'Client cancelled' },
              {
                onSuccess: () => router.back(),
                onError: (err) => {
                  Alert.alert(
                    dir.isRTL ? 'تعذّر الإلغاء' : 'Cancel failed',
                    err instanceof Error ? err.message : String(err),
                  );
                },
              },
            );
          },
        },
      ],
    );
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(500)}>
          <Glass variant="strong" radius={22} onPress={() => router.back()} interactive style={styles.backBtn}>
            <BackIcon size={22} color={sawaaColors.ink[700]} strokeWidth={1.75} />
          </Glass>
        </Animated.View>

        {/* Hero therapist */}
        <Animated.View entering={FadeInDown.delay(80).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.heroCard}>
            <View style={[styles.heroRow, { flexDirection: dir.row }]}>
              <LinearGradient
                colors={['#f7cbb7', '#e88f6c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={[styles.avatarText, { fontFamily: f700 }]}>ف</Text>
                <View style={styles.onlineDot} />
              </LinearGradient>
              <View style={styles.heroMid}>
                <Text style={[styles.heroName, { fontFamily: f700, textAlign: dir.textAlign }]}>
                  {therapistName}
                </Text>
                <Text style={[styles.heroSpec, { fontFamily: f400, textAlign: dir.textAlign }]}>
                  {(dir.isRTL ? booking?.service?.nameAr : booking?.service?.nameEn) ?? ''}
                </Text>
                <View style={[styles.statusChip, { flexDirection: dir.row }]}>
                  <View style={styles.statusDot} />
                  <Text style={[styles.statusText, { fontFamily: f600 }]}>
                    {dir.isRTL ? 'مؤكدة · قريباً' : 'Confirmed · Upcoming'}
                  </Text>
                </View>
              </View>
            </View>
          </Glass>
        </Animated.View>

        {/* Rows */}
        <Animated.View entering={FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.card}>
            {rows.map((r, i) => (
              <View
                key={`row-${i}`}
                style={[
                  styles.row,
                  { flexDirection: dir.row },
                  i < rows.length - 1 && styles.rowDivider,
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: `${r.color}1e` }]}>{r.icon}</View>
                <View style={styles.rowMid}>
                  <Text style={[styles.rowLabel, { fontFamily: f400, textAlign: dir.textAlign }]}>
                    {dir.isRTL ? r.labelAr : r.labelEn}
                  </Text>
                  <Text style={[styles.rowValue, { fontFamily: f700, textAlign: dir.textAlign }]}>
                    {r.value}
                  </Text>
                </View>
              </View>
            ))}
          </Glass>
        </Animated.View>

        {/* Notes */}
        <Animated.View entering={FadeInDown.delay(240).duration(700).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'ملاحظات' : 'Notes'}
          </Text>
          <Glass variant="regular" radius={sawaaRadius.xl} style={styles.notesCard}>
            <Text style={[styles.notesText, { fontFamily: f400, textAlign: dir.textAlign }]}>
              {dir.isRTL
                ? 'سنتناول تقنيات الاسترخاء التدريجي. يُرجى تحضير مفكرة الأفكار التلقائية.'
                : 'We will cover progressive relaxation. Please bring your thought log.'}
            </Text>
          </Glass>
        </Animated.View>
      </ScrollView>

      {/* Bottom actions */}
      <Animated.View
        entering={FadeInDown.delay(360).duration(800).easing(Easing.out(Easing.cubic))}
        style={[styles.ctaWrap, { bottom: insets.bottom + 20, flexDirection: dir.row }]}
      >
        <Pressable onPress={() => router.push('/(client)/chat')} style={styles.secondaryBtn}>
          <Glass variant="strong" radius={sawaaRadius.pill} style={styles.secondaryGlass}>
            <MessageCircle size={18} color={sawaaColors.teal[700]} strokeWidth={1.75} />
            <Text style={[styles.secondaryText, { fontFamily: f600 }]}>
              {dir.isRTL ? 'محادثة' : 'Chat'}
            </Text>
          </Glass>
        </Pressable>
        {isOnline && booking ? (
          <JoinVideoCallButton
            url={booking.zoomJoinUrl}
            scheduledAt={booking.scheduledAt}
            durationMins={booking.durationMins}
            status={booking.zoomMeetingStatus}
            isRTL={dir.isRTL}
            variant="join"
          />
        ) : (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/(client)/video-call', params: id ? { bookingId: id } : {} })
            }
            style={styles.primaryBtn}
          >
            <LinearGradient
              colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGradient}
            >
              <Video size={18} color="#fff" strokeWidth={1.75} />
              <Text style={[styles.primaryText, { fontFamily: f700 }]}>
                {dir.isRTL ? 'ابدأ الجلسة' : 'Start session'}
              </Text>
            </LinearGradient>
          </Pressable>
        )}
      </Animated.View>

      {/* Cancel link */}
      <Animated.View
        entering={FadeInDown.delay(460).duration(800).easing(Easing.out(Easing.cubic))}
        style={[styles.cancelRow, { bottom: insets.bottom + 80 }]}
      >
        <Pressable onPress={askCancel} disabled={cancelling} style={styles.cancelBtn}>
          <XCircle size={14} color={sawaaColors.accent.coral} strokeWidth={2} />
          <Text style={[styles.cancelText, { fontFamily: f500 }]}>
            {cancelling
              ? (dir.isRTL ? 'جاري الإلغاء…' : 'Cancelling…')
              : (dir.isRTL ? 'إلغاء الحجز' : 'Cancel booking')}
          </Text>
        </Pressable>
      </Animated.View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  heroCard: { padding: 16 },
  heroRow: { alignItems: 'center', gap: 14 },
  avatar: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  avatarText: { fontSize: 26, color: '#fff' },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#4bd67a', borderWidth: 2, borderColor: '#fff',
  },
  heroMid: { flex: 1 },
  heroName: { fontSize: 16, color: sawaaColors.ink[900] },
  heroSpec: { fontSize: 12, color: sawaaColors.ink[500], marginTop: 2 },
  statusChip: {
    alignItems: 'center', gap: 6, marginTop: 8,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(20,168,154,0.14)', alignSelf: 'flex-start',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: sawaaColors.teal[500] },
  statusText: { fontSize: 11, color: sawaaColors.teal[700] },
  card: { padding: 0 },
  row: { alignItems: 'center', gap: 14, padding: 14 },
  rowDivider: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.5)' },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowMid: { flex: 1 },
  rowLabel: { fontSize: 11, color: sawaaColors.ink[500] },
  rowValue: { fontSize: 13.5, color: sawaaColors.ink[900], marginTop: 2 },
  sectionTitle: { fontSize: 14, color: sawaaColors.ink[900], marginBottom: 8, paddingHorizontal: 4 },
  notesCard: { padding: 14 },
  notesText: { fontSize: 12.5, color: sawaaColors.ink[700], lineHeight: 22 },
  ctaWrap: { position: 'absolute', left: 16, right: 16, gap: 10, alignItems: 'stretch' },
  secondaryBtn: { flex: 1 },
  secondaryGlass: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, gap: 8,
  },
  secondaryText: { color: sawaaColors.teal[700], fontSize: 13 },
  primaryBtn: { flex: 1.4 },
  primaryGradient: {
    borderRadius: 999, height: 52,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: sawaaColors.teal[600], shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  primaryText: { color: '#fff', fontSize: 13.5 },
  cancelRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cancelText: { fontSize: 12, color: sawaaColors.accent.coral },
});
