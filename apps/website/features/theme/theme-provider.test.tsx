import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ThemeProvider, useTheme } from './theme-provider';

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>{theme}</button>;
}

describe('website theme', () => {
  let notifySystemChange: ((dark: boolean) => void) | undefined;

  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'sawaa-theme=; path=/; max-age=0';
    document.documentElement.dataset.theme = 'light';
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
          notifySystemChange = (dark) => listener({ matches: dark } as MediaQueryListEvent);
        },
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    notifySystemChange = undefined;
    localStorage.clear();
    document.cookie = 'sawaa-theme=; path=/; max-age=0';
    document.documentElement.dataset.theme = 'light';
  });

  it('uses the theme set before hydration and persists an explicit toggle', () => {
    document.documentElement.dataset.theme = 'dark';
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('dark');

    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('sawaa-theme')).toBe('light');
    expect(document.cookie).toContain('sawaa-theme=light');
    expect(screen.getByRole('button')).toHaveTextContent('light');
  });

  it('follows system changes until the visitor chooses a theme', () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => notifySystemChange?.(true));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button')).toHaveTextContent('dark');

    fireEvent.click(screen.getByRole('button'));
    act(() => notifySystemChange?.(true));
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
