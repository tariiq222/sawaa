import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AuthFormScaffold } from '@/components/features/auth/AuthFormScaffold';
import { AppButton } from '@/components/ui/AppButton';
import { useTheme } from '@/theme/useTheme';
import { ThemedText } from '@/theme/components/ThemedText';
import { useEmailEntry } from '@/features/auth/use-email-entry';
import { EmailForm } from '@/components/features/auth/email-entry/EmailForm';
import { CodeForm } from '@/components/features/auth/email-entry/CodeForm';
import { PhoneForm } from '@/components/features/auth/email-entry/PhoneForm';

export default function EmailEntryScreen({ initialEmail, autoStart, onExit }: { initialEmail?: string; autoStart?: boolean; onExit?: () => void } = {}) {
  const { booking, redirect } = useLocalSearchParams<{ booking?: string; redirect?: string }>();
  const flow = useEmailEntry({ booking, redirect, initialEmail, autoStart, onExit });
  const { state } = flow;
  const { t } = useTranslation();
  const { theme } = useTheme();
  const codeStep = state.step === 'email_code' || state.step === 'phone_code';
  return <AuthFormScaffold title={t('auth.emailEntry.title')} onBack={flow.exit}>
    {state.step === 'email' && <>
      <ThemedText variant="body">{t('auth.emailEntry.intro')}</ThemedText>
      <EmailForm email={state.email} setEmail={flow.setEmail} submit={flow.requestEmail}
        pending={flow.pending} disabled={flow.pending || flow.retrySeconds > 0} />
    </>}
    {codeStep && <>
      <ThemedText variant="body">{t('auth.emailEntry.sentTo', { recipient: state.maskedRecipient })}</ThemedText>
      <CodeForm code={state.code} setCode={flow.setCode} submit={flow.verify} pending={flow.pending}
        expired={flow.expired || flow.flowExpired} phone={state.step === 'phone_code'} />
      {flow.expired && <ThemedText accessibilityRole="alert">{t('auth.emailEntry.expiredCode')}</ThemedText>}
      <AppButton label={t('auth.otp.resend')} variant="ghost" size="sm" onPress={flow.resend}
        disabled={flow.pending || flow.retrySeconds > 0 || flow.flowExpired} loading={flow.pending} />
    </>}
    {(state.step === 'register' || state.step === 'verify_phone') && <>
      <ThemedText style={{ writingDirection: 'ltr', textAlign: 'left' }}>{state.email}</ThemedText>
      <ThemedText>{t(state.step === 'register' ? 'auth.emailEntry.registrationDetails' : 'auth.emailEntry.existingPhone')}</ThemedText>
      <PhoneForm registration={state.step === 'register'} submit={flow.requestPhone}
        pending={flow.pending} disabled={flow.pending || flow.flowExpired || flow.retrySeconds > 0} />
    </>}
    {state.step === 'unavailable' && <ThemedText accessibilityRole="alert">{t('auth.emailEntry.unavailable')}</ThemedText>}
    {flow.flowExpired && <ThemedText accessibilityRole="alert">{t('auth.emailEntry.expiredFlow')}</ThemedText>}
    {flow.error && <ThemedText accessibilityRole="alert" color={theme.colors.error}>{t(`auth.emailEntry.${flow.error}`)}</ThemedText>}
    {flow.retrySeconds > 0 && <ThemedText>{t('auth.otp.resendIn', { seconds: flow.retrySeconds })}</ThemedText>}
    <View style={{ gap: 8 }}>
      <AppButton label={t('auth.emailEntry.restart')} variant="ghost" size="sm" onPress={flow.restart} />
      <AppButton label={t('auth.emailEntry.usePhone')} variant="ghost" size="sm" onPress={flow.usePhone} />
    </View>
  </AuthFormScaffold>;
}
