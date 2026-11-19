import type { Locale } from './locale';
import { commonDictionary } from './dictionary.common';
import { homeDictionary } from './dictionary.home';
import { contactDictionary } from './dictionary.contact';
import { therapistsDictionary } from './dictionary.therapists';
import { clinicsDictionary } from './dictionary.clinics';
import { servicesDictionary } from './dictionary.services';
import { burnoutDictionary } from './dictionary.burnout';
import { authDictionary } from './dictionary.auth';
import { accountDictionary } from './dictionary.account';
import { bookingDictionary } from './dictionary.booking';
import { cancellationDictionary } from './dictionary.cancellation';
import { intakeDictionary } from './dictionary.intake';
import { invoiceDictionary } from './dictionary.invoice';
import { paymentDictionary } from './dictionary.payment';
import { packagesDictionary } from './dictionary.packages';
import { supportGroupsDictionary } from './dictionary.support-groups';
import { legalDictionary } from './dictionary.legal';
import { consentDictionary } from './dictionary.consent';
import { chatDictionary } from './dictionary.chat';
import { verifyEmailDictionary } from './dictionary.verify-email';

/**
 * Ordered list of the feature groups. The aggregator and the key-parity test
 * both read it, so a new group cannot be added without being checked.
 */
export const dictionaryFeatures = [
  { name: 'common', ar: commonDictionary.ar, en: commonDictionary.en },
  { name: 'home', ar: homeDictionary.ar, en: homeDictionary.en },
  { name: 'contact', ar: contactDictionary.ar, en: contactDictionary.en },
  { name: 'therapists', ar: therapistsDictionary.ar, en: therapistsDictionary.en },
  { name: 'clinics', ar: clinicsDictionary.ar, en: clinicsDictionary.en },
  { name: 'services', ar: servicesDictionary.ar, en: servicesDictionary.en },
  { name: 'burnout', ar: burnoutDictionary.ar, en: burnoutDictionary.en },
  { name: 'auth', ar: authDictionary.ar, en: authDictionary.en },
  { name: 'account', ar: accountDictionary.ar, en: accountDictionary.en },
  { name: 'booking', ar: bookingDictionary.ar, en: bookingDictionary.en },
  { name: 'cancellation', ar: cancellationDictionary.ar, en: cancellationDictionary.en },
  { name: 'intake', ar: intakeDictionary.ar, en: intakeDictionary.en },
  { name: 'invoice', ar: invoiceDictionary.ar, en: invoiceDictionary.en },
  { name: 'payment', ar: paymentDictionary.ar, en: paymentDictionary.en },
  { name: 'packages', ar: packagesDictionary.ar, en: packagesDictionary.en },
  { name: 'support-groups', ar: supportGroupsDictionary.ar, en: supportGroupsDictionary.en },
  { name: 'legal', ar: legalDictionary.ar, en: legalDictionary.en },
  { name: 'consent', ar: consentDictionary.ar, en: consentDictionary.en },
  { name: 'chat', ar: chatDictionary.ar, en: chatDictionary.en },
  { name: 'verify-email', ar: verifyEmailDictionary.ar, en: verifyEmailDictionary.en },
] as const;

export const dictionary = {
  ar: {
    ...commonDictionary.ar,
    ...homeDictionary.ar,
    ...contactDictionary.ar,
    ...therapistsDictionary.ar,
    ...clinicsDictionary.ar,
    ...servicesDictionary.ar,
    ...burnoutDictionary.ar,
    ...authDictionary.ar,
    ...accountDictionary.ar,
    ...bookingDictionary.ar,
    ...cancellationDictionary.ar,
    ...intakeDictionary.ar,
    ...invoiceDictionary.ar,
    ...paymentDictionary.ar,
    ...packagesDictionary.ar,
    ...supportGroupsDictionary.ar,
    ...legalDictionary.ar,
    ...consentDictionary.ar,
    ...chatDictionary.ar,
    ...verifyEmailDictionary.ar,
  },
  en: {
    ...commonDictionary.en,
    ...homeDictionary.en,
    ...contactDictionary.en,
    ...therapistsDictionary.en,
    ...clinicsDictionary.en,
    ...servicesDictionary.en,
    ...burnoutDictionary.en,
    ...authDictionary.en,
    ...accountDictionary.en,
    ...bookingDictionary.en,
    ...cancellationDictionary.en,
    ...intakeDictionary.en,
    ...invoiceDictionary.en,
    ...paymentDictionary.en,
    ...packagesDictionary.en,
    ...supportGroupsDictionary.en,
    ...legalDictionary.en,
    ...consentDictionary.en,
    ...chatDictionary.en,
    ...verifyEmailDictionary.en,
  },
} satisfies Record<Locale, Record<string, string>>;

export type MessageKey = keyof (typeof dictionary)['ar'];

export function t(locale: Locale, key: MessageKey): string {
  return dictionary[locale][key];
}
