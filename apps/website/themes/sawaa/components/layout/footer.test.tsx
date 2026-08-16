import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/features/locale/locale-provider';
import type { SupportGroup } from '@/features/support-groups/support-groups.api';
import { Footer } from './footer';

vi.mock('@/features/branding/public', () => ({
  useBranding: () => ({
    logoUrl: null,
    organizationNameAr: 'مركز سواء',
    productTagline: 'رعاية نفسية موثوقة',
  }),
}));

const program: SupportGroup = {
  id: 'program-1',
  ref: 1,
  title: 'برنامج الأسرة',
  nameAr: 'برنامج الأسرة',
  nameEn: 'Family Program',
  descriptionAr: null,
  descriptionEn: null,
  publicDescriptionAr: null,
  publicDescriptionEn: null,
  departmentId: 'department-1',
  branchId: 'branch-1',
  startDate: null,
  daysCount: 3,
  hoursPerDay: 2,
  minParticipants: 2,
  maxParticipants: 8,
  enrolledCount: 1,
  price: '0',
  currency: 'SAR',
  depositEnabled: false,
  depositAmount: null,
  status: 'OPEN',
  isPublic: true,
  isFull: false,
  spotsLeft: 7,
};

describe('Footer group programs', () => {
  it('uses the published program name and deep link', () => {
    render(
      <LocaleProvider locale="en">
        <Footer supportGroups={[program]} />
      </LocaleProvider>,
    );

    expect(screen.getByText('Group programs')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Family Program' })).toHaveAttribute(
      'href',
      '/support-groups/program-1',
    );
  });
});
