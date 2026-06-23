import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateEmployeeDto, plain);
  return validate(dto);
}

const validPayload: Record<string, unknown> = {
  name: 'Dr. Khalid Al-Otaibi',
};

describe('CreateEmployeeDto', () => {
  it('accepts a minimal valid payload (only required field)', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto({
      name: 'Dr. Khalid Al-Otaibi',
      phone: '+966501234567',
      email: 'khalid@example.com',
      gender: 'MALE',
      avatarUrl: 'https://cdn.example.com/avatars/khalid.jpg',
      bio: 'Specialist in physiotherapy with 10 years of experience.',
      employmentType: 'FULL_TIME',
      userId: '550e8400-e29b-41d4-a716-446655440000',
      branchIds: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'],
      serviceIds: ['550e8400-e29b-41d4-a716-446655440003'],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing name', async () => {
    const errors = await validateDto({});
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a name longer than 200 chars', async () => {
    const errors = await validateDto({ name: 'A'.repeat(201) });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('rejects a non-string name', async () => {
    const errors = await validateDto({ name: 42 });
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('normalizes a local-format Saudi phone to E.164', async () => {
    const dto = plainToInstance(CreateEmployeeDto, { ...validPayload, phone: '0501234567' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.phone).toBe('+966501234567');
  });

  it('rejects a non-international phone', async () => {
    // normalizePhone throws on garbage input → the BadRequestException is the
    // validation outcome for this DTO. Catch and assert it was raised.
    await expect(validateDto({ ...validPayload, phone: 'abc12345' })).rejects.toThrow();
  });

  it('rejects an invalid email', async () => {
    const errors = await validateDto({ ...validPayload, email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rejects an out-of-enum gender', async () => {
    const errors = await validateDto({ ...validPayload, gender: 'OTHER' });
    expect(errors.some((e) => e.property === 'gender')).toBe(true);
  });

  it('rejects an out-of-enum employmentType', async () => {
    const errors = await validateDto({ ...validPayload, employmentType: 'INTERN' });
    expect(errors.some((e) => e.property === 'employmentType')).toBe(true);
  });

  it('rejects a userId that is not a UUID', async () => {
    const errors = await validateDto({ ...validPayload, userId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'userId')).toBe(true);
  });

  it('rejects branchIds containing an invalid UUID', async () => {
    const errors = await validateDto({ ...validPayload, branchIds: ['not-a-uuid'] });
    expect(errors.some((e) => e.property === 'branchIds')).toBe(true);
  });

  it('rejects branchIds with duplicates', async () => {
    const errors = await validateDto({
      ...validPayload,
      branchIds: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001'],
    });
    expect(errors.some((e) => e.property === 'branchIds')).toBe(true);
  });

  it('accepts branchIds with unique UUIDs', async () => {
    const errors = await validateDto({
      ...validPayload,
      branchIds: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects serviceIds containing an invalid UUID', async () => {
    const errors = await validateDto({ ...validPayload, serviceIds: ['not-a-uuid'] });
    expect(errors.some((e) => e.property === 'serviceIds')).toBe(true);
  });

  it('rejects non-array branchIds', async () => {
    const errors = await validateDto({ ...validPayload, branchIds: 'not-an-array' });
    expect(errors.some((e) => e.property === 'branchIds')).toBe(true);
  });
});
