import React, { useMemo, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Banknote, Upload } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AquaBackground, sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { BackButton } from '@/components/ui/BackButton';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { clientPaymentsService, type ReceiptUploadAsset } from '@/services/client';
import { formatHalalas } from '@/lib/money';
import { useBankTransferSettings } from '@/hooks/queries';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { BankTransferAccountDetails } from '@/components/features/booking/BankTransferAccountDetails';

export default function BankTransferScreen() {
  const colors = useSawaaColors();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(colors, theme.colors), [colors, theme.colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const bankTransferQuery = useBankTransferSettings();
  const { invoiceId, amount, bookingId } = useLocalSearchParams<{
    invoiceId?: string;
    amount?: string;
    bookingId?: string;
  }>();
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');
  const [receipt, setReceipt] = useState<ReceiptUploadAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const uploaded = !!receipt;
  // amount is integer halalas (forwarded from payment.tsx).
  const numericAmount = amount ? Number(amount) : 0;
  const amountLabel = `${formatHalalas(numericAmount, { locale: dir.isRTL ? 'ar-SA' : 'en-US' })} ⃁`;
  const accounts = bankTransferQuery.data?.enabled ? bankTransferQuery.data.accounts : [];
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];

  const pickReceipt = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(dir.isRTL ? 'يلزم إذن المعرض' : 'Photo library permission required');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setReceipt({ uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName });
    }
  };

  const submitReceipt = async () => {
    if (!receipt || !invoiceId || !selectedAccount || submitting) return;
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert(dir.isRTL ? 'مبلغ غير صالح' : 'Invalid amount');
      return;
    }
    setSubmitting(true);
    try {
      const payment = await clientPaymentsService.uploadBankTransfer(invoiceId, numericAmount, receipt);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const successParams = bookingId
        ? { bookingId, invoiceId, paymentId: payment.id }
        : { invoiceId, paymentId: payment.id };
      router.replace({
        pathname: '/(client)/booking/success',
        params: successParams,
      });
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        dir.isRTL ? 'تعذّر رفع الإيصال' : 'Could not upload receipt',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}>
          <BackButton onPress={() => router.back()} style={{ alignSelf: dir.alignStart }} />
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <View style={[styles.titleRow, { flexDirection: dir.row }]}>
            <View style={styles.titleIcon}>
              <Banknote size={22} color={colors.accent.amber} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
                {dir.isRTL ? 'التحويل البنكي' : 'Bank transfer'}
              </Text>
              <Text style={[styles.subtitle, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
                {dir.isRTL ? 'حوّل المبلغ ثم ارفع الإيصال' : 'Transfer and upload receipt'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {bankTransferQuery.isLoading ? (
          <Skeleton height={190} radius={sawaaRadius.xl} />
        ) : !selectedAccount ? (
          <EmptyState
            icon="information-circle-outline"
            title={t('payment.bankTransferUnavailable')}
            actionLabel={t('common.back')}
            onAction={() => router.back()}
          />
        ) : (
          <>
            <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
              <BankTransferAccountDetails
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onSelectAccount={setSelectedAccountId}
                amountLabel={amountLabel}
              />
            </Animated.View>

        {/* Upload receipt */}
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(240).duration(700).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'إيصال التحويل' : 'Transfer receipt'}
          </Text>
          <Glass
            variant={uploaded ? 'strong' : 'regular'}
            radius={sawaaRadius.xl}
            onPress={pickReceipt}
            interactive
            style={styles.uploadCard}
          >
            <View style={styles.uploadInner}>
              <View style={[
                styles.uploadIcon,
                { backgroundColor: uploaded ? withAlpha(colors.teal[500], 0.18) : colors.glass.bgStrong },
              ]}>
                <Upload size={24} color={uploaded ? colors.teal[600] : colors.ink[500]} strokeWidth={1.75} />
              </View>
              <Text style={[styles.uploadTitle, { fontFamily: f700 }]}>
                {uploaded
                  ? (dir.isRTL ? 'تم رفع الإيصال' : 'Receipt uploaded')
                  : (dir.isRTL ? 'انقر لرفع صورة الإيصال' : 'Tap to upload receipt image')}
              </Text>
              <Text style={[styles.uploadSub, { fontFamily: f400, fontWeight: '400' }]}>
                {dir.isRTL ? 'PNG, JPG · حتى ١٠ ميجا' : 'PNG, JPG · max 10 MB'}
              </Text>
            </View>
          </Glass>
        </Animated.View>
          </>
        )}
      </ScrollView>

      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.delay(360).duration(700).easing(Easing.out(Easing.cubic))}
        style={[styles.ctaWrap, { bottom: insets.bottom + sawaaSpacing.xl }]}
      >
        <Pressable disabled={!uploaded || !selectedAccount || submitting} onPress={submitReceipt}>
          <LinearGradient
            colors={theme.colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.ctaBtn, (!uploaded || !selectedAccount || submitting) && { opacity: 0.55 }]}
          >
            <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>
              {submitting
                ? (dir.isRTL ? 'جاري الإرسال…' : 'Sending…')
                : (dir.isRTL ? 'إرسال للمراجعة' : 'Send for review')}
            </Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>, themeColors: ReturnType<typeof useTheme>['theme']['colors']) => StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  titleRow: { alignItems: 'center', gap: sawaaSpacing.md, paddingHorizontal: sawaaSpacing.xs },
  titleIcon: {
    width: 44,
    height: 44,
    borderRadius: sawaaRadius.md,
    backgroundColor: withAlpha(colors.accent.amber, 0.16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[500],
    marginTop: sawaaSpacing.xs,
  },
  sectionTitle: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[900],
    marginBottom: sawaaSpacing.sm,
    paddingHorizontal: sawaaSpacing.xs,
  },
  uploadCard: { padding: sawaaSpacing['2xl'] },
  uploadInner: { alignItems: 'center', gap: sawaaSpacing.md },
  uploadIcon: {
    width: 56,
    height: 56,
    borderRadius: sawaaRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[900],
  },
  uploadSub: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: colors.ink[500],
  },
  ctaWrap: { position: 'absolute', left: sawaaSpacing.lg, right: sawaaSpacing.lg },
  ctaBtn: {
    borderRadius: sawaaRadius.pill,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.teal[600],
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  ctaBtnText: {
    color: themeColors.primaryForeground,
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
  },
});
