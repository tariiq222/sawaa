import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AuthFormScaffold } from '@/components/features/auth/AuthFormScaffold';
import { AppButton } from '@/components/ui/AppButton';
import { useTheme } from '@/theme/useTheme';
import { ThemedText } from '@/theme/components/ThemedText';
import { usePhoneEntry } from '@/features/auth/use-phone-entry';
import { PhoneStepForm } from '@/components/features/auth/phone-entry/PhoneStepForm';
import { CodeStepForm } from '@/components/features/auth/phone-entry/CodeStepForm';
import { DetailsStepForm } from '@/components/features/auth/phone-entry/DetailsStepForm';
import { authContinuationParams } from '@/features/booking/guest-booking-flow';
import { goBackOrHome } from '@/lib/navigation';

/** Phone-first entry: phone → SMS code → (new users) details → signed in. */
export default function LoginScreen() {
  const { booking, redirect } = useLocalSearchParams<{ booking?: string; redirect?: string }>();
  const flow = usePhoneEntry({ booking, redirect });
  const { state } = flow;
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const titleKey = state.step === 'code' ? 'auth.phoneEntry.codeTitle'
    : state.step === 'details' ? 'auth.phoneEntry.detailsTitle' : 'auth.phoneEntry.title';
  return <AuthFormScaffold title={t(titleKey)} onBack={() => { flow.restart(); goBackOrHome(router); }}>
    {state.step === 'phone' && <>
      <ThemedText variant="body">{t('auth.phoneEntry.intro')}</ThemedText>
      <PhoneStepForm phone={state.phone} onPhoneChange={flow.setPhone} submit={flow.request}
        pending={flow.pending}
        onEmailEntry={() => router.push(flow.emailEntryHref)}
        onStaffLogin={() => router.push({
          pathname: '/(auth)/staff-login',
          params: authContinuationParams(booking, redirect),
        })} />
    </>}
    {state.step === 'code' && <>
      <ThemedText variant="body">{t('auth.phoneEntry.sentTo', { phone: state.maskedPhone })}</ThemedText>
      <CodeStepForm code={state.code} onCodeChange={flow.setCode} submit={flow.verify}
        resend={flow.resend} changePhone={flow.changePhone} pending={flow.pending}
        expired={flow.expired} retrySeconds={flow.retrySeconds} />
      {flow.expired && <ThemedText accessibilityRole="alert">{t('auth.phoneEntry.expiredCode')}</ThemedText>}
    </>}
    {state.step === 'details' && <DetailsStepForm submit={flow.complete}
      disabled={flow.pending || flow.flowExpired || flow.retrySeconds > 0} pending={flow.pending} />}
    {state.step === 'unavailable' && <>
      <ThemedText accessibilityRole="alert">{t('auth.phoneEntry.unavailable')}</ThemedText>
      <AppButton label={t('auth.phoneEntry.changePhone')} variant="ghost" onPress={flow.changePhone} />
    </>}
    {flow.error && <ThemedText accessibilityRole="alert" color={theme.colors.error}>{t(`auth.phoneEntry.${flow.error}`)}</ThemedText>}
    {flow.retrySeconds > 0 && state.step === 'code' && <ThemedText>{t('auth.otp.resendIn', { seconds: flow.retrySeconds })}</ThemedText>}
    {booking ? null : <AppButton label={t('auth.login.continueAsGuest')} variant="secondary"
      onPress={() => { flow.restart(); router.replace('/(guest)/home'); }} />}
  </AuthFormScaffold>;
}
