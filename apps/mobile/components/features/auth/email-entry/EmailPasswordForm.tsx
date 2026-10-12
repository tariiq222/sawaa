import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppButton } from '@/components/ui/AppButton';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { useDir } from '@/hooks/useDir';
import { usePasswordLogin } from '@/features/auth/use-password-login';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { authContinuationParams } from '@/features/booking/guest-booking-flow';

/** Email + password sign-in for any account with a password; the backend decides the session kind. */
export function EmailPasswordForm({ email, setEmail, booking, redirect }: {
  email: string; setEmail: (value: string) => void; booking?: string; redirect?: string;
}) {
  const { t } = useTranslation(); const dir = useDir(); const router = useRouter();
  const login = usePasswordLogin({ booking, redirect });
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async () => {
    if (!email.trim().includes('@')) { setError(t('auth.emailEntry.invalidEmail')); return; }
    if (!password) { setError(t('auth.passwordRequired')); return; }
    setError(undefined);
    const result = await login.submit(email, password);
    if (result === 'failed') setError(t('auth.loginError'));
    if (result !== 'cancelled') setPassword('');
  };
  return <>
    <LabeledInput label={t('auth.register.email')} placeholder={t('auth.emailPlaceholder')} dir={dir}
      value={email} onChangeText={value => { setEmail(value); setError(undefined); }} editable={!login.pending}
      keyboardType="email-address" textContentType="username" autoComplete="email" autoCapitalize="none" autoCorrect={false}
      inputStyle={{ writingDirection: 'ltr', textAlign: 'left' }} />
    <LabeledInput label={t('auth.password')} placeholder={t('auth.passwordPlaceholder')} dir={dir}
      value={password} onChangeText={value => { setPassword(value); setError(undefined); }} secureTextEntry
      showVisibilityToggle isVisible={visible} onToggleVisibility={() => setVisible(current => !current)}
      editable={!login.pending} autoCapitalize="none" autoCorrect={false}
      autoComplete="password" textContentType="password" onSubmitEditing={() => { void submit(); }}
      inputStyle={{ writingDirection: 'ltr', textAlign: 'left' }} />
    {error ? <InlineAlert message={error} /> : null}
    <AppButton loading={login.pending} label={t('auth.loginNow')} onPress={() => { void submit(); }} disabled={login.pending} />
    <AppButton label={t('auth.forgotPassword.linkLabel')} variant="ghost" size="sm" disabled={login.pending}
      onPress={() => { login.cancel(); router.push({ pathname: '/(auth)/forgot-password', params: {
        ...authContinuationParams(booking, redirect), ...(email.trim() ? { identifier: email.trim() } : {}) } }); }} />
  </>;
}
