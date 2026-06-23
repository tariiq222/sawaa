import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateEmployeeDto } from './update-employee.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateEmployeeDto, plain);
  return validate(dto);
}

describe('UpdateEmployeeDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto({});
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
      education: 'King Saud University — BSc Physical Therapy',
      educationAr: 'جامعة الملك سعود — بكالوريوس علاج طبيعي',
      isActive: true,
      avatarUrl: 'https://cdn.example.com/avatars/khalid.jpg',
      slug: 'dr-khalid',
      isPublic: true,
      publicBioAr: 'نبذة عامة بالعربية',
      publicBioEn: 'Public bio in English',
      publicImageUrl: 'https://cdn.example.com/public/khalid.jpg',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a nameEn longer than 200 chars', async () => {
    const errors = await validateDto({ nameEn: 'A'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameEn')).toBe(true);
  });

  it('rejects a nameAr longer than 200 chars', async () => {
    const errors = await validateDto({ nameAr: 'أ'.repeat(201) });
    expect(errors.some((e) => e.property === 'nameAr')).toBe(true);
  });

  it('rejects an invalid email', async () => {
    const errors = await validateDto({ email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('normalizes a local-format Saudi phone to E.164', async () => {
    const dto = plainToInstance(UpdateEmployeeDto, { phone: '0501234567' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.phone).toBe('+966501234567');
  });

  it('rejects an out-of-enum gender', async () => {
    const errors = await validateDto({ gender: 'OTHER' });
    expect(errors.some((e) => e.property === 'gender')).toBe(true);
  });

  it('rejects an out-of-enum employmentType', async () => {
    const errors = await validateDto({ employmentType: 'INTERN' });
    expect(errors.some((e) => e.property === 'employmentType')).toBe(true);
  });

  it('rejects a negative experience', async () => {
    const errors = await validateDto({ experience: -1 });
    expect(errors.some((e) => e.property === 'experience')).toBe(true);
  });

  it('rejects a non-integer experience', async () => {
    const errors = await validateDto({ experience: 1.5 });
    expect(errors.some((e) => e.property === 'experience')).toBe(true);
  });

  it('accepts experience = 0', async () => {
    const errors = await validateDto({ experience: 0 });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateDto({ isActive: 'true' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a non-boolean isPublic', async () => {
    const errors = await validateDto({ isPublic: 1 });
    expect(errors.some((e) => e.property === 'isPublic')).toBe(true);
  });

  it('rejects a slug containing spaces', async () => {
    const errors = await validateDto({ slug: 'dr khalid' });
    expect(errors.some((e) => e.property === 'slug')).toBe(true);
  });

  it('rejects a slug with special characters', async () => {
    const errors = await validateDto({ slug: 'dr_khalid!' });
    expect(errors.some((e) => e.property === 'slug')).toBe(true);
  });

  it('accepts a slug with hyphens', async () => {
    const errors = await validateDto({ slug: 'dr-khalid' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a publicImageUrl that is not a URL', async () => {
    const errors = await validateDto({ publicImageUrl: 'not-a-url' });
    expect(errors.some((e) => e.property === 'publicImageUrl')).toBe(true);
  });

  it('rejects publicBioAr longer than 5000 chars', async () => {
    const errors = await validateDto({ publicBioAr: 'A'.repeat(5001) });
    expect(errors.some((e) => e.property === 'publicBioAr')).toBe(true);
  });

  it('rejects a non-string title', async () => {
    const errors = await validateDto({ title: 42 });
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });
});
