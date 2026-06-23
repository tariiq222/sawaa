import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmployeeOnboardingDto, EmployeeOnboardingProfileDto } from './employee-onboarding.dto';

async function validateDto(plain: Record<string, unknown>, Cls = EmployeeOnboardingDto) {
  const dto = plainToInstance(Cls, plain);
  return validate(dto);
}

describe('EmployeeOnboardingDto', () => {
  it('accepts a minimal valid payload (only step)', async () => {
    const errors = await validateDto({ step: 'profile' });
    expect(errors).toHaveLength(0);
  });

  it('accepts each of the four allowed step values', async () => {
    for (const step of ['profile', 'branches', 'services', 'complete']) {
      const errors = await validateDto({ step });
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects a missing step', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'step')).toBe(true);
  });

  it('rejects an out-of-enum step', async () => {
    const errors = await validateDto({ step: 'unknown' });
    expect(errors.some((e) => e.property === 'step')).toBe(true);
  });

  it('accepts a profile payload with all optional fields filled', async () => {
    const errors = await validateDto({
      step: 'profile',
      profile: {
        name: 'Dr. Khalid Al-Otaibi',
        phone: '+966501234567',
        email: 'khalid@example.com',
        gender: 'MALE',
        bio: 'Specialist with 10 years of experience.',
        avatarUrl: 'https://cdn.example.com/avatars/khalid.jpg',
      },
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email in profile', async () => {
    const errors = await validateDto({
      step: 'profile',
      profile: { email: 'not-an-email' },
    });
    const profileErrors = errors.filter((e) => e.property === 'profile');
    expect(profileErrors.length).toBeGreaterThan(0);
  });

  it('rejects an out-of-enum gender in profile', async () => {
    const errors = await validateDto({
      step: 'profile',
      profile: { gender: 'OTHER' },
    });
    const profileErrors = errors.filter((e) => e.property === 'profile');
    expect(profileErrors.length).toBeGreaterThan(0);
  });

  it('rejects a non-international phone in profile', async () => {
    const errors = await validateDto({
      step: 'profile',
      profile: { phone: 'abc12345' },
    });
    const profileErrors = errors.filter((e) => e.property === 'profile');
    expect(profileErrors.length).toBeGreaterThan(0);
  });

  it('rejects a name longer than 200 chars in profile', async () => {
    const errors = await validateDto({
      step: 'profile',
      profile: { name: 'A'.repeat(201) },
    });
    const profileErrors = errors.filter((e) => e.property === 'profile');
    expect(profileErrors.length).toBeGreaterThan(0);
  });

  it('rejects branchIds containing a non-UUID', async () => {
    const errors = await validateDto({
      step: 'branches',
      branchIds: ['not-a-uuid'],
    });
    expect(errors.some((e) => e.property === 'branchIds')).toBe(true);
  });

  it('rejects branchIds with duplicates', async () => {
    const errors = await validateDto({
      step: 'branches',
      branchIds: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001'],
    });
    expect(errors.some((e) => e.property === 'branchIds')).toBe(true);
  });

  it('accepts branchIds with unique UUIDs', async () => {
    const errors = await validateDto({
      step: 'branches',
      branchIds: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects serviceIds containing a non-UUID', async () => {
    const errors = await validateDto({
      step: 'services',
      serviceIds: ['not-a-uuid'],
    });
    expect(errors.some((e) => e.property === 'serviceIds')).toBe(true);
  });

  it('accepts serviceIds with unique UUIDs', async () => {
    const errors = await validateDto({
      step: 'services',
      serviceIds: ['550e8400-e29b-41d4-a716-446655440003'],
    });
    expect(errors).toHaveLength(0);
  });
});

describe('EmployeeOnboardingProfileDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto({}, EmployeeOnboardingProfileDto);
    expect(errors).toHaveLength(0);
  });
});
