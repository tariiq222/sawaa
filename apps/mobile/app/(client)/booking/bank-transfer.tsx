import React, { useMemo, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
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
import { formatCurrencyAmount } from '@/lib/currency-display';
import { useBankTransferSettings, useClientInvoice } from '@/hooks/queries';
import { getOutstandingHalalas } from '@/lib/invoice-outstanding';
import { ErrorState } from '@/components/ui/ErrorState';
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
  const { invoiceId, bookingId } = useLocalSearchParams<{
    invoiceId?: string;
    bookingId?: string;
  }>();
  const invoiceQuery = useClientInvoice(invoiceId);
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');
  const [receipt, setReceipt] = useState<ReceiptUploadAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const selected = !!receipt;
  const readFailed = bankTransferQuery.isError || invoiceQuery.isError;
  // The transfer must match what the invoice still owes (total minus payments
  // already reserved), which the server enforces. Read it from the invoice
  // instead of trusting a price passed through the route, which ignores
  // discounts, coupons and earlier payments. Integer halalas.
  const outstanding = invoiceQuery.data ? getOutstandingHalalas(invoiceQuery.data) : null;
  const numericAmount = outstanding ?? 0;
  const amountLabel = formatCurrencyAmount(numericAmount, 'SAR', dir.isRTL);
  const accounts = bankTransferQuery.data?.enabled ? bankTransferQuery.data.accounts : [];
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];

  const pickReceipt = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('payment.photoLibraryPermissionRequired'));
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
    if (!receipt || !invoiceId || !selectedAccount || submitting || readFailed) return;
    if (!numericAmount || numericAmount <= 0) {
      Alert.alert(t('payment.invalidAmount'));
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
        t('payment.couldNotUploadReceipt'),
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
                {t('payment.bankTransferLabel')}
              </Text>
              <Text style={[styles.subtitle, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
                {t('payment.transferAndUploadReceipt')}
              </Text>
            </View>
          </View>
        </Animated.View>

        {bankTransferQuery.isLoading || invoiceQuery.isLoading ? (
          <Skeleton height={190} radius={sawaaRadius.xl} />
        ) : bankTransferQuery.isError ? (
          <ErrorState onRetry={() => void bankTransferQuery.refetch()} />
        ) : invoiceQuery.isError || outstanding === null ? (
          <EmptyState
            icon="alert"
            title={t('common.error')}
            description={t('common.tryAgain')}
            actionLabel={t('common.retry')}
            onAction={() => void invoiceQuery.refetch()}
          />
        ) : outstanding <= 0 ? (
          <EmptyState
            icon="information-circle-outline"
            title={t('payment.invoiceSettled')}
            actionLabel={t('common.back')}
            onAction={() => router.back()}
          />
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
            {t('payment.transferReceipt')}
          </Text>
          <Glass
            variant={selected ? 'strong' : 'regular'}
            radius={sawaaRadius.xl}
            onPress={pickReceipt}
            interactive
            accessibilityRole="button"
            accessibilityLabel={t(selected ? 'payment.receiptSelected' : 'payment.tapToUploadReceiptImage')}
            style={styles.uploadCard}
          >
            <View style={styles.uploadInner}>
              <View style={[
                styles.uploadIcon,
                { backgroundColor: selected ? withAlpha(colors.teal[500], 0.18) : colors.glass.bgStrong },
              ]}>
                <Upload size={24} color={selected ? colors.teal[600] : colors.ink[500]} strokeWidth={1.75} />
              </View>
              <Text style={[styles.uploadTitle, { fontFamily: f700 }]}>
                {selected
                  ? t('payment.receiptSelected')
                  : (t('payment.tapToUploadReceiptImage'))}
              </Text>
              <Text style={[styles.uploadSub, { fontFamily: f400, fontWeight: '400' }]}>
                {t('payment.receiptFileFormats')}
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
        <PrimaryButton
          label={submitting ? (t('payment.sending')) : (t('payment.sendForReview'))}
          onPress={submitReceipt}
          disabled={!selected || !selectedAccount || numericAmount <= 0 || readFailed}
          loading={submitting}
          height={52}
          fontFamily={f700}
          labelStyle={styles.ctaBtnText}
        />
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
  ctaBtnText: {
    color: themeColors.primaryForeground,
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
  },
});
