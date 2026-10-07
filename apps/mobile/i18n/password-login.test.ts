import { createInstance } from 'i18next';
import ar from './ar.json';
import en from './en.json';

it.each([
  ['ar', 'تسجيل الدخول', 'البريد الإلكتروني أو رقم الجوال', 'اختر الدخول بكلمة المرور أو رمز التحقق'],
  ['en', 'Login', 'Email or phone number', 'Sign in with your password or a verification code'],
])('resolves existing sign-in labels and password/OTP fields using real %s resources', async (language, label, identifier, subtitle) => {
  const instance = createInstance();
  await instance.init({ lng: language, fallbackLng: 'en', resources: { ar: { translation: ar }, en: { translation: en } }, interpolation: { escapeValue: false } });
  expect(instance.t('auth.login')).toBe(label);
  expect(instance.t('auth.login.identifier')).toBe(identifier);
  expect(instance.t('auth.login.subtitle')).toBe(subtitle);
  for (const key of ['auth.loginWithPassword', 'auth.loginWithOtp', 'auth.password', 'auth.showPassword', 'auth.hidePassword', 'auth.login.sendCode', 'auth.forgotPassword.linkLabel']) {
    const translated = instance.t(key);
    expect(typeof translated).toBe('string');
    expect(translated).not.toBe(key);
    expect(translated).not.toContain('returned an object');
  }
});
