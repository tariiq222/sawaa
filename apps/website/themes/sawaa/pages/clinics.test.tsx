import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicCatalog, PublicService } from '@/features/public-catalog/types';
import { SawaaClinicsPage } from './clinics';

vi.mock('@/features/locale/public', () => ({ getLocale: async () => 'en' }));

const category = { id: 'clinic', nameAr: 'عيادة', nameEn: 'Clinic', departmentId: null, sortOrder: 0, isActive: true, imageUrl: null, iconName: null, iconBgColor: null, kind: 'CLINIC' as const, bookingMode: 'SERVICES' as const };
const service: PublicService = { id: 'assigned', categoryId: 'clinic', nameAr: 'جلسة', nameEn: 'Session', descriptionAr: 'وصف', descriptionEn: 'Session description', durationMins: 45, price: '5000', currency: 'SAR', imageUrl: null, iconName: null, iconBgColor: null };
const catalog: PublicCatalog = { departments: [], categories: [category], services: [service, { ...service, id: 'unassigned' }], vatRate: 0 };
const employee = { id: 'practitioner', isBookable: true, serviceIds: ['assigned'] };
function respond(data: unknown) { return Promise.resolve({ ok: true, json: async () => data }); }
function fetchCatalogAndEmployees(data: PublicCatalog, employees: unknown[] | Error) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (url.includes('/public/services?includeDirectClinics=true')) return respond(data);
    if (url.includes('/public/employees?includeDirectClinics=true')) return employees instanceof Error ? Promise.reject(employees) : respond(employees);
    throw new Error(`Unexpected URL: ${url}`);
  }));
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('clinic discovery presentation', () => {
  it('renders load failure after employee fetch rejects, not an empty catalog', async () => {
    fetchCatalogAndEmployees(catalog, new TypeError('Network unavailable'));
    render(await SawaaClinicsPage());
    expect(screen.getByRole('alert').textContent).toContain('Clinics could not be loaded');
    expect(screen.queryByText('Clinics are being prepared')).toBeNull();
  });
  it('keeps a successfully empty catalog distinct from load failure', async () => {
    fetchCatalogAndEmployees({ departments: [], categories: [], services: [] }, []);
    render(await SawaaClinicsPage());
    expect(screen.getByText('Clinics are being prepared')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('counts only services assigned to bookable practitioners', async () => {
    fetchCatalogAndEmployees(catalog, [employee, { id: 'disabled', isBookable: false, serviceIds: ['unassigned'] }]);
    render(await SawaaClinicsPage());
    expect(screen.getByText('services available to book').parentElement?.textContent).toBe('01services available to book');
    expect(screen.getByRole('link', { name: 'Book now — Clinic' }).getAttribute('href')).toBe('/booking?categoryId=clinic');
    expect(screen.getByText('Session description')).toBeTruthy();
  });
  it('links a DIRECT clinic to its hidden service and excludes service groups', async () => {
    fetchCatalogAndEmployees({ ...catalog, categories: [{ ...category, bookingMode: 'DIRECT' }, { ...category, id: 'group', kind: 'SERVICE_GROUP', nameEn: 'Assessment group' }], services: [service, { ...service, id: 'internal', isHidden: true }, { ...service, id: 'assessment', categoryId: 'group' }] }, [{ ...employee, serviceIds: ['internal', 'assessment'] }]);
    render(await SawaaClinicsPage());
    expect(screen.getByRole('link', { name: 'Book now — Clinic' }).getAttribute('href')).toBe('/booking?serviceId=internal');
    expect(screen.queryByRole('link', { name: /Assessment group/ })).toBeNull();
    expect(screen.getByText('services available to book').parentElement?.textContent).toBe('01services available to book');
  });
});
