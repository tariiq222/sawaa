import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';

vi.mock('@/features/branding/public', () => ({
  useBranding: () => ({ logoUrl: null }),
}));

vi.mock('@/features/auth/public', () => ({
  isAuthenticated: () => false,
}));

const { toggleTheme } = vi.hoisted(() => ({ toggleTheme: vi.fn() }));
vi.mock('@/features/theme/theme-provider', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { Navbar } from './navbar';
import { LocaleProvider } from '@/features/locale/locale-provider';
import type { Locale } from '@/features/locale/locale';

function wrap(locale: Locale, children: ReactNode) {
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>;
}

/** Opens the mobile menu, returning the hamburger trigger (with focus on it). */
function openMenu() {
  const open = screen.getByRole('button', { name: 'فتح القائمة' });
  open.focus();
  fireEvent.click(open);
  return open;
}

describe('Navbar mobile menu dialog keyboard focus', () => {
  it('offers an accessible theme toggle on desktop and in the mobile menu', () => {
    render(wrap('ar', <Navbar />));
    const toggles = screen.getAllByRole('button', { name: 'التبديل إلى الوضع الداكن' });
    expect(toggles).toHaveLength(1);

    fireEvent.click(toggles[0]);
    expect(toggleTheme).toHaveBeenCalledOnce();

    openMenu();
    const mobileToggle = within(screen.getByRole('dialog')).getByRole('button', {
      name: 'التبديل إلى الوضع الداكن',
    });
    expect(mobileToggle).toBeVisible();
    fireEvent.click(mobileToggle);
    expect(toggleTheme).toHaveBeenCalledTimes(2);
  });

  it('links customers to the services directory instead of clinics', () => {
    render(wrap('ar', <Navbar />));
    expect(screen.getByRole('menuitem', { name: 'الخدمات' })).toHaveAttribute(
      'href',
      '/services',
    );
  });

  it('labels the dashboard-backed programs as group programs', () => {
    render(wrap('ar', <Navbar />));
    expect(screen.getByRole('menuitem', { name: 'البرامج الجماعية' })).toHaveAttribute(
      'href',
      '/support-groups',
    );
  });

  it('opens a named dialog and moves focus to the close button', () => {
    render(wrap('ar', <Navbar />));
    openMenu();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('قائمة التنقل');
    expect(screen.getByRole('button', { name: 'إغلاق القائمة' })).toHaveFocus();
  });

  it('wraps Tab from the last focusable back to the close button', () => {
    render(wrap('ar', <Navbar />));
    openMenu();
    // jsdom does not apply the desktop `md:hidden` utility, so the
    // LanguageSwitcher exists twice (desktop bar + mobile dialog); scope the
    // focus order assertions to the dialog subtree.
    const dialog = screen.getByRole('dialog');
    const last = within(dialog).getByRole('button', { name: 'EN' });
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(within(dialog).getByRole('button', { name: 'إغلاق القائمة' })).toHaveFocus();
  });

  it('wraps Shift+Tab from the close button to the last focusable', () => {
    render(wrap('ar', <Navbar />));
    openMenu();
    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: 'إغلاق القائمة' });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(within(dialog).getByRole('button', { name: 'EN' })).toHaveFocus();
  });

  it('locks body scroll while the menu is open', () => {
    render(wrap('ar', <Navbar />));
    expect(document.body.style.overflow).toBe('');
    openMenu();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('uses the high-contrast booking treatment inside the mobile dialog', () => {
    render(wrap('ar', <Navbar />));
    openMenu();
    const booking = within(screen.getByRole('dialog')).getByRole('link', {
      name: 'احجز موعدك',
    });
    expect(booking).toHaveClass('sw-home-nav-cta');
    expect(booking).not.toHaveStyle({ color: '#fff' });
  });

  it('closes on Escape, restores focus to the trigger and unlocks body scroll', () => {
    render(wrap('ar', <Navbar />));
    const open = openMenu();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(open).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });
});
