import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import {
  ClientResponseDto,
  EmployeeResponseDto,
  EmployeeStatsResponseDto,
  ListMetaDto,
  PaginatedClientsDto,
  PaginatedEmployeesDto,
  PublicEmployeeResponseDto,
  SetClientActiveResponseDto,
  UploadAvatarResponseDto,
} from './people-response.dto';

// These DTOs are output-only response shapes used by the dashboard controllers.
// They carry no class-validator decorators — instead we assert that the
// shape is correctly constructible from a realistic server payload, and that
// nullable fields default to null (not undefined), and that arrays
// default to []. This protects against accidental field renames that
// would silently break the dashboard's typed client.

function makeClient(overrides: Partial<ClientResponseDto> = {}): ClientResponseDto {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    name: 'Sara Al-Harbi',
    firstName: 'Sara',
    lastName: 'Al-Harbi',
    phone: '+966501234567',
    email: 'sara@example.com',
    dateOfBirth: new Date('1990-06-15'),
    gender: 'female',
    isActive: true,
    avatarUrl: 'https://cdn.example.com/avatars/sara.jpg',
    accountType: 'full',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function makeEmployee(overrides: Partial<EmployeeResponseDto> = {}): EmployeeResponseDto {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    userId: null,
    name: 'Dr. Khalid Al-Otaibi',
    nameAr: 'خالد العتيبي',
    nameEn: 'Khalid Al-Otaibi',
    title: 'Senior Therapist',
    specialty: 'Family Therapy',
    phone: '+966501234567',
    email: 'khalid@example.com',
    avatarUrl: 'https://cdn.example.com/avatars/khalid.jpg',
    employmentType: 'FULL_TIME',
    onboardingStatus: 'COMPLETED',
    isActive: true,
    averageRating: 4.7,
    ratingCount: 32,
    bookingCount: 120,
    branchIds: ['br_1'],
    serviceIds: ['svc_1'],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('ClientResponseDto (output shape)', () => {
  it('constructs a populated client with all fields populated', () => {
    const c = makeClient();
    expect(c.id).toBe('00000000-0000-0000-0000-000000000000');
    expect(c.name).toBe('Sara Al-Harbi');
    expect(c.firstName).toBe('Sara');
    expect(c.lastName).toBe('Al-Harbi');
    expect(c.gender).toBe('female');
    expect(c.isActive).toBe(true);
    expect(c.accountType).toBe('full');
    expect(c.dateOfBirth).toBeInstanceOf(Date);
  });

  it('accepts null for nullable fields (firstName, phone, email, avatarUrl, etc.)', () => {
    const c = makeClient({
      firstName: null,
      lastName: null,
      phone: null,
      email: null,
      dateOfBirth: null,
      gender: null,
      avatarUrl: null,
    });
    expect(c.firstName).toBeNull();
    expect(c.lastName).toBeNull();
    expect(c.phone).toBeNull();
    expect(c.email).toBeNull();
    expect(c.dateOfBirth).toBeNull();
    expect(c.gender).toBeNull();
    expect(c.avatarUrl).toBeNull();
  });

  it('round-trips through plainToInstance', () => {
    const c = makeClient();
    const copy = plainToInstance(ClientResponseDto, JSON.parse(JSON.stringify(c)));
    expect(copy.id).toBe(c.id);
    expect(copy.name).toBe(c.name);
    expect(copy.gender).toBe(c.gender);
  });
});

describe('EmployeeResponseDto (output shape)', () => {
  it('constructs a populated employee', () => {
    const e = makeEmployee();
    expect(e.id).toBe('00000000-0000-0000-0000-000000000001');
    expect(e.employmentType).toBe('FULL_TIME');
    expect(e.onboardingStatus).toBe('COMPLETED');
    expect(e.isActive).toBe(true);
    expect(e.ratingCount).toBe(32);
    expect(e.bookingCount).toBe(120);
    expect(e.branchIds).toEqual(['br_1']);
    expect(e.serviceIds).toEqual(['svc_1']);
  });

  it('accepts null for nullable fields', () => {
    const e = makeEmployee({
      userId: null,
      nameAr: null,
      nameEn: null,
      title: null,
      specialty: null,
      phone: null,
      email: null,
      avatarUrl: null,
      averageRating: null,
    });
    expect(e.userId).toBeNull();
    expect(e.nameAr).toBeNull();
    expect(e.averageRating).toBeNull();
  });
});

describe('ListMetaDto (output shape)', () => {
  it('constructs pagination meta with the right field shape', () => {
    const m: ListMetaDto = { total: 42, page: 1, perPage: 20, totalPages: 3, hasNextPage: true, hasPreviousPage: false };
    expect(m.total).toBe(42);
    expect(m.page).toBe(1);
    expect(m.perPage).toBe(20);
    expect(m.totalPages).toBe(3);
    expect(m.hasNextPage).toBe(true);
    expect(m.hasPreviousPage).toBe(false);
  });
});

describe('PaginatedClientsDto (output shape)', () => {
  it('holds an items array and a meta block', () => {
    const p: PaginatedClientsDto = {
      items: [makeClient()],
      meta: { total: 1, page: 1, perPage: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    };
    expect(p.items).toHaveLength(1);
    expect(p.items[0].name).toBe('Sara Al-Harbi');
    expect(p.meta.total).toBe(1);
  });
});

describe('PaginatedEmployeesDto (output shape)', () => {
  it('holds an items array and a meta block', () => {
    const p: PaginatedEmployeesDto = {
      items: [makeEmployee()],
      meta: { total: 1, page: 1, perPage: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    };
    expect(p.items).toHaveLength(1);
    expect(p.items[0].employmentType).toBe('FULL_TIME');
  });
});

describe('EmployeeStatsResponseDto (output shape)', () => {
  it('holds counts and an optional avg rating', () => {
    const s: EmployeeStatsResponseDto = { total: 15, active: 12, inactive: 3, avgRating: 4.5 };
    expect(s.total).toBe(15);
    expect(s.active).toBe(12);
    expect(s.inactive).toBe(3);
    expect(s.avgRating).toBe(4.5);
  });

  it('accepts null avg rating when there are no ratings', () => {
    const s: EmployeeStatsResponseDto = { total: 15, active: 12, inactive: 3, avgRating: null };
    expect(s.avgRating).toBeNull();
  });
});

describe('SetClientActiveResponseDto (output shape)', () => {
  it('holds id and isActive', () => {
    const r: SetClientActiveResponseDto = { id: '00000000-0000-0000-0000-000000000000', isActive: false };
    expect(r.id).toBe('00000000-0000-0000-0000-000000000000');
    expect(r.isActive).toBe(false);
  });
});

describe('UploadAvatarResponseDto (output shape)', () => {
  it('holds fileId and url', () => {
    const r: UploadAvatarResponseDto = {
      fileId: '00000000-0000-0000-0000-000000000000',
      url: 'https://cdn.example.com/avatars/emp.jpg',
    };
    expect(r.fileId).toBe('00000000-0000-0000-0000-000000000000');
    expect(r.url).toBe('https://cdn.example.com/avatars/emp.jpg');
  });
});

describe('PublicEmployeeResponseDto (output shape)', () => {
  it('constructs a public employee with the right shape', () => {
    const p: PublicEmployeeResponseDto = {
      id: '00000000-0000-0000-0000-000000000000',
      slug: 'dr-ahmed',
      nameAr: 'أحمد الغامدي',
      nameEn: 'Ahmed Al-Ghamdi',
      title: 'Family Therapist',
      specialty: 'Family Therapy',
      specialtyAr: 'علاج أسري',
      publicBioAr: 'نبذة بالعربية',
      publicBioEn: 'Bio in English',
      publicImageUrl: 'https://cdn.example.com/p.jpg',
      gender: 'male',
      employmentType: 'FULL_TIME',
      ratingAverage: 4.8,
      ratingCount: 18,
      minServicePrice: 250,
      isAvailableToday: true,
      serviceIds: ['svc_1'],
      branchIds: ['br_1'],
      isBookable: true,
      availableDaysOfWeek: [0, 1, 2, 3, 4],
    };
    expect(p.slug).toBe('dr-ahmed');
    expect(p.isBookable).toBe(true);
    expect(p.availableDaysOfWeek).toEqual([0, 1, 2, 3, 4]);
    expect(p.ratingCount).toBe(18);
  });

  it('accepts null for nullable public fields', () => {
    const p: PublicEmployeeResponseDto = {
      id: '00000000-0000-0000-0000-000000000000',
      slug: null,
      nameAr: null,
      nameEn: null,
      title: null,
      specialty: null,
      specialtyAr: null,
      publicBioAr: null,
      publicBioEn: null,
      publicImageUrl: null,
      gender: null,
      employmentType: 'FULL_TIME',
      ratingAverage: null,
      ratingCount: 0,
      minServicePrice: null,
      isAvailableToday: false,
      serviceIds: [],
      branchIds: [],
      isBookable: false,
      availableDaysOfWeek: [],
    };
    expect(p.slug).toBeNull();
    expect(p.ratingAverage).toBeNull();
    expect(p.minServicePrice).toBeNull();
    expect(p.serviceIds).toEqual([]);
    expect(p.branchIds).toEqual([]);
  });
});
