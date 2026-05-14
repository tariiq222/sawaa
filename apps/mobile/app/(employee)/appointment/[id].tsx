import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  ChevronLeft,
  Building2,
  Video,
  Calendar,
  Clock,
  Check,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedButton } from '@/theme/components/ThemedButton';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/theme/useTheme';
import { employeeBookingsService as bookingsService } from '@/services/employee/bookings';
import { getStatusLabel } from '@/lib/status-helpers';
import type { Booking } from '@/types/models';
import { JoinVideoCallButton } from '@/components/features/JoinVideoCallButton';

const TYPE_META: Record<string, { icon: React.ElementType; color: string }> = {
  in_person: { icon: Building2, color: '#1D4ED8' },
  online: { icon: Video, color: '#7C3AED' },
  walk_in: { icon: Building2, color: '#059669' },
  group: { icon: Building2, color: '#7C3AED' },
};

export default function DoctorAppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    bookingsService
      .getById(id)
      .then((res) => { if (res.data) setBooking(res.data); })
      .finally(() => setLoading(false));
  }, [id]);

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: theme.colors.surface }]}>
        <ActivityIndicator size="large" color="#1D4ED8" />
      </View>
    );
  }

  if (!booking) return null;

  const meta = TYPE_META[booking.type] ?? TYPE_META.in_person;
  const TypeIcon = meta.icon;

  const handleMarkComplete = () => {
    Alert.alert(t('doctor.markCompleted'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          try {
            await bookingsService.markCompleted(booking.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(t('common.error'), t('common.error'));
          }
        },
      },
    ]);
  };

  const handleStartSession = () => {
    Alert.alert(t('doctor.startSession'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          try {
            await bookingsService.startSession(booking.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Reload booking
            bookingsService.getById(booking.id).then((res) => {
              if (res.data) setBooking(res.data);
            });
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(t('common.error'), t('common.error'));
          }
        },
      },
    ]);
  };

  const handleEmployeeCancel = () => {
    Alert.alert(t('doctor.cancelBooking'), t('doctor.cancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await bookingsService.employeeCancel(booking.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          } catch {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(t('common.error'), t('common.error'));
          }
        },
      },
    ]);
  };

  const isCheckedIn = !!booking.checkedInAt;
  const canStartSession = booking.status === 'confirmed' && !isCheckedIn;
  const canComplete = booking.status === 'confirmed' && isCheckedIn;
  const canCancel = booking.status === 'confirmed' || booking.status === 'pending';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <BackIcon size={24} strokeWidth={1.5} color={theme.colors.textPrimary} />
        </Pressable>

        <View style={styles.headerRow}>
          <ThemedText variant="heading">{t('appointments.details')}</ThemedText>
          <StatusPill status={booking.status} label={t(getStatusLabel(booking.status))} />
        </View>

        {/* Booking Info */}
        <ThemedCard style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={[styles.iconCircle, { backgroundColor: `${meta.color}14` }]}>
              <TypeIcon size={16} strokeWidth={1.5} color={meta.color} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="body" style={{ fontWeight: '500' }}>
                {t(`booking.${booking.type === 'in_person' ? 'inPerson' : booking.type === 'walk_in' ? 'walkIn' : booking.type === 'group' ? 'group' : 'online'}`)}
              </ThemedText>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.iconCircle, { backgroundColor: '#1D4ED814' }]}>
              <Calendar size={16} strokeWidth={1.5} color="#1D4ED8" />
            </View>
            <ThemedText variant="body">
              {new Date(booking.date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'long', day: 'numeric' })}
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.iconCircle, { backgroundColor: '#F59E0B14' }]}>
              <Clock size={16} strokeWidth={1.5} color="#F59E0B" />
            </View>
            <ThemedText variant="body">{booking.startTime} — {booking.endTime}</ThemedText>
          </View>
        </ThemedCard>

        {/* Actions */}
        <View style={styles.actions}>
          {canStartSession && (
            <ThemedButton
              onPress={handleStartSession}
              variant="primary"
              size="lg"
              full
              icon={<Check size={16} color="#FFF" />}
            >
              {t('doctor.startSession')}
            </ThemedButton>
          )}
          {canComplete && (
            <ThemedButton
              onPress={handleMarkComplete}
              variant="secondary"
              size="lg"
              full
              icon={<Check size={16} color="#FFF" />}
            >
              {t('doctor.markCompleted')}
            </ThemedButton>
          )}
          {canCancel && (
            <ThemedButton
              onPress={handleEmployeeCancel}
              variant="ghost"
              size="lg"
              full
            >
              {t('doctor.cancelBooking')}
            </ThemedButton>
          )}
          {booking.type === 'online' && booking.zoomMeetingStatus && booking.scheduledAt && booking.durationMins ? (
            <JoinVideoCallButton
              url={booking.zoomStartUrl ?? booking.zoomJoinUrl ?? null}
              scheduledAt={booking.scheduledAt}
              durationMins={booking.durationMins}
              status={booking.zoomMeetingStatus}
              isRTL={isRTL}
              variant="start"
            />
          ) : booking.type === 'online' && booking.zoomLink ? (
            <ThemedButton
              onPress={() => Linking.openURL(booking.zoomLink!)}
              variant="primary"
              size="lg"
              full
            >
              {t('doctor.startMeeting')}
            </ThemedButton>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  infoCard: { padding: 16, gap: 12, marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: 12 },
});
