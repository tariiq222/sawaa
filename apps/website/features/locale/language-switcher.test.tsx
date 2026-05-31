import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), replace: vi.fn() }),
}));

import { LanguageSwitcher } from './language-switcher';

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    document.cookie = 'sawaa-locale=; path=/; max-age=0';
  });

  afterEach(() => {
    document.cookie = 'sawaa-locale=; path=/; max-age=0';
  });

  it('marks the current locale as pressed and the other as not', () => {
    render(<LanguageSwitcher current="ar" />);
    const ar = screen.getByRole('button', { name: 'ع' });
    const en = screen.getByRole('button', { name: 'EN' });
    expect(ar.getAttribute('aria-pressed')).toBe('true');
    expect(en.getAttribute('aria-pressed')).toBe('false');
  });

  it('writes the locale cookie and calls router.refresh on click', () => {
    render(<LanguageSwitcher current="ar" />);
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(document.cookie).toContain('sawaa-locale=en');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('switches back to ar when the Arabic button is clicked', () => {
    render(<LanguageSwitcher current="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'ع' }));
    expect(document.cookie).toContain('sawaa-locale=ar');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
