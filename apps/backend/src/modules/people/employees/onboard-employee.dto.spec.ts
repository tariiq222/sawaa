import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OnboardEmployeeDto } from './onboard-employee.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(OnboardEmployeeDto, plain);
  return validate(dto);
}

const validPayload: Record<string, unknown> = {
  nameEn: 'Khalid Al-Otaibi',
  nameAr: 'خالد العتيبي',
  email: 'khalid@example.com',
  specialty: 'Physiotherapy',
};

describe('OnboardEmployeeDto', () => {
  it('accepts a minimal valid payload (only required fields)', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto({
      title: 'Dr.',
      nameEn: 'Khalid Al-Otaibi',
      nameAr: 'خالد العتيبي',
      email: 'khalid@example.com',
      phone: '+966501234567',
      gender: 'MALE',
      employmentType: 'FULL_TIME',
      specialty: 'Physiotherapy',
      specialtyAr: 'العلاج الطبيعي',
      bio: 'Specialist with 10 years of experience.',
      bioAr: 'متخصص بخبرة 10 سنوات.',
      experience: 10,
      education: 'King Saud University',
      educationAr: 'جامعة الملك سعود',
      avatarUrl: 'https://cdn.example.com/avatars/khalid.jpg',
      isActive: true,
      isPublic: false,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing nameEn', async () => {
    const { nameEn: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'nameEn')).toBe(true);
  });

  it('rejects a missing nameAr', async () => {
    const { nameAr: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects a missing email', async () => {
    const { email: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a missing specialty', async () => {
    const { specialty: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'specialty')).toBe(true);
  });

  it('rejects an invalid email', async () => {
    const errors = await validateDto({ ...validPayload, email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects a nameEn longer than 200 chars', async () => {
    const errors = await validateDto({ ...validPayload, nameEn: 'A'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameEn')).toBe(true);
  });

  it('rejects a nameAr longer than 200 chars', async () => {
    const errors = await validateDto({ ...validPayload, nameAr: 'أ'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('accepts a valid phone', async () => {
    const errors = await validateDto({ ...validPayload, phone: '+966501234567' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a phone with non-allowed characters', async () => {
    const errors = await validateDto({ ...validPayload, phone: 'phone-12' });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('rejects an out-of-enum gender', async () => {
    const errors = await validateDto({ ...validPayload, gender: 'OTHER' });
    expect(errors.some((e) => e.property === 'gender')).toBe(true);
  });

  it('rejects an out-of-enum employmentType', async () => {
    const errors = await validateDto({ ...validPayload, employmentType: 'INTERN' });
    expect(errors.some((e) => e.property === 'employmentType')).toBe(true);
  });

  it('rejects a negative experience', async () => {
    const errors = await validateDto({ ...validPayload, experience: -1 });
    expect(errors.some((e) => e.property === 'experience')).toBe(true);
  });

  it('rejects a non-boolean isPublic', async () => {
    const errors = await validateDto({ ...validPayload, isPublic: 'no' });
    expect(errors.some((e) => e.property === 'isPublic')).toBe(true);
  });

  it('rejects a non-string avatarUrl', async () => {
    const errors = await validateDto({ ...validPayload, avatarUrl: 42 });
    expect(errors.some((e) => e.property === 'avatarUrl')).toBe(true);
  });
});
