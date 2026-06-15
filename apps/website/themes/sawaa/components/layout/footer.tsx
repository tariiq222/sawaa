'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Phone, Mail } from 'lucide-react';
import { useBranding } from '@/features/branding/public';
import { useT } from '@/features/locale/locale-provider';
import { PAYMENT_METHODS, SITE } from '../../lib/constants';
import type { SupportGroup } from '@/features/site-content/public';

const navLinks = [
  { key: 'nav.home', href: '/' },
  { key: 'nav.therapists', href: '/therapists' },
  { key: 'nav.supportGroups', href: '/support-groups' },
  { key: 'nav.burnout', href: '/burnout-test' },
  { key: 'nav.contact', href: '/contact' },
] as const;

export interface FooterClinic {
  id: string;
  nameAr: string;
}

interface FooterProps {
  clinics?: FooterClinic[];
  supportGroups?: SupportGroup[];
}

function SocialIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      aria-label={label}
      rel="noopener noreferrer"
      className="w-10 h-10 rounded-xl flex items-center justify-center transition hover:-translate-y-0.5"
      style={{
        background: 'var(--sw-primary-50)',
        color: 'var(--sw-primary-600)',
      }}
    >
      <span className="w-[18px] h-[18px] flex items-center justify-center">{children}</span>
    </a>
  );
}

function ColumnHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4
      className="text-[0.813rem] font-extrabold mb-5 flex items-center gap-2"
      style={{ color: 'var(--sw-secondary-700)' }}
    >
      <span
        className="w-1 h-4 rounded-full"
        style={{ background: 'var(--sw-primary-500)' }}
      />
      {children}
    </h4>
  );
}

export function Footer({ clinics = [], supportGroups = [] }: FooterProps) {
  const t = useT();
  const branding = useBranding();
  const brandName = branding.organizationNameAr || SITE.name;
  const tagline = branding.productTagline || SITE.desc;

  return (
    <footer
      className="border-t pt-20 relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, var(--sw-neutral-0) 0%, var(--sw-neutral-50) 100%)',
        borderColor: 'var(--sw-neutral-100)',
      }}
    >
      <div
        className="absolute -top-32 -start-32 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--primary) 6%, transparent) 0%, transparent 70%)',
        }}
      />
      <div className="max-w-[1260px] mx-auto px-5 sm:px-6 md:px-8 relative">
        <div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 lg:gap-10 pb-12 border-b"
          style={{ borderColor: 'var(--sw-neutral-100)' }}
        >
          <div>
            <div className="flex items-center gap-2.5 mb-5">
              <div
                className="w-[42px] h-[42px] rounded-xl p-1 flex items-center justify-center"
                style={{ background: 'var(--sw-primary-50)' }}
              >
                <Image
                  src={branding.logoUrl ?? SITE.logo}
                  alt={brandName}
                  width={42}
                  height={42}
                  className="w-full h-full rounded-lg object-contain"
                />
              </div>
              <b style={{ color: 'var(--sw-primary-600)' }} className="font-extrabold">
                {brandName}
              </b>
            </div>
            <p
              className="text-[0.813rem] leading-relaxed mb-6"
              style={{ color: 'var(--sw-neutral-500)' }}
            >
              {tagline}
            </p>
            <div className="flex gap-2">
              <SocialIcon href={SITE.social.tiktok} label="TikTok">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52V6.8a4.84 4.84 0 0 1-1-.11" />
                </svg>
              </SocialIcon>
              <SocialIcon href={SITE.social.x} label="X">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </SocialIcon>
              <SocialIcon href={SITE.social.instagram} label="Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
                  <rect width="20" height="20" x="2" y="2" rx="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                </svg>
              </SocialIcon>
              <SocialIcon href={SITE.social.youtube} label="YouTube">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </SocialIcon>
            </div>
          </div>

          <div>
            <ColumnHeader>{t('footer.quickLinks')}</ColumnHeader>
            <ul className="space-y-3">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    aria-label={t(l.key)}
                    className="text-[0.813rem] transition"
                    style={{ color: 'var(--sw-neutral-500)' }}
                  >
                    {t(l.key)}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href="/booking"
                  aria-label={t('nav.booking')}
                  className="text-[0.813rem] transition"
                  style={{ color: 'var(--sw-neutral-500)' }}
                >
                  {t('nav.booking')}
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  aria-label={t('footer.privacy')}
                  className="text-[0.813rem] transition"
                  style={{ color: 'var(--sw-neutral-500)' }}
                >
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  aria-label={t('footer.terms')}
                  className="text-[0.813rem] transition"
                  style={{ color: 'var(--sw-neutral-500)' }}
                >
                  {t('footer.terms')}
                </Link>
              </li>
            </ul>
          </div>

          {clinics.length > 0 ? (
            <div>
              <ColumnHeader>{t('footer.clinics')}</ColumnHeader>
              <ul className="space-y-3">
                {clinics.map((c) => (
                  <li key={c.id}>
                    <span className="text-[0.813rem]" style={{ color: 'var(--sw-neutral-500)' }}>
                      {c.nameAr}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <ColumnHeader>{t('footer.supportGroups')}</ColumnHeader>
            <ul className="space-y-3">
              {(supportGroups.length > 0 ? supportGroups : []).map((g) => (
                <li key={g.slug}>
                  <Link
                    href="/support-groups"
                    aria-label={g.name}
                    className="text-[0.813rem] transition"
                    style={{ color: 'var(--sw-neutral-500)' }}
                  >
                    {g.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <ColumnHeader>{t('footer.contact')}</ColumnHeader>
            <div className="space-y-4">
              <div className="flex gap-3 items-start text-[0.813rem]" style={{ color: 'var(--sw-neutral-500)' }}>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--sw-primary-50)' }}
                >
                  <MapPin className="w-4 h-4" style={{ color: 'var(--sw-primary-600)' }} />
                </div>
                <span className="leading-relaxed pt-1">{SITE.address}</span>
              </div>
              <div className="flex gap-3 items-center text-[0.813rem]" style={{ color: 'var(--sw-neutral-500)' }}>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--sw-primary-50)' }}
                >
                  <Phone className="w-4 h-4" style={{ color: 'var(--sw-primary-600)' }} />
                </div>
                <a
                  href={`tel:${SITE.phone}`}
                  className="font-semibold transition"
                  style={{ direction: 'ltr' }}
                >
                  {SITE.phone}
                </a>
              </div>
              <div className="flex gap-3 items-center text-[0.813rem]" style={{ color: 'var(--sw-neutral-500)' }}>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--sw-primary-50)' }}
                >
                  <Mail className="w-4 h-4" style={{ color: 'var(--sw-primary-600)' }} />
                </div>
                <a href={`mailto:${SITE.email}`} className="font-semibold transition">
                  {SITE.email}
                </a>
              </div>
            </div>
          </div>
        </div>

        <div
          className="py-8 flex flex-col items-center gap-3 border-b"
          style={{ borderColor: 'var(--sw-neutral-100)' }}
        >
          <span
            className="text-[0.75rem] font-bold uppercase"
            style={{ color: 'var(--sw-neutral-500)' }}
          >
            {t('footer.paymentMethods')}
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center">
            {PAYMENT_METHODS.map((p) => (
              <div
                key={p.name}
                className="h-9 w-14 sm:h-10 sm:w-16 rounded-lg flex items-center justify-center border shadow-xs transition hover:-translate-y-0.5 overflow-hidden bg-white"
                style={{ borderColor: 'var(--sw-neutral-200)' }}
              >
                <Image
                  src={p.src}
                  alt={p.label}
                  width={56}
                  height={24}
                  className="max-h-6 max-w-[80%] object-contain"
                />
              </div>
            ))}
          </div>
        </div>

        <div
          className="py-7 flex flex-col md:flex-row items-center justify-between gap-2 text-[0.75rem]"
          style={{ color: 'var(--sw-neutral-500)' }}
        >
          <span suppressHydrationWarning>
            {t('footer.allRights')}{brandName} © {new Date().getFullYear()}
          </span>
          <span className="inline-flex items-center gap-1.5" suppressHydrationWarning>
            {t('footer.madeWith')} <span style={{ color: '#ef4444' }}>♥</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
