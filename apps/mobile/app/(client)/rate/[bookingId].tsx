import React, { useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AquaBackground, PrimaryButton, sawaaRadius, sawaaSpacing } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { EmptyState } from '@/components/ui/EmptyState';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Thumb } from '@/components/ui/Thumb';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useBooking, useRateBooking } from '@/hooks/queries';
import { formatWeekdayDateTime } from '@/lib/session-format';

export default function RateScreen() {
  const colors = useSawaaColors();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const rateMutation = useRateBooking();
  const submitting = rateMutation.isPending;
  const { data: booking, isLoading, isError, refetch } = useBooking(bookingId);

  // The therapist identity comes from the rated booking — never a placeholder.
  const therapistName = booking
    ? (dir.isRTL
        ? booking.employee?.nameAr ?? booking.employee?.nameEn ?? booking.employeeNameAr ?? booking.employeeName
        : booking.employee?.nameEn ?? booking.employee?.nameAr ?? booking.employeeName ?? booking.employeeNameAr)
    : undefined;
  const displayName = therapistName ?? t('therapists.unknownName');
  const sessionWhen = formatWeekdayDateTime(booking?.scheduledAt, dir.isRTL);

  // Rating is only allowed against a booking we actually loaded: while the
  // request is in flight, or after it failed, there is no verified subject to
  // rate — the user gets the retry action instead of a blind submission.
  const bookingReady = Boolean(booking) && !isLoading && !isError;
  const alreadyRatedThisSession = booking?.ratingSubmittedLocally === true;
  const submitDisabled = rating === 0 || submitting || !bookingReady || alreadyRatedThisSession;

  const submit = () => {
    if (rating === 0 || !bookingId || submitting || !bookingReady) return;
    const comment = note.trim();
    rateMutation.mutate(
      {
        id: bookingId,
        score: rating,
        comment: comment || undefined,
        isPublic: true,
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: (error) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          const responseMessage = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
          const duplicateRating = typeof responseMessage === 'string'
            && responseMessage.toLowerCase().includes('rating already submitted');
          Alert.alert(
            duplicateRating ? t('appointments.ratingAlreadySubmitted') : t('appointments.rateFailed'),
            duplicateRating
              ? t('appointments.ratingAlreadySubmitted')
              : error instanceof Error ? error.message : String(error),
          );
        },
      },
    );
  };

  const submitLabel = alreadyRatedThisSession
    ? t('appointments.ratingAlreadySubmitted')
    : submitting ? t('appointments.rateSubmitting') : t('appointments.rateSubmit');

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 160 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader title={t('appointments.rateScreenTitle')} onBack={() => router.back()} />

        {/* Therapist — real booking data, or a retryable load error */}
        {isLoading ? (
          <Skeleton height={76} radius={sawaaRadius.lg} />
        ) : isError ? (
          <EmptyState
            icon="alert-circle-outline"
            title={t('common.error')}
            actionLabel={t('common.retry')}
            onAction={() => { void refetch(); }}
            tone="danger"
          />
        ) : (
          <Glass variant="base" radius={sawaaRadius.lg} style={styles.therapistCard}>
            <View style={[styles.therapistRow, { flexDirection: dir.row }]}>
              <Thumb uri={booking?.employee?.avatarUrl} width={56} height={56} accessibilityLabel={displayName} />
              <View style={styles.therapistMid}>
                <Text numberOfLines={1} style={[styles.therapistName, { color: colors.ink[900], fontFamily: f700, textAlign: dir.textAlign }]}>
                  {displayName}
                </Text>
                {sessionWhen ? (
                  <Text numberOfLines={1} style={[styles.therapistMeta, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>
                    {sessionWhen}
                  </Text>
                ) : null}
              </View>
            </View>
          </Glass>
        )}

        <View style={styles.ratingBlock}>
          <Text accessibilityRole="header" style={[styles.question, { color: colors.ink[900], fontFamily: f700 }]}>
            {t('appointments.rateQuestion')}
          </Text>
          <View style={[styles.stars, { flexDirection: dir.row }]}>
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = n <= rating;
              return (
                <Pressable
                  key={n}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setRating(n);
                  }}
                  style={styles.starBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.rateStars', { count: n })}
                  accessibilityState={{ selected: filled }}
                >
                  <Star
                    size={40}
                    color={filled ? colors.accent.amber : colors.ink[400]}
                    fill={filled ? colors.accent.amber : 'transparent'}
                    strokeWidth={1.75}
                  />
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.ratingLabel, { color: colors.teal[700], fontFamily: f600 }]}>
            {rating > 0 ? t(`appointments.rateLabel${rating}`) : ' '}
          </Text>
        </View>

        <View style={styles.notes}>
          <Text style={[styles.notesLabel, { color: colors.ink[900], fontFamily: f600, textAlign: dir.textAlign }]}>
            {t('appointments.rateNotesLabel')}
          </Text>
          <Glass variant="base" radius={sawaaRadius.lg} style={styles.noteCard}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('appointments.rateNotesPlaceholder')}
              placeholderTextColor={colors.ink[500]}
              multiline
              numberOfLines={4}
              accessibilityLabel={t('appointments.rateNotesLabel')}
              style={[
                styles.noteInput,
                { fontFamily: f400, textAlign: dir.textAlign, writingDirection: dir.writingDirection, color: colors.ink[900] },
              ]}
            />
          </Glass>
        </View>
      </ScrollView>

      <FloatingCta>
        <PrimaryButton label={submitLabel} onPress={submit} disabled={submitDisabled} fontFamily={f700} />
      </FloatingCta>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.xl },
  therapistCard: { padding: sawaaSpacing.lg },
  therapistRow: { alignItems: 'center', gap: sawaaSpacing.md },
  therapistMid: { flex: 1, minWidth: 0, gap: 2 },
  therapistName: { fontSize: 16, lineHeight: 22 },
  therapistMeta: { fontSize: 14, lineHeight: 20 },
  ratingBlock: { alignItems: 'center', gap: sawaaSpacing.sm },
  question: { fontSize: 20, lineHeight: 28, textAlign: 'center' },
  stars: { justifyContent: 'center', gap: sawaaSpacing.xs },
  starBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  ratingLabel: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  notes: { gap: sawaaSpacing.sm },
  notesLabel: { fontSize: 14, lineHeight: 20 },
  noteCard: { padding: sawaaSpacing.lg },
  noteInput: { fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
});
