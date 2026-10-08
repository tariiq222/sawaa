import React, { useMemo, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Banknote, Upload } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AquaBackground, sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { AppButton } from '@/components/ui/AppButton';
import { goBackOrHome } from '@/lib/navigation';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { clientPaymentsService, type ReceiptUploadAsset } from '@/services/client';
import { formatCurrencyAmount } from '@/lib/currency-display';
import { useBankTransferSettings, useClientInvoice } from '@/hooks/queries';
import { getOutstandingHalalas } from '@/lib/invoice-outstanding';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { BankTransferAccountDetails } from '@/components/features/booking/BankTransferAccountDetails';

export default function BankTransferScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const [footerHeight, setFooterHeight] = useState(180);
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
  const uploaded = !!receipt;
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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: footerHeight + sawaaSpacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}>
          <ScreenHeader title={t('payment.bankTransfer')} onBack={() => goBackOrHome(router, '/(client)/(tabs)/home')} />
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
          <View style={[styles.titleRow, { flexDirection: dir.row }]}>
            <View style={styles.titleIcon}>
              <Banknote size={22} color={colors.accent.amber} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.subtitle, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
                {dir.isRTL ? 'حوّل المبلغ ثم ارفع الإيصال' : 'Transfer and upload receipt'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {bankTransferQuery.isLoading || invoiceQuery.isLoading ? (
          <Skeleton height={190} radius={sawaaRadius.xl} />
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
            onAction={() => goBackOrHome(router, '/(client)/(tabs)/home')}
          />
        ) : !selectedAccount ? (
          <EmptyState
            icon="information-circle-outline"
            title={t('payment.bankTransferUnavailable')}
            actionLabel={t('common.back')}
            onAction={() => goBackOrHome(router, '/(client)/(tabs)/home')}
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

      <FloatingCta onHeightChange={setFooterHeight}>
        <AppButton label={dir.isRTL ? 'إرسال للمراجعة' : 'Send for review'}
          disabled={!uploaded || !selectedAccount || numericAmount <= 0 || submitting}
          loading={submitting} onPress={() => { void submitReceipt(); }} />
      </FloatingCta>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
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
});
