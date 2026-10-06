import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { AquaBackground } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useEmailEntry } from '@/features/auth/use-email-entry';
import { EmailForm } from '@/components/features/auth/email-entry/EmailForm';
import { CodeForm } from '@/components/features/auth/email-entry/CodeForm';
import { PhoneForm } from '@/components/features/auth/email-entry/PhoneForm';

export default function EmailEntryScreen({ initialEmail, onExit }: { initialEmail?: string; onExit?: () => void } = {}) {
  const { booking, redirect } = useLocalSearchParams<{ booking?: string; redirect?: string }>();
  const flow = useEmailEntry({ booking, redirect, initialEmail, onExit });
  const { state } = flow; const { t } = useTranslation(); const colors = useSawaaColors();
  const dir = useDir(); const insets = useSafeAreaInsets();
  const textStyle = { color: colors.ink[900], fontFamily: getFontName(dir.locale), writingDirection: dir.writingDirection, textAlign: dir.textAlign };
  const codeStep = state.step === 'email_code' || state.step === 'phone_code';
  return <AquaBackground>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, gap: 20 }}>
        <ScreenHeader title={t('auth.emailEntry.title')} onBack={flow.exit} />
        {state.step === 'email' && <>
          <Text style={textStyle}>{t('auth.emailEntry.intro')}</Text>
          <EmailForm email={state.email} setEmail={flow.setEmail} submit={flow.requestEmail} disabled={flow.pending || flow.retrySeconds > 0} />
        </>}
        {codeStep && <>
          <Text style={textStyle}>{t('auth.emailEntry.sentTo', { recipient: state.maskedRecipient })}</Text>
          <CodeForm code={state.code} setCode={flow.setCode} submit={flow.verify} pending={flow.pending} expired={flow.expired || flow.flowExpired} phone={state.step === 'phone_code'} />
          {flow.expired && <Text accessibilityRole="alert" style={textStyle}>{t('auth.emailEntry.expiredCode')}</Text>}
          <Pressable accessibilityRole="button" disabled={flow.pending || flow.retrySeconds > 0 || flow.flowExpired} onPress={flow.resend} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ ...textStyle, color: colors.teal[700] }}>{t('auth.otp.resend')}</Text>
          </Pressable>
        </>}
        {(state.step === 'register' || state.step === 'verify_phone') && <>
          <Text style={textStyle}>{state.email}</Text>
          <Text style={textStyle}>{t(state.step === 'register' ? 'auth.emailEntry.registrationDetails' : 'auth.emailEntry.existingPhone')}</Text>
          <PhoneForm registration={state.step === 'register'} submit={flow.requestPhone} disabled={flow.pending || flow.flowExpired || flow.retrySeconds > 0} />
        </>}
        {state.step === 'unavailable' && <Text accessibilityRole="alert" style={textStyle}>{t('auth.emailEntry.unavailable')}</Text>}
        {flow.flowExpired && <Text accessibilityRole="alert" style={textStyle}>{t('auth.emailEntry.expiredFlow')}</Text>}
        {flow.error && <Text accessibilityRole="alert" style={{ ...textStyle, color: colors.accent.coral }}>{t(`auth.emailEntry.${flow.error}`)}</Text>}
        {flow.retrySeconds > 0 && <Text style={textStyle}>{t('auth.otp.resendIn', { seconds: flow.retrySeconds })}</Text>}
        <View style={{ gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={flow.restart} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ ...textStyle, color: colors.teal[700] }}>{t('auth.emailEntry.restart')}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={flow.usePhone} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ ...textStyle, color: colors.teal[700] }}>{t('auth.emailEntry.usePhone')}</Text></Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </AquaBackground>;
}
