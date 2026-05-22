'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Calendar, Menu, X, User } from 'lucide-react';
import { useBranding } from '@/features/branding/public';
import { isAuthenticated } from '@/features/auth/public';
import { NAV_LINKS, SITE } from '../../lib/constants';

export function Navbar() {
  const branding = useBranding();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    setIsAuthed(isAuthenticated());
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
      <nav
        className="sw-nav-glass fixed top-4 left-1/2 z-[1000] w-[calc(100%-16px)] sm:w-[calc(100%-32px)] max-w-[1260px] rounded-full px-3 py-2 flex items-center justify-between transition-all duration-300"
        style={{
          transform: 'translateX(-50%)',
          background: scrolled ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.62)',
          border: '1px solid rgba(255,255,255,0.5)',
        }}
        aria-label="التنقل الرئيسي"
      >
        <Link href="/" aria-label={`الصفحة الرئيسية لـ ${brandName}`} className="flex items-center gap-2 ps-2 pe-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2">
          <Image src={logo} alt={`شعار ${brandName}`} width={32} height={32} className="h-7 sm:h-8 w-auto" style={{ display: 'block' }} unoptimized={logo?.startsWith('http')} />
          <span className="font-extrabold text-sm sm:text-base whitespace-nowrap" style={{ color: 'var(--sw-primary-600)' }}>
            {brandName}
          </span>
        </Link>

        <div className="hidden md:flex gap-0.5 rounded-full p-1" role="menubar">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              role="menuitem"
              className="px-4 py-2 text-[0.813rem] font-semibold rounded-full transition-all duration-200 text-[var(--sw-neutral-700)] hover:bg-[var(--sw-primary-50)] hover:text-[var(--sw-primary-700)] focus-visible:bg-[var(--sw-primary-50)] focus-visible:text-[var(--sw-primary-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Link
            href={isAuthed ? '/account' : '/login'}
            className="inline-flex items-center gap-2 text-[0.813rem] font-semibold px-4 py-2.5 rounded-full transition-all text-[var(--sw-neutral-700)] hover:bg-[var(--sw-primary-50)] hover:text-[var(--sw-primary-700)] focus-visible:bg-[var(--sw-primary-50)] focus-visible:text-[var(--sw-primary-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
          >
            <User className="w-4 h-4" aria-hidden="true" />
            {isAuthed ? 'حسابي' : 'تسجيل الدخول'}
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
            احجز موعدك
            <Calendar className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <button
          onClick={() => setMobileOpen(true)}
          aria-label="فتح القائمة"
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
          aria-label="قائمة التنقل"
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-2 backdrop-blur-xl"
          style={{ background: 'rgba(255,255,255,0.98)' }}
        >
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="إغلاق القائمة"
            className="absolute top-6 end-6 w-11 h-11 rounded-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
            style={{ background: 'var(--sw-neutral-100)' }}
          >
            <X className="w-6 h-6" style={{ color: 'var(--sw-secondary-700)' }} aria-hidden="true" />
          </button>
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="text-xl font-semibold px-9 py-3.5 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
              style={{ color: 'var(--sw-secondary-700)' }}
            >
              {l.label}
            </a>
          ))}
          <Link
            href={isAuthed ? '/account' : '/login'}
            onClick={() => setMobileOpen(false)}
            className="text-xl font-semibold px-9 py-3.5 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sw-primary-500)] focus-visible:ring-offset-2"
            style={{ color: 'var(--sw-primary-700)', background: 'var(--sw-primary-50)' }}
          >
            {isAuthed ? 'حسابي' : 'تسجيل الدخول'}
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
            احجز موعدك
            <Calendar className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </>
  );
}
