'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { validatePassword, validateEmail } from './auth.schema';
import { clientRegisterApi } from './auth.api';
import { setTokens, setClient } from './auth-store';
import { getMeApi } from './auth.api';
import { requestOtp, verifyOtp } from '@/features/otp/otp.api';
import { OtpChannel, OtpPurpose } from '@sawaa/shared';

type Step = 'credentials' | 'otp' | 'password';

interface RegisterFormProps {
  onSuccess?: () => void;
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleCredentialsSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setIsLoading(true);
    try {
      await requestOtp({
        channel: OtpChannel.EMAIL,
        identifier: email,
        purpose: OtpPurpose.CLIENT_LOGIN,
      });
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال رمز التحقق');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOtpSubmit() {
    if (otpCode.length !== 6) {
      setError('أدخل رمز التحقق المكون من 6 أرقام');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await verifyOtp(email, otpCode, OtpPurpose.CLIENT_LOGIN);
      setOtpToken(result.sessionToken);
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'رمز التحقق غير صحيح');
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    if (!otpToken) {
      setError('انتهت الجلسة. يرجى تأكيد البريد الإلكتروني مرة أخرى.');
      setStep('credentials');
      return;
    }

    setIsLoading(true);
    try {
      const result = await clientRegisterApi({
        otpSessionToken: otpToken,
        password,
        name: name || undefined,
        
      });
      setTokens(result.accessToken, result.refreshToken);
      const profile = await getMeApi();
      setClient(profile);
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/account');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء حساب المستفيد');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {error && (
        <div
          style={{
            padding: '0.75rem',
            background: 'color-mix(in srgb, var(--error) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--error) 30%, transparent)',
            borderRadius: '8px',
            color: 'var(--error)',
            fontSize: '0.875rem',
          }}
        >
          {error}
        </div>
      )}

      {step === 'credentials' && (
        <form onSubmit={handleCredentialsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="name" style={{ fontSize: '0.875rem', fontWeight: 500 }}>اسم المستفيد الكامل</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="أحمد محمد"
              autoComplete="name"
              style={inputStyle()}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="reg-email" style={{ fontSize: '0.875rem', fontWeight: 500 }}>البريد الإلكتروني</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              autoComplete="email"
              required
              style={inputStyle()}
            />
          </div>
          <button type="submit" disabled={isLoading} style={primaryButtonStyle(isLoading)}>
            {isLoading ? 'جارٍ إرسال الرمز...' : 'متابعة كـ مستفيد لدى مركز سواء'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>
            أرسلنا رمز تحقق إلى {email}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="otp" style={{ fontSize: '0.875rem', fontWeight: 500 }}>رمز التحقق</label>
            <input
              id="otp"
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              placeholder="000000"
              style={{ ...inputStyle(), fontSize: '1.5rem', letterSpacing: '0.5em', textAlign: 'center' }}
            />
          </div>
          <button onClick={handleOtpSubmit} disabled={isLoading || otpCode.length !== 6} style={primaryButtonStyle(isLoading || otpCode.length !== 6)}>
            {isLoading ? 'جارٍ التحقق...' : 'تحقق'}
          </button>
          <button
            onClick={() => setStep('credentials')}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            تغيير البريد الإلكتروني
          </button>
        </div>
      )}

      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>
            تم تأكيد البريد. عيّن كلمة مرور لإكمال إنشاء حساب المستفيد لدى مركز سواء.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="reg-password" style={{ fontSize: '0.875rem', fontWeight: 500 }}>كلمة المرور</label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 أحرف على الأقل مع حرف كبير ورقم"
              autoComplete="new-password"
              required
              style={inputStyle()}
            />
          </div>
          <button type="submit" disabled={isLoading} style={primaryButtonStyle(isLoading)}>
            {isLoading ? 'جارٍ إنشاء الحساب...' : 'إنشاء حساب مستفيد'}
          </button>
          <button
            onClick={() => setStep('otp')}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            إعادة إرسال الرمز
          </button>
        </form>
      )}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
    background: 'color-mix(in srgb, var(--surface) 80%, transparent)',
    fontSize: '1rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.875rem',
    borderRadius: '8px',
    background: disabled ? 'var(--muted)' : 'var(--primary)',
    color: disabled ? 'var(--muted-foreground)' : 'var(--on-primary)',
    fontWeight: 600,
    fontSize: '1rem',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1,
    transition: 'opacity 0.2s',
    width: '100%',
  };
}
