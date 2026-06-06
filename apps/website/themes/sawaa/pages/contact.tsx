import { MapPin, Phone, Mail, Clock, MessageCircle, type LucideIcon } from 'lucide-react';
import { ContactForm } from '@/features/contact/public';
import { getLocale } from '@/features/locale/public';
import { t as translate, type MessageKey } from '@/features/locale/dictionary';
import { AnimatedSection } from '../components/ui/animated-section';
import { SectionHeader } from '../components/ui/section-header';
import { SITE } from '../lib/constants';

interface InfoItem {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
}

export async function SawaaContactPage() {
  const locale = await getLocale();
  const t = (key: MessageKey) => translate(locale, key);

  const info: InfoItem[] = [
    { icon: Phone, label: t('contact.info.phoneLabel'), value: SITE.phone, href: `tel:${SITE.phone}` },
    { icon: Mail, label: t('contact.info.emailLabel'), value: SITE.email, href: `mailto:${SITE.email}` },
    {
      icon: MapPin,
      label: t('contact.info.addressLabel'),
      value: locale === 'en' ? SITE.addressEn : SITE.address,
    },
    { icon: Clock, label: t('contact.info.hoursLabel'), value: t('contact.info.hoursValue') },
  ];

  return (
    <section
      className="sw-section-cream relative overflow-hidden px-5 sm:px-6 md:px-8 pb-20 -mt-[88px] pt-[140px] sm:pt-[160px]"
    >
      <div className="max-w-[1100px] mx-auto">
        <AnimatedSection>
          <SectionHeader
            tag={t('contact.tag')}
            tagIcon={<MessageCircle className="w-3.5 h-3.5" />}
            title={t('contact.title')}
            subtitle={t('contact.description')}
          />
        </AnimatedSection>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.35fr] gap-5 items-start">
          <AnimatedSection>
            <div
              className="relative h-full overflow-hidden rounded-[28px] p-8 flex flex-col"
              style={{
                background:
                  'linear-gradient(135deg, var(--sw-primary-500) 0%, var(--sw-primary-600) 100%)',
                boxShadow: 'var(--sw-shadow-primary-lg)',
              }}
            >
              <div className="absolute -top-10 -start-10 w-40 h-40 rounded-full bg-white/10" />
              <div className="absolute -bottom-16 -end-16 w-48 h-48 rounded-full bg-white/5" />

              <div className="relative z-10">
                <h2 className="text-[1.375rem] font-extrabold text-white mb-1.5 leading-tight">
                  {t('contact.info.heading')}
                </h2>
                <p className="text-[0.875rem] text-white/80 leading-relaxed mb-7">
                  {t('contact.info.subheading')}
                </p>

                <ul className="flex flex-col gap-5">
                  {info.map(({ icon: Icon, label, value, href }) => (
                    <li key={label} className="flex items-start gap-3.5">
                      <span className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                      </span>
                      <span className="flex flex-col pt-0.5 min-w-0">
                        <span className="text-[0.688rem] font-bold uppercase tracking-widest text-white/60 mb-0.5">
                          {label}
                        </span>
                        {href ? (
                          <a
                            href={href}
                            dir="ltr"
                            className="text-[0.938rem] font-semibold text-white hover:text-white/80 transition-colors text-start break-words"
                          >
                            {value}
                          </a>
                        ) : (
                          <span className="text-[0.938rem] font-semibold text-white/95 leading-snug break-words">
                            {value}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <div
              className="rounded-[28px] bg-white p-8 sm:p-10"
              style={{
                border: '1px solid var(--sw-neutral-100)',
                boxShadow: 'var(--sw-shadow-md)',
              }}
            >
              <h2
                className="text-[1.375rem] font-extrabold mb-7 leading-tight"
                style={{ color: 'var(--sw-secondary-700)' }}
              >
                {t('contact.form.heading')}
              </h2>
              <ContactForm />
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
