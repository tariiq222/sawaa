import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';

import { LocaleProvider } from '@/features/locale/locale-provider';
import { LegalPage } from './legal-page';

describe('LegalPage review notice', () => {
  it('does not render an empty review notice when the page has no notice', () => {
    const { container } = render(
      <LocaleProvider locale="en">
        <LegalPage
          titleKey="legal.privacy.title"
          introKey="legal.privacy.intro"
          sections={[]}
          updatedKey="legal.lastUpdated"
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(container.querySelector('p.border')).toBeNull();
  });

  it('preserves a supplied review notice for other legal pages', () => {
    const { container } = render(
      <LocaleProvider locale="ar">
        <LegalPage
          titleKey="legal.terms.title"
          introKey="legal.terms.intro"
          sections={[]}
          updatedKey="legal.lastUpdated"
          reviewNoticeKey="legal.reviewNotice"
        />
      </LocaleProvider>,
    );

    expect(container.querySelector('p.border')).not.toBeEmptyDOMElement();
  });
});
