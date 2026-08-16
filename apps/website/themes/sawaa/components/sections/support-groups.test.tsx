import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import type { SupportGroup } from '@/features/support-groups/support-groups.api';
import type { SectionIntro } from '@/features/site-content/public';
import { SupportGroups } from './support-groups';

vi.mock('@/features/locale/public', () => ({
  getLocale: () => Promise.resolve('en'),
}));

vi.stubGlobal(
  'IntersectionObserver',
  class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const intro: SectionIntro = {
  tag: 'Group Programs',
  titlePrefix: 'Programs designed for',
  titleHighlight: 'shared progress',
  titleSuffix: '',
  subtitle: 'Join a published program led by Sawaa specialists.',
};

const program: SupportGroup = {
  id: 'program-family-skills',
  ref: 17,
  title: 'مهارات التواصل الأسري',
  nameAr: 'مهارات التواصل الأسري',
  nameEn: 'Family Communication Skills',
  descriptionAr: 'برنامج عملي لتحسين التواصل داخل الأسرة.',
  descriptionEn: 'A practical program for healthier family communication.',
  publicDescriptionAr: 'خطوات عملية تطبقها الأسرة معًا.',
  publicDescriptionEn: 'Practical steps families can apply together.',
  departmentId: 'department-programs',
  branchId: 'branch-riyadh',
  startDate: '2026-09-15T15:00:00.000Z',
  daysCount: 4,
  hoursPerDay: 2,
  minParticipants: 5,
  maxParticipants: 12,
  enrolledCount: 5,
  price: '50000',
  currency: 'SAR',
  depositEnabled: false,
  depositAmount: null,
  status: 'OPEN',
  isPublic: true,
  isFull: false,
  spotsLeft: 7,
};

describe('Group programs home section', () => {
  it('renders the published dashboard program facts and links to its real detail page', async () => {
    render(await SupportGroups({ intro, items: [program] }));

    expect(screen.getByText('Family Communication Skills')).toBeInTheDocument();
    expect(screen.getByText('Practical steps families can apply together.')).toBeInTheDocument();
    expect(screen.getByText('4 days')).toBeInTheDocument();
    expect(screen.getByText('2 hours / day')).toBeInTheDocument();
    expect(screen.getByText('7 seats left')).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /View details.*Family Communication Skills/ }),
    ).toHaveAttribute('href', '/support-groups/program-family-skills');
  });

  it('shows an honest empty state instead of fallback programs', async () => {
    render(await SupportGroups({ intro, items: [] }));

    expect(screen.getByText('Programs are being prepared')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View details/ })).not.toBeInTheDocument();
  });

  it('distinguishes a loading failure from a successful empty catalog', async () => {
    render(await SupportGroups({ intro, items: [], loadFailed: true }));

    expect(screen.getByText('Programs could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText('Programs are being prepared')).not.toBeInTheDocument();
  });

  it('keeps the homepage summary bounded and leaves the full catalog to the directory', async () => {
    const programs = Array.from({ length: 6 }, (_, index) => ({
      ...program,
      id: `program-${index + 1}`,
      nameEn: `Program ${index + 1}`,
    }));

    render(await SupportGroups({ intro, items: programs }));

    expect(screen.getAllByRole('link', { name: /View details/ })).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'View all programs' })).toHaveAttribute(
      'href',
      '/support-groups',
    );
  });

  it('renders the homepage section on the midnight palette with an inverse header', async () => {
    render(await SupportGroups({ intro, items: [program] }));

    const section = screen.getByRole('heading', { name: /shared progress/ }).closest('section');
    expect(section).toHaveClass('sw-section-midnight');
    expect(screen.getByRole('heading', { name: /shared progress/ }).parentElement).toHaveAttribute(
      'data-tone',
      'inverse',
    );
  });
});
