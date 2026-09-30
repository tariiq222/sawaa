import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/features/locale/locale-provider';
import { SawaaPackagesPage } from './packages';
import { SawaaPackageDetailPage } from './package-detail';
import { SawaaPackagePurchasePage } from './package-purchase';

vi.mock('@/features/locale/public', () => ({ getLocale: async () => 'en' }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('package page presentation', () => {
  it('propagates a rejected catalog fetch to a load-failure alert', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network unavailable')));
    render(<LocaleProvider locale="en">{await SawaaPackagesPage()}</LocaleProvider>);
    expect(screen.getByRole('alert').textContent).toContain('Packages could not be loaded');
    expect(screen.queryByText('No packages are available right now.')).toBeNull();
  });
  it('keeps a successfully empty package list distinct', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<LocaleProvider locale="en">{await SawaaPackagesPage()}</LocaleProvider>);
    expect(screen.getByRole('status').textContent).toContain('No packages');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('offers a route back to the catalog from missing package detail and purchase pages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    const view = render(await SawaaPackageDetailPage({ familyId: 'missing' }));
    expect(screen.getByRole('alert').textContent).toBe('Package not found.');
    expect(screen.getByRole('link', { name: 'Back to packages' }).getAttribute('href')).toBe('/packages');
    view.rerender(await SawaaPackagePurchasePage({ packageId: 'missing' }));
    expect(screen.getByRole('alert').textContent).toBe('Package not found.');
    expect(screen.getByRole('link', { name: 'Back to packages' }).getAttribute('href')).toBe('/packages');
  });
});
