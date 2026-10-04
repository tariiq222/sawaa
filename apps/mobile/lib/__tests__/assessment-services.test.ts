import { getAssessmentServices } from '../assessment-services';
import type { PublicCatalogRaw } from '@/services/client/catalog';

const catalog: PublicCatalogRaw = {
  departments: [],
  categories: [
    { id: 'assessment', departmentId: null, nameAr: 'القياس والتقويم', nameEn: 'Assessment & Evaluation', sortOrder: 0 },
    { id: 'clinic', departmentId: null, nameAr: 'عيادة', nameEn: 'Clinic', sortOrder: 1 },
  ],
  services: [
    { id: 'real-assessment', categoryId: 'assessment', nameAr: 'فحص الحالة العقلية', nameEn: null, price: 5000, currency: 'SAR', imageUrl: null },
    { id: 'unrelated', categoryId: 'clinic', nameAr: 'مقياس آخر', nameEn: null, price: 5000, currency: 'SAR', imageUrl: null },
  ],
};
it('joins the named production group by category ID, not service title', () => {
  expect(getAssessmentServices(catalog).map((service) => service.id)).toEqual(['real-assessment']);
});
it('excludes hidden, inactive, archived, and direct booking entries', () => {
  for (const change of [{ isHidden: true }, { isActive: false }, { archivedAt: '2026-09-27' }]) {
    expect(getAssessmentServices({ ...catalog, services: [{ ...catalog.services[0], ...change }] })).toEqual([]);
  }
  expect(getAssessmentServices({ ...catalog, categories: [{ ...catalog.categories[0], bookingMode: 'DIRECT' }] })).toEqual([]);
});
it('does not invent services when the catalog or group is missing', () => {
  expect(getAssessmentServices(undefined)).toEqual([]);
  expect(getAssessmentServices({ ...catalog, categories: [] })).toEqual([]);
});
