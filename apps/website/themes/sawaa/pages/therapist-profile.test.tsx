import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicEmployee } from '@sawaa/api-client';
import type { PublicService } from '@/features/public-catalog/types';
import { SawaaTherapistProfilePage } from './therapist-profile';

const therapist: PublicEmployee = { id: 'e1', slug: 'sara', nameAr: 'د. سارة أحمد', nameEn: 'Dr. Sara Ahmed', title: null, specialty: null, specialtyAr: null, publicBioAr: null, publicBioEn: null, publicImageUrl: null, gender: null, employmentType: 'FULL_TIME', ratingAverage: null, ratingCount: 0, minServicePrice: null, isAvailableToday: false, serviceIds: ['visible', 'hidden', 'disabled', 'archived'], branchIds: ['branch'], isBookable: true, availableDaysOfWeek: [] };
const service: PublicService = { id: 'visible', categoryId: 'clinic', nameAr: 'جلسة', nameEn: 'Visible session', descriptionAr: null, descriptionEn: null, durationMins: 45, price: '5000', currency: 'SAR', imageUrl: null, iconName: null, iconBgColor: null };
function setResponses(employee = therapist, showDuration = true) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    let data: unknown;
    if (url.includes('/public/employees/sara?includeDirectClinics=true')) data = employee;
    else if (url.includes('/public/employees?includeDirectClinics=true')) data = [employee];
    else if (url.includes('/public/services?includeDirectClinics=true')) data = {
      departments: [],
      categories: [{ id: 'clinic', nameAr: 'عيادة', nameEn: 'Clinic', departmentId: null, sortOrder: 0, isActive: true, imageUrl: null, iconName: null, iconBgColor: null }],
      services: [
        { ...service, showDuration },
        { ...service, id: 'hidden', nameEn: 'Internal session', isHidden: true },
        { ...service, id: 'disabled', nameEn: 'Disabled session', isActive: false },
        { ...service, id: 'archived', nameEn: 'Archived session', archivedAt: '2026-09-01' },
        { ...service, id: 'unassigned', nameEn: 'Unassigned session' },
      ],
    };
    else throw new Error(`Unexpected URL: ${url}`);
    return Promise.resolve({ ok: true, json: async () => data });
  }));
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('therapist presentation', () => {
  it('shows only assigned bookable visible services and strips the title in the booking CTA', async () => {
    setResponses();
    render(await SawaaTherapistProfilePage({ slug: 'sara', locale: 'en' }));
    expect(screen.getByText('Visible session')).toBeTruthy();
    expect(screen.getByText('Visible session').textContent).toContain('45 min');
    for (const name of ['Internal session', 'Disabled session', 'Archived session', 'Unassigned session']) expect(screen.queryByText(name)).toBeNull();
    expect(screen.getByRole('link', { name: 'Book with Sara Ahmed' }).getAttribute('href')).toBe('/booking?employeeId=e1');
  });
  it('respects duration visibility', async () => {
    setResponses(therapist, false);
    render(await SawaaTherapistProfilePage({ slug: 'sara', locale: 'en' }));
    expect(screen.getByText('Visible session').textContent).not.toContain('45');
  });
  it('shows unavailable copy without a booking CTA when the practitioner cannot be booked', async () => {
    setResponses({ ...therapist, isBookable: false });
    render(await SawaaTherapistProfilePage({ slug: 'sara', locale: 'en' }));
    expect(screen.getByText('Not available for booking right now')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Book with/ })).toBeNull();
  });
});
