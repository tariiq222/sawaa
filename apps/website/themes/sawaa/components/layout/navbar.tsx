'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Calendar, Menu, X, User } from 'lucide-react';
import { useBranding } from '@/features/branding/public';
import { isAuthenticated } from '@/features/auth/public';
import { useT } from '@/features/locale/locale-provider';
import { SITE } from '../../lib/constants';

const navLinks = [
  { key: 'nav.home', href: '/' },
  { key: 'nav.therapists', href: '/therapists' },
  { key: 'nav.supportGroups', href: '/support-groups' },
  { key: 'nav.burnout', href: '/burnout-test' },
  { key: 'nav.contact', href: '/contact' },
] as const;

export function Navbar() {
  const t = useT();
  const branding = useBranding();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setScrolled(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const brandName = branding.organizationNameAr || SITE.nameShort;
  const logo = branding.logoUrl ?? SITE.logo;

  return (
    <>
      <div
        ref={sentinelRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '40px',
          left: 0,
          height: '1px',
          width: '1px',
          pointerEvents: 'none',
          opacity: 0,
        }}
      />
      <nav
        className="sw-nav-glass fixed top-4 left-1/2 z-[1000] w-[calc(100%-16px)] sm:w-[calc(100%-32px)] max-w-[1260px] rounded-full px-3 py-2 flex items-center justify-between transition-all duration-300"
        style={{
          transform: 'translateX(-50%)',
          background: scrolled ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.62)',
          border: '1px solid rgba(255,255,255,0.5)',
        }}
        aria-label={t('nav.ariaPrimary')}
      >
        <Link href="/" aria-label={`${t('nav.ariaHomePrefix')} ${brandName}`} className="flex items-center gap-2 ps-2 pe-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2">
          <Image src={logo} alt={`${t('nav.logoAltPrefix')} ${brandName}`} width={32} height={32} className="h-7 sm:h-8 w-auto" style={{ display: 'block' }} />
          <span className="font-extrabold text-sm sm:text-base whitespace-nowrap" style={{ color: 'var(--sw-primary-600)' }}>
            سواء للإرشاد الأسري
          </span>
        </Link>

        <div className="hidden md:flex gap-0.5 rounded-full p-1" role="menubar">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              role="menuitem"
              className="px-4 py-2 text-[0.813rem] font-semibold rounded-full transition-all duration-200 text-[var(--sw-neutral-700)] hover:bg-[var(--sw-primary-50)] hover:text-[var(--sw-primary-700)] focus-visible:bg-[var(--sw-primary-50)] focus-visible:text-[var(--sw-primary-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
            >
              {t(l.key)}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Link
            href={isAuthenticated() ? '/account' : '/login'}
            className="inline-flex items-center gap-2 text-[0.813rem] font-semibold px-4 py-2.5 rounded-full transition-all text-[var(--sw-neutral-700)] hover:bg-[var(--sw-primary-50)] hover:text-[var(--sw-primary-700)] focus-visible:bg-[var(--sw-primary-50)] focus-visible:text-[var(--sw-primary-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
          >
            <User className="w-4 h-4" aria-hidden="true" />
            {isAuthenticated() ? t('nav.account') : t('nav.login')}
          </Link>
          <Link
            href="/booking"
            className="inline-flex items-center gap-2 text-[0.813rem] font-bold px-5 py-2.5 rounded-full transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
            style={{
              background: 'var(--sw-primary-500)',
              color: '#fff',
              boxShadow: 'var(--sw-shadow-primary)',
            }}
          >
            {t('nav.booking')}
            <Calendar className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <button
          onClick={() => setMobileOpen(true)}
          aria-label={t('nav.openMenu')}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          className="md:hidden w-10 h-10 rounded-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
          style={{ background: 'var(--sw-primary-50)' }}
        >
          <Menu className="w-5 h-5" style={{ color: 'var(--sw-primary-700)' }} aria-hidden="true" />
        </button>
      </nav>

      {mobileOpen ? (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.menuLabel')}
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-2 backdrop-blur-xl"
          style={{ background: 'rgba(255,255,255,0.98)' }}
        >
          <button
            onClick={() => setMobileOpen(false)}
            aria-label={t('nav.closeMenu')}
            className="absolute top-6 end-6 w-11 h-11 rounded-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
            style={{ background: 'var(--sw-neutral-100)' }}
          >
            <X className="w-6 h-6" style={{ color: 'var(--sw-secondary-700)' }} aria-hidden="true" />
          </button>
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="text-xl font-semibold px-9 py-3.5 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
              style={{ color: 'var(--sw-secondary-700)' }}
            >
              {t(l.key)}
            </a>
          ))}
          <Link
            href={isAuthenticated() ? '/account' : '/login'}
            onClick={() => setMobileOpen(false)}
            className="text-xl font-semibold px-9 py-3.5 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
            style={{ color: 'var(--sw-primary-700)', background: 'var(--sw-primary-50)' }}
          >
            {isAuthenticated() ? t('nav.account') : t('nav.login')}
          </Link>
          <Link
            href="/booking"
            onClick={() => setMobileOpen(false)}
            className="mt-5 inline-flex items-center gap-2 font-bold px-9 py-4 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
            style={{
              background: 'var(--sw-primary-500)',
              color: '#fff',
              boxShadow: 'var(--sw-shadow-primary)',
            }}
          >
            {t('nav.booking')}
            <Calendar className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </>
  );
}
