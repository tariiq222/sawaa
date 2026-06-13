import { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, Linking, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronLeft, Phone, Mail } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AquaBackground,
  GlassSurface,
  sawaaColors,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
} from '@/theme/sawaa';
import { Avatar } from '@/components/ui/Avatar';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { clientsService, type ClientRecord } from '@/services/clients';
import { getStatusLabel } from '@/lib/status-helpers';
import type { Booking } from '@/types/models';

export default function DoctorClientRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;

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
      <AquaBackground>
        <View style={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.md }]}>
          <Skeleton width={44} height={44} radius={sawaaRadius.pill} style={styles.loaderBlock} />
          <Skeleton width="50%" height={24} radius={sawaaRadius.sm} style={styles.loaderBlock} />
          <Skeleton height={104} radius={sawaaRadius.xl} style={styles.loaderBlock} />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={68} radius={sawaaRadius.lg} style={styles.loaderRow} />
          ))}
        </View>
      </AquaBackground>
    );
  }

  if (error || !client) {
    return (
      <AquaBackground>
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <EmptyState
            icon="alert-circle-outline"
            tone="danger"
            title={error ?? t('doctor.clientNotFound')}
            actionLabel={t('common.back')}
            onAction={() => router.back()}
          />
        </View>
      </AquaBackground>
    );
  }

  const fullName = `${client.firstName} ${client.lastName}`;

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: insets.bottom + sawaaSpacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <GlassSurface variant="base" radius={sawaaRadius.pill} style={styles.backCircle}>
            <View style={styles.backInner}>
              <BackIcon size={22} strokeWidth={1.5} color={sawaaColors.ink[900]} />
            </View>
          </GlassSurface>
        </Pressable>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {t('doctor.clientRecord')}
          </Text>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(100).duration(600).easing(Easing.out(Easing.cubic))}>
          <GlassSurface variant="strong" radius={sawaaRadius.xl} padding={sawaaSpacing.lg} style={styles.profileCard}>
            <View style={[styles.profileRow, { flexDirection: dir.row }]}>
              <Avatar size={56} name={fullName} imageUrl={client.avatarUrl} color={sawaaColors.teal[600]} />
              <View style={styles.profileMid}>
                <Text style={[styles.profileName, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                  {fullName}
                </Text>
                {client.phone && (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${client.phone}`)}
                    accessibilityRole="button"
                    style={[styles.contactRow, { flexDirection: dir.row }]}
                  >
                    <Phone size={14} strokeWidth={1.5} color={sawaaColors.teal[700]} />
                    <Text style={[styles.contactText, { fontFamily: f400, fontWeight: '400' }]}>
                      {client.phone}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => Linking.openURL(`mailto:${client.email}`)}
                  accessibilityRole="button"
                  style={[styles.contactRow, { flexDirection: dir.row }]}
                >
                  <Mail size={14} strokeWidth={1.5} color={sawaaColors.teal[700]} />
                  <Text style={[styles.contactText, { fontFamily: f400, fontWeight: '400' }]}>
                    {client.email}
                  </Text>
                </Pressable>
              </View>
            </View>
          </GlassSurface>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(180).duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {t('doctor.visitHistory')}
          </Text>
        </Animated.View>

        {visits.length === 0 ? (
          <EmptyState icon="calendar-outline" title={t('common.noResults')} />
        ) : (
          <View style={styles.visitList}>
            {visits.map((v, index) => (
              <Animated.View
                key={v.id}
                entering={reduceMotion ? undefined : FadeInDown.delay(240 + index * 70).duration(600).easing(Easing.out(Easing.cubic))}
              >
                <Pressable
                  onPress={() => router.push(`/(employee)/appointment/${v.id}`)}
                  accessibilityRole="button"
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                >
                  <GlassSurface variant="base" radius={sawaaRadius.lg} padding={sawaaSpacing.lg}>
                    <View style={[styles.visitRow, { flexDirection: dir.row }]}>
                      <View style={styles.visitMid}>
                        <Text style={[styles.visitType, { fontFamily: f600, fontWeight: '600', textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                          {t(`bookings.type.${v.type}`)}
                        </Text>
                        <Text style={[styles.visitDate, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                          {new Date(v.date).toLocaleDateString('ar-SA', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                      <StatusPill status={v.status} label={t(getStatusLabel(v.status))} />
                    </View>
                  </GlassSurface>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: sawaaSpacing.xl },
  centered: { flex: 1, justifyContent: 'center' },
  loaderBlock: { marginBottom: sawaaSpacing.md },
  loaderRow: { marginBottom: sawaaSpacing.sm },
  backBtn: { alignSelf: 'flex-start', marginBottom: sawaaSpacing.sm },
  backCircle: { width: 44, height: 44 },
  backInner: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: sawaaColors.ink[900],
    marginBottom: sawaaSpacing.lg,
  },
  profileCard: { marginBottom: sawaaSpacing['2xl'] },
  profileRow: { alignItems: 'center', gap: sawaaSpacing.lg },
  profileMid: { flex: 1, gap: sawaaSpacing.xs },
  profileName: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    color: sawaaColors.ink[900],
  },
  contactRow: { alignItems: 'center', gap: sawaaSpacing.xs },
  contactText: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: sawaaColors.teal[700],
  },
  sectionTitle: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    color: sawaaColors.ink[900],
    marginBottom: sawaaSpacing.md,
  },
  visitList: { gap: sawaaSpacing.sm },
  visitRow: { alignItems: 'center', gap: sawaaSpacing.md },
  visitMid: { flex: 1, gap: sawaaSpacing.xs },
  visitType: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.ink[900],
  },
  visitDate: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: sawaaColors.ink[500],
  },
});
