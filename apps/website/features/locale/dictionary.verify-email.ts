// Website dictionary — feature group: verifyEmail.
// `en` is typed as Record<keyof typeof ar, string>: a missing or
// extra English key is a TypeScript error.
import type { LocalizedDictionary } from './dictionary.types';

const ar = {
  // Verify-email page
  'verifyEmail.verifying': 'جارِ التحقق من بريدك الإلكتروني…',
  'verifyEmail.successTitle': 'تم تأكيد بريدك الإلكتروني',
  'verifyEmail.successDesc': 'يمكنك الآن تسجيل الدخول والاستفادة من جميع الخدمات.',
  'verifyEmail.login': 'تسجيل الدخول',
  'verifyEmail.home': 'العودة للرئيسية',
  'verifyEmail.errorTitle': 'تعذر التحقق',
  'verifyEmail.invalidToken': 'رابط التحقق غير صالح أو منتهي الصلاحية',
  'verifyEmail.verifyFailed': 'فشل التحقق من البريد',
  'verifyEmail.connectionError': 'خطأ في الاتصال',
} as const;

const en: Record<keyof typeof ar, string> = {
  // Verify-email page
  'verifyEmail.verifying': 'Verifying your email…',
  'verifyEmail.successTitle': 'Email verified',
  'verifyEmail.successDesc': 'You can now sign in and use all services.',
  'verifyEmail.login': 'Sign in',
  'verifyEmail.home': 'Back to home',
  'verifyEmail.errorTitle': 'Verification failed',
  'verifyEmail.invalidToken': 'The verification link is invalid or expired',
  'verifyEmail.verifyFailed': 'Email verification failed',
  'verifyEmail.connectionError': 'Connection error',
};

export const verifyEmailDictionary: LocalizedDictionary<typeof ar> = { ar, en };
