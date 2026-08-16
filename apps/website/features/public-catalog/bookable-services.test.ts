import { describe, expect, it } from 'vitest';
import type { PublicEmployee } from '@sawaa/api-client';

import type { PublicCatalog } from './types';
import { selectBookableClinicServices } from './bookable-services';

const catalog = {
  departments: [
    {
      id: 'dept-clinics',
      nameAr: 'عيادات',
      nameEn: 'Clinics',
      descriptionAr: null,
      descriptionEn: null,
      icon: null,
      sortOrder: 1,
      isVisible: true,
      isActive: true,
    },
    {
      id: 'dept-groups',
      nameAr: 'جماعية',
      nameEn: 'Groups',
      descriptionAr: null,
      descriptionEn: null,
      icon: null,
      sortOrder: 2,
      isVisible: true,
      isActive: true,
    },
  ],
  categories: [
    {
      id: 'category-assessment',
      departmentId: 'dept-clinics',
      nameAr: 'القياس والتقويم',
      nameEn: 'Assessment & Evaluation',
      sortOrder: 1,
      isActive: true,
      imageUrl: null,
      iconName: 'Analytics01Icon',
      iconBgColor: '#2D7AB0',
    },
    {
      id: 'category-groups',
      departmentId: 'dept-groups',
      nameAr: 'العلاج بالفن',
      nameEn: 'Art Therapy',
      sortOrder: 1,
      isActive: true,
      imageUrl: null,
      iconName: 'Sparkles',
      iconBgColor: '#2FA694',
    },
  ],
  services: [
    {
      id: 'service-mental-status',
      categoryId: 'category-assessment',
      nameAr: 'فحص الحالة العقلية',
      nameEn: 'Mental Status Examination',
      descriptionAr: 'تقييم سريري للحالة العقلية الراهنة.',
      descriptionEn: 'A clinical assessment of current mental status.',
      durationMins: 45,
      price: '5000',
      currency: 'SAR',
      imageUrl: null,
      iconName: null,
      iconBgColor: null,
      showPrice: true,
      showDuration: true,
      durationOptions: [],
      bookingConfigs: [
        { id: 'config-1', deliveryType: 'IN_PERSON', price: '5000', durationMins: 45 },
        { id: 'config-2', deliveryType: 'ONLINE', price: '5000', durationMins: 45 },
        { id: 'config-3', deliveryType: 'IN_PERSON', price: '5000', durationMins: 45 },
      ],
    },
    {
      id: 'service-unassigned',
      categoryId: 'category-assessment',
      nameAr: 'خدمة بلا مختص',
      nameEn: 'Unassigned service',
      descriptionAr: null,
      descriptionEn: null,
      durationMins: 30,
      price: '10000',
      currency: 'SAR',
      imageUrl: null,
      iconName: null,
      iconBgColor: null,
      showPrice: true,
      showDuration: true,
      durationOptions: [],
      bookingConfigs: [],
    },
    {
      id: 'service-group',
      categoryId: 'category-groups',
      nameAr: 'جلسة جماعية',
      nameEn: 'Group session',
      descriptionAr: null,
      descriptionEn: null,
      durationMins: 90,
      price: '15000',
      currency: 'SAR',
      imageUrl: null,
      iconName: null,
      iconBgColor: null,
      showPrice: true,
      showDuration: true,
      durationOptions: [],
      bookingConfigs: [
        { id: 'config-group', deliveryType: 'IN_PERSON', price: '15000', durationMins: 90 },
      ],
    },
  ],
  vatRate: 0.15,
} as unknown as PublicCatalog;

const employees = [
  {
    id: 'employee-1',
    isBookable: true,
    serviceIds: ['service-mental-status', 'service-group'],
  },
  {
    id: 'employee-2',
    isBookable: true,
    serviceIds: ['service-mental-status'],
  },
  {
    id: 'employee-disabled',
    isBookable: false,
    serviceIds: ['service-mental-status', 'service-unassigned'],
  },
] as unknown as PublicEmployee[];

describe('selectBookableClinicServices', () => {
  it('returns only clinic services assigned to bookable practitioners', () => {
    const result = selectBookableClinicServices(catalog, employees);

    expect(result.map((item) => item.service.id)).toEqual(['service-mental-status']);
    expect(result[0]).toMatchObject({
      categoryId: 'category-assessment',
      categoryNameAr: 'القياس والتقويم',
      categoryNameEn: 'Assessment & Evaluation',
    });
  });

  it('counts unique bookable practitioners and delivery types', () => {
    const [result] = selectBookableClinicServices(catalog, employees);

    expect(result.practitionerCount).toBe(2);
    expect(result.deliveryTypes).toEqual(['IN_PERSON', 'ONLINE']);
  });

  it('returns an empty list when the public clinics department is absent', () => {
    const withoutClinics = {
      ...catalog,
      departments: catalog.departments.filter((department) => department.id !== 'dept-clinics'),
    };

    expect(selectBookableClinicServices(withoutClinics, employees)).toEqual([]);
  });
});
