// Website dictionary — feature group: payment, otp.
// `en` is typed as Record<keyof typeof ar, string>: a missing or
// extra English key is a TypeScript error.
import type { LocalizedDictionary } from './dictionary.types';

const ar = {
  'payment.redirecting': 'جارٍ التحويل إلى صفحة الدفع...',
  'payment.clickIfNotRedirected': 'اضغط هنا إذا لم يتم التحويل',
  'payment.callback.title': 'اختر أين تتابع',
  'payment.callback.description': 'ارجع إلى التطبيق أو الموقع للتحقق من حالة الحجز والدفع.',
  'payment.callback.app': 'المتابعة في التطبيق',
  'payment.callback.website': 'المتابعة على الموقع',
  'otp.failedToSend': 'فشل إرسال رمز التحقق',
  'otp.willSendTo': 'سنرسل رمز التحقق إلى',
  'otp.sendCode': 'إرسال رمز التحقق',
  'otp.verificationFailed': 'فشل التحقق',
} as const;

const en: Record<keyof typeof ar, string> = {
  'payment.redirecting': 'Redirecting to payment...',
  'payment.clickIfNotRedirected': 'Click here if not redirected',
  'payment.callback.title': 'Choose where to continue',
  'payment.callback.description': 'Return to the app or website to check your booking and payment status.',
  'payment.callback.app': 'Continue in app',
  'payment.callback.website': 'Continue on website',
  'otp.failedToSend': 'Failed to send OTP',
  'otp.willSendTo': 'We will send a verification code to',
  'otp.sendCode': 'Send Verification Code',
  'otp.verificationFailed': 'Verification failed',
};

export const paymentDictionary: LocalizedDictionary<typeof ar> = { ar, en };
