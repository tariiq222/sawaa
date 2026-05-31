'use client';

// LEGAL CONTENT NOTICE (S2.5 / PDPL):
// The Arabic prose below is placeholder-quality legal content authored to satisfy
// the PDPL + app-store requirement that the public site disclose how sensitive
// mental-health PII is handled. It MUST be reviewed and finalized by a licensed
// Saudi (KSA) lawyer before launch. Do not treat this as final legal advice.

import { useT, useLocale } from '@/features/locale/locale-provider';
import type { MessageKey } from '@/features/locale/dictionary';

interface LegalSection {
  heading: MessageKey;
  body: MessageKey;
}

interface LegalPageProps {
  titleKey: MessageKey;
  introKey: MessageKey;
  sections: LegalSection[];
  reviewNoticeKey: MessageKey;
  updatedKey: MessageKey;
}

export function LegalPage({
  titleKey,
  introKey,
  sections,
  reviewNoticeKey,
  updatedKey,
}: LegalPageProps) {
  const t = useT();
  const locale = useLocale();

  return (
    <section className="relative py-16 sm:py-20">
      <div className="max-w-[820px] mx-auto px-5 sm:px-6 md:px-8">
        <header className="mb-10">
          <h1
            className="text-2xl sm:text-3xl font-extrabold mb-3"
            style={{ color: 'var(--sw-secondary-700)' }}
          >
            {t(titleKey)}
          </h1>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--sw-neutral-500)' }}
          >
            {t(updatedKey)}
          </p>
        </header>

        <p
          className="text-[0.95rem] leading-loose mb-10"
          style={{ color: 'var(--sw-neutral-600)' }}
        >
          {t(introKey)}
        </p>

        <div className="space-y-8">
          {sections.map((s) => (
            <article key={s.heading}>
              <h2
                className="text-lg font-extrabold mb-3 flex items-center gap-2"
                style={{ color: 'var(--sw-secondary-700)' }}
              >
                <span
                  className="w-1 h-5 rounded-full inline-block"
                  style={{ background: 'var(--sw-primary-500)' }}
                />
                {t(s.heading)}
              </h2>
              <p
                className="text-[0.95rem] leading-loose"
                style={{ color: 'var(--sw-neutral-600)' }}
              >
                {t(s.body)}
              </p>
            </article>
          ))}
        </div>

        <p
          className="mt-12 text-[0.8rem] leading-relaxed rounded-xl p-4 border"
          style={{
            color: 'var(--sw-neutral-500)',
            background: 'var(--sw-neutral-50)',
            borderColor: 'var(--sw-neutral-100)',
            direction: locale === 'ar' ? 'rtl' : 'ltr',
          }}
        >
          {t(reviewNoticeKey)}
        </p>
      </div>
    </section>
  );
}

const PRIVACY_SECTIONS: LegalSection[] = [
  { heading: 'legal.privacy.collect.title', body: 'legal.privacy.collect.body' },
  { heading: 'legal.privacy.purpose.title', body: 'legal.privacy.purpose.body' },
  { heading: 'legal.privacy.retention.title', body: 'legal.privacy.retention.body' },
  { heading: 'legal.privacy.rights.title', body: 'legal.privacy.rights.body' },
  { heading: 'legal.privacy.hosting.title', body: 'legal.privacy.hosting.body' },
  { heading: 'legal.privacy.contact.title', body: 'legal.privacy.contact.body' },
];

const TERMS_SECTIONS: LegalSection[] = [
  { heading: 'legal.terms.service.title', body: 'legal.terms.service.body' },
  { heading: 'legal.terms.booking.title', body: 'legal.terms.booking.body' },
  { heading: 'legal.terms.responsibilities.title', body: 'legal.terms.responsibilities.body' },
  { heading: 'legal.terms.liability.title', body: 'legal.terms.liability.body' },
  { heading: 'legal.terms.law.title', body: 'legal.terms.law.body' },
];

export function PrivacyPage() {
  return (
    <LegalPage
      titleKey="legal.privacy.title"
      introKey="legal.privacy.intro"
      sections={PRIVACY_SECTIONS}
      reviewNoticeKey="legal.reviewNotice"
      updatedKey="legal.lastUpdated"
    />
  );
}

export function TermsPage() {
  return (
    <LegalPage
      titleKey="legal.terms.title"
      introKey="legal.terms.intro"
      sections={TERMS_SECTIONS}
      reviewNoticeKey="legal.reviewNotice"
      updatedKey="legal.lastUpdated"
    />
  );
}
