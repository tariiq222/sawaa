import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AuthFormScaffold } from '@/components/features/auth/AuthFormScaffold';
import { AppButton } from '@/components/ui/AppButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { useTheme } from '@/theme/useTheme';
import { ThemedText } from '@/theme/components/ThemedText';
import { sawaaSpacing, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useDir } from '@/hooks/useDir';
import { useEmailEntry } from '@/features/auth/use-email-entry';
import { EmailForm } from '@/components/features/auth/email-entry/EmailForm';
import { CodeForm } from '@/components/features/auth/email-entry/CodeForm';
import { PhoneForm } from '@/components/features/auth/email-entry/PhoneForm';
import { EmailPasswordForm } from '@/components/features/auth/email-entry/EmailPasswordForm';
import { EditableEmail } from '@/components/features/auth/email-entry/EditableEmail';

export default function EmailEntryScreen({ initialEmail, autoStart, onExit }: { initialEmail?: string; autoStart?: boolean; onExit?: () => void } = {}) {
  const { booking, redirect } = useLocalSearchParams<{ booking?: string; redirect?: string }>();
  const flow = useEmailEntry({ booking, redirect, initialEmail, autoStart, onExit });
  const { state } = flow;
  const { t } = useTranslation();
  const { theme } = useTheme();
  const colors = useSawaaColors();
  const dir = useDir();
  // Password is the default sign-in; auto-started flows (staff email fallback) begin with a code.
  const [withPassword, setWithPassword] = useState(!autoStart);
  const codeStep = state.step === 'email_code' || state.step === 'phone_code';
  return <AuthFormScaffold title={t('auth.emailEntry.title')} onBack={flow.exit}>
    {state.step === 'email' && withPassword && <>
      <EmailPasswordForm email={state.email} setEmail={flow.setEmail} booking={booking} redirect={redirect} />
    </>}
    {state.step === 'email' && !withPassword && <>
      <ThemedText variant="body">{t('auth.emailEntry.intro')}</ThemedText>
      <EmailForm email={state.email} setEmail={flow.setEmail} submit={flow.requestEmail}
        pending={flow.pending} disabled={flow.pending || flow.retrySeconds > 0} />
    </>}
    {codeStep && <>
      {state.step === 'email_code'
        ? <EditableEmail text={t('auth.emailEntry.sentTo', { recipient: state.maskedRecipient })} onEdit={flow.editEmail} />
        : <ThemedText variant="body">{t('auth.emailEntry.sentTo', { recipient: state.maskedRecipient })}</ThemedText>}
      <CodeForm code={state.code} setCode={flow.setCode} submit={flow.verify} pending={flow.pending}
        expired={flow.expired || flow.flowExpired} phone={state.step === 'phone_code'} />
      {flow.expired && <ThemedText accessibilityRole="alert">{t('auth.emailEntry.expiredCode')}</ThemedText>}
      <AppButton label={t('auth.otp.resend')} variant="ghost" size="sm" onPress={flow.resend}
        disabled={flow.pending || flow.retrySeconds > 0 || flow.flowExpired} loading={flow.pending} />
    </>}
    {(state.step === 'register' || state.step === 'verify_phone') && <>
      <EditableEmail text={state.email} onEdit={flow.editEmail} ltr />
      <ThemedText>{t(state.step === 'register' ? 'auth.emailEntry.registrationDetails' : 'auth.emailEntry.existingPhone')}</ThemedText>
      <PhoneForm registration={state.step === 'register'} submit={flow.requestPhone}
        pending={flow.pending} disabled={flow.pending || flow.flowExpired || flow.retrySeconds > 0} />
    </>}
    {state.step === 'unavailable' && <ThemedText accessibilityRole="alert">{t('auth.emailEntry.unavailable')}</ThemedText>}
    {/* Feedback sits right under the action that caused it; alternative entry links stay grouped at the end. */}
    {flow.flowExpired && <InlineAlert message={t('auth.emailEntry.expiredFlow')} />}
    {flow.error && <InlineAlert message={t(`auth.emailEntry.${flow.error}`)} />}
    {flow.retrySeconds > 0 && <ThemedText variant="caption" color={theme.colors.textSecondary} style={{ textAlign: 'center' }}>{t('auth.otp.resendIn', { seconds: flow.retrySeconds })}</ThemedText>}
    <View style={{ marginTop: sawaaSpacing.md, flexDirection: dir.row, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
      {state.step === 'email' && <>
        <AppButton label={t(withPassword ? 'auth.loginWithOtp' : 'auth.loginWithPassword')}
          variant="ghost" size="sm" onPress={() => { flow.editEmail(); setWithPassword(!withPassword); }} />
        <View style={{ width: StyleSheet.hairlineWidth * 2, height: 18, backgroundColor: withAlpha(colors.ink[900], 0.2) }} />
      </>}
      <AppButton label={t('auth.emailEntry.usePhone')} variant="ghost" size="sm" onPress={flow.usePhone} />
    </View>
  </AuthFormScaffold>;
}
