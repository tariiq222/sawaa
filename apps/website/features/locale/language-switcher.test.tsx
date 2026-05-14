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
    document.cookie = 'deqah-locale=; path=/; max-age=0';
  });

  afterEach(() => {
    document.cookie = 'deqah-locale=; path=/; max-age=0';
  });

  it('highlights the current locale and dims the other', () => {
    render(<LanguageSwitcher current="ar" />);
    const ar = screen.getByRole('button', { name: 'ع' });
    const en = screen.getByRole('button', { name: 'EN' });
    expect((ar.style as CSSStyleDeclaration).fontWeight).toBe('700');
    expect((en.style as CSSStyleDeclaration).fontWeight).toBe('400');
  });

  it('writes the locale cookie and calls router.refresh on click', () => {
    render(<LanguageSwitcher current="ar" />);
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(document.cookie).toContain('deqah-locale=en');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('switches back to ar when the Arabic button is clicked', () => {
    render(<LanguageSwitcher current="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'ع' }));
    expect(document.cookie).toContain('deqah-locale=ar');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
