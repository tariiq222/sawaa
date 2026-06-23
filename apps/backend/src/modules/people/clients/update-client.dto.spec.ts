import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateClientDto } from './update-client.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateClientDto, plain);
  return validate(dto);
}

describe('UpdateClientDto', () => {
  it('accepts an empty payload (all fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('accepts a fully populated payload', async () => {
    const errors = await validateDto({
      firstName: 'Sara',
      middleName: 'Ali',
      lastName: 'Al-Harbi',
      phone: '+966501234567',
      email: 'sara@example.com',
      gender: 'female',
      dateOfBirth: '1990-06-15',
      nationality: 'Saudi',
      nationalId: '1234567890',
      emergencyName: 'Ahmad Al-Harbi',
      emergencyPhone: '+966501234568',
      bloodType: 'a_pos',
      allergies: 'Penicillin',
      chronicConditions: 'Type 2 Diabetes',
      avatarUrl: null,
      notes: null,
      source: 'referral',
      accountType: 'full',
      isActive: false,
      preferredLocale: 'ar',
      pushEnabled: true,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a firstName longer than 255 chars', async () => {
    const errors = await validateDto({ firstName: 'A'.repeat(256) });
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });

  it('rejects a non-string firstName', async () => {
    const errors = await validateDto({ firstName: 42 });
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });

  it('normalizes a local-format Saudi phone to E.164', async () => {
    const dto = plainToInstance(UpdateClientDto, { phone: '0501234567' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.phone).toBe('+966501234567');
  });

  it('rejects a non-Saudi phone number', async () => {
    const errors = await validateDto({ phone: '+12025550123' });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('accepts an explicit null phone (clears the field)', async () => {
    const errors = await validateDto({ phone: null });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const errors = await validateDto({ email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('accepts an explicit null email', async () => {
    const errors = await validateDto({ email: null });
    expect(errors).toHaveLength(0);
  });

  it('rejects an out-of-enum gender', async () => {
    const errors = await validateDto({ gender: 'UNKNOWN' });
    expect(errors.some((e) => e.property === 'gender')).toBe(true);
  });

  it('uppercases a lowercase gender', async () => {
    const dto = plainToInstance(UpdateClientDto, { gender: 'male' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.gender).toBe('MALE');
  });

  it('rejects an invalid dateOfBirth', async () => {
    const errors = await validateDto({ dateOfBirth: '2025-99-99' });
    expect(errors.some((e) => e.property === 'dateOfBirth')).toBe(true);
  });

  it('rejects a preferredLocale longer than 8 chars', async () => {
    const errors = await validateDto({ preferredLocale: 'ar-EGYPT-X' });
    expect(errors.some((e) => e.property === 'preferredLocale')).toBe(true);
  });

  it('accepts a preferredLocale at the boundary (exactly 8 chars)', async () => {
    const errors = await validateDto({ preferredLocale: 'ar-EGYPT' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateDto({ isActive: 'true' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a non-boolean pushEnabled', async () => {
    const errors = await validateDto({ pushEnabled: 1 });
    expect(errors.some((e) => e.property === 'pushEnabled')).toBe(true);
  });

  it('rejects nationalId longer than 20 chars', async () => {
    const errors = await validateDto({ nationalId: '1'.repeat(21) });
    expect(errors.some((e) => e.property === 'nationalId')).toBe(true);
  });

  it('rejects a non-string avatarUrl', async () => {
    const errors = await validateDto({ avatarUrl: 42 });
    expect(errors.some((e) => e.property === 'avatarUrl')).toBe(true);
  });
});
