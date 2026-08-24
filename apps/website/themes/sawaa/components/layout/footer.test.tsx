import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/features/locale/locale-provider';
import { SITE } from '../../lib/constants';
import { Footer } from './footer';

vi.mock('@/features/branding/public', () => ({
  useBranding: () => ({
    logoUrl: null,
    organizationNameAr: 'مركز سواء',
    productTagline: 'رعاية نفسية موثوقة',
  }),
}));

describe('Footer quick links', () => {
  it('renders Quick links heading, contact/privacy links, social text list, and omits removed links', () => {
    render(
      <LocaleProvider locale="en">
        <Footer />
      </LocaleProvider>,
    );

    expect(screen.getByText('Quick links')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');

    expect(
      screen.getAllByRole('link', { name: 'TikTok' }).some(
        (link) => link.getAttribute('href') === SITE.social.tiktok,
      ),
    ).toBe(true);
    expect(
      screen.getAllByRole('link', { name: 'X' }).some(
        (link) => link.getAttribute('href') === SITE.social.x,
      ),
    ).toBe(true);
    expect(
      screen.getAllByRole('link', { name: 'Instagram' }).some(
        (link) => link.getAttribute('href') === SITE.social.instagram,
      ),
    ).toBe(true);
    expect(
      screen.getAllByRole('link', { name: 'YouTube' }).some(
        (link) => link.getAttribute('href') === SITE.social.youtube,
      ),
    ).toBe(true);

    expect(screen.queryByText('Services')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Group Programs' })).toBeNull();
  });
});
