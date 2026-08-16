import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';

import { SectionHeader } from './section-header';

describe('SectionHeader contrast', () => {
  it('renders an inverse heading treatment for dark section backgrounds', () => {
    render(
      <SectionHeader
        tone="inverse"
        tag="مجموعة دعم"
        title="مساحة آمنة للمشاركة"
        subtitle="لقاءات يقودها مختصون"
      />,
    );

    const heading = screen.getByRole('heading', { name: 'مساحة آمنة للمشاركة' });
    expect(heading.closest('[data-tone]')).toHaveAttribute('data-tone', 'inverse');
    expect(heading).toHaveStyle({ color: 'var(--sw-home-white)' });
    expect(screen.getByText('لقاءات يقودها مختصون')).toHaveStyle({
      color: 'var(--sw-secondary-100)',
    });
  });
});
