import { Prisma } from '@prisma/client';
import { mapEmployeeRow } from './employee-row.mapper';

describe('mapEmployeeRow', () => {
  it('maps employee with all relations', () => {
    const employee = {
      id: 'e1',
      userId: 'u1',
      name: 'John',
      nameAr: 'جون',
      nameEn: 'John',
      title: 'Dr',
      specialty: 'Cardiology',
      specialtyAr: 'قلبية',
      phone: '+966500000000',
      email: 'john@example.com',
      gender: 'MALE' as const,
      avatarUrl: 'https://example.com/avatar.jpg',
      bio: 'Bio',
      bioAr: 'نبذة',
      education: 'MD',
      educationAr: 'دكتوراه',
      experience: 10,
      employmentType: 'FULL_TIME' as const,
      onboardingStatus: 'COMPLETED' as const,
      isActive: true,
      isPublic: false,
      slug: null,
      publicBioAr: null,
      publicBioEn: null,
      publicImageUrl: null,
      commissionRate: new Prisma.Decimal('1.0'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
      branches: [{ id: 'eb1', branchId: 'b1', employeeId: 'e1' }],
      services: [{ id: 'es1', employeeId: 'e1', serviceId: 's1' }],
      availability: [{ id: 'ea1', employeeId: 'e1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true, createdAt: new Date(), updatedAt: new Date() }],
    };

    const result = mapEmployeeRow(employee, { avg: 4.5, count: 10 }, 25);

    expect(result.id).toBe('e1');
    expect(result.branchIds).toEqual(['b1']);
    expect(result.serviceIds).toEqual(['s1']);
    expect(result.availability).toHaveLength(1);
    expect(result.averageRating).toBe(4.5);
    expect(result.ratingCount).toBe(10);
    expect(result.bookingCount).toBe(25);
  });

  it('maps employee with missing relations using defaults', () => {
    const employee = {
      id: 'e2',
      userId: null,
      name: 'Jane',
      nameAr: null,
      nameEn: null,
      title: null,
      specialty: null,
      specialtyAr: null,
      phone: null,
      email: null,
      gender: 'FEMALE' as const,
      avatarUrl: null,
      bio: null,
      bioAr: null,
      education: null,
      educationAr: null,
      experience: null,
      employmentType: 'PART_TIME' as const,
      onboardingStatus: 'PENDING' as const,
      isActive: false,
      isPublic: false,
      slug: null,
      publicBioAr: null,
      publicBioEn: null,
      publicImageUrl: null,
      commissionRate: new Prisma.Decimal('1.0'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
      branches: undefined,
      services: undefined,
      availability: undefined,
    };

    const result = mapEmployeeRow(employee);

    expect(result.branchIds).toEqual([]);
    expect(result.serviceIds).toEqual([]);
    expect(result.availability).toEqual([]);
    expect(result.averageRating).toBeNull();
    expect(result.ratingCount).toBe(0);
    expect(result.bookingCount).toBe(0);
  });
});
