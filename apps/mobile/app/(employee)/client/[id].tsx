import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  ChevronLeft,
  Phone,
  Mail,
  Calendar,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/theme/components/ThemedText';
import { ThemedCard } from '@/theme/components/ThemedCard';
import { Avatar } from '@/components/ui/Avatar';
import { StatusPill } from '@/components/ui/StatusPill';
import { useTheme } from '@/theme/useTheme';
import { clientsService, type ClientRecord } from '@/services/clients';
import { getStatusLabel } from '@/lib/status-helpers';
import type { Booking } from '@/types/models';

export default function DoctorClientRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isRTL } = useTheme();

  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [visits, setVisits] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.allSettled([
      clientsService.getById(id),
      clientsService.getEmployeeBookings(id),
    ]).then(([clientResult, bookingsResult]) => {
      if (clientResult.status === 'fulfilled' && clientResult.value.success && clientResult.value.data) {
        setClient(clientResult.value.data);
      } else {
        setError(t('common.error'));
      }
      if (bookingsResult.status === 'fulfilled' && bookingsResult.value.success) {
        setVisits(bookingsResult.value.data.items ?? []);
      }
      setLoading(false);
    });
  }, [id, t]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.surface }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !client) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.surface }]}>
        <ThemedText>{error ?? t('doctor.clientNotFound')}</ThemedText>
      </View>
    );
  }

  const fullName = `${client.firstName} ${client.lastName}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <BackIcon size={24} strokeWidth={1.5} color={theme.colors.textPrimary} />
        </Pressable>

        <ThemedText variant="heading" style={styles.title}>
          {t('doctor.clientRecord')}
        </ThemedText>

        {/* Client Header */}
        <ThemedCard style={styles.profileCard}>
          <Avatar size={56} name={fullName} imageUrl={client.avatarUrl} />
          <View style={{ flex: 1, gap: 4 }}>
            <ThemedText variant="heading">{fullName}</ThemedText>
            {client.phone && (
              <Pressable
                onPress={() => Linking.openURL(`tel:${client.phone}`)}
                style={styles.contactRow}
              >
                <Phone size={14} strokeWidth={1.5} color={theme.colors.primary[500]} />
                <ThemedText variant="bodySm" color={theme.colors.primary[500]}>{client.phone}</ThemedText>
              </Pressable>
            )}
            <Pressable
              onPress={() => Linking.openURL(`mailto:${client.email}`)}
              style={styles.contactRow}
            >
              <Mail size={14} strokeWidth={1.5} color={theme.colors.primary[500]} />
              <ThemedText variant="bodySm" color={theme.colors.primary[500]}>{client.email}</ThemedText>
            </Pressable>
          </View>
        </ThemedCard>

        {/* Visit History */}
        <ThemedText variant="subheading" style={styles.sectionTitle}>
          {t('doctor.visitHistory')}
        </ThemedText>

        {visits.length === 0 ? (
          <View style={styles.empty}>
            <Calendar size={40} strokeWidth={1} color={theme.colors.textMuted} />
            <ThemedText variant="bodySm" color={theme.colors.textMuted} align="center">
              {t('common.noResults')}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.visitList}>
            {visits.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => router.push(`/(employee)/appointment/${v.id}`)}
              >
                <ThemedCard style={styles.visitCard}>
                  <View style={styles.visitRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <ThemedText variant="body" style={{ fontWeight: '500' }}>
                        {t(`bookings.type.${v.type}`)}
                      </ThemedText>
                      <ThemedText variant="caption" color={theme.colors.textSecondary}>
                        {new Date(v.date).toLocaleDateString('ar-SA', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </ThemedText>
                    </View>
                    <StatusPill status={v.status} label={t(getStatusLabel(v.status))} />
                  </View>
                </ThemedCard>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { marginBottom: 16 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, marginBottom: 24 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { marginBottom: 12 },
  visitList: { gap: 8 },
  visitCard: { padding: 14 },
  visitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { alignItems: 'center', gap: 12, paddingTop: 40 },
});
