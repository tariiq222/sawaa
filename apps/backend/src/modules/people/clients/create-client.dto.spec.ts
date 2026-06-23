import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateClientDto } from './create-client.dto';
import { ClientAccountType, ClientBloodType, ClientGender, ClientSource } from '@prisma/client';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateClientDto, plain);
  return validate(dto);
}

const validPayload: Record<string, unknown> = {
  firstName: 'Sara',
  lastName: 'Al-Harbi',
  phone: '+966501234567',
};

describe('CreateClientDto', () => {
  it('accepts a minimal valid payload (only required fields)', async () => {
    const errors = await validateDto(validPayload);
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
      avatarUrl: 'https://cdn.example.com/avatars/sara.jpg',
      notes: 'Prefers morning appointments',
      source: 'referral',
      accountType: 'full',
      isActive: true,
      userId: '00000000-0000-0000-0000-000000000000',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing firstName', async () => {
    const { firstName: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });

  it('rejects a missing lastName', async () => {
    const { lastName: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'lastName')).toBe(true);
  });

  it('rejects a missing phone', async () => {
    const { phone: _ignored, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('rejects a firstName longer than 255 chars', async () => {
    const errors = await validateDto({ ...validPayload, firstName: 'A'.repeat(256) });
    expect(errors.some((e) => e.property === 'firstName')).toBe(true);
  });

  it('normalizes a local-format Saudi phone to E.164', async () => {
    const dto = plainToInstance(CreateClientDto, { ...validPayload, phone: '0501234567' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.phone).toBe('+966501234567');
  });

  it('rejects a non-Saudi phone number', async () => {
    const errors = await validateDto({ ...validPayload, phone: '+12025550123' });
    expect(errors.some((e) => e.property === 'phone')).toBe(true);
  });

  it('rejects an invalid email', async () => {
    const errors = await validateDto({ ...validPayload, email: 'not-an-email' });
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('accepts a valid email', async () => {
    const errors = await validateDto({ ...validPayload, email: 'user@example.com' });
    expect(errors).toHaveLength(0);
  });

  it('uppercases a lowercase enum value (gender, bloodType, source, accountType)', async () => {
    const dto = plainToInstance(CreateClientDto, {
      ...validPayload,
      gender: 'female',
      bloodType: 'a_pos',
      source: 'referral',
      accountType: 'full',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.gender).toBe(ClientGender.FEMALE);
    expect(dto.bloodType).toBe(ClientBloodType.A_POS);
    expect(dto.source).toBe(ClientSource.REFERRAL);
    expect(dto.accountType).toBe(ClientAccountType.FULL);
  });

  it('rejects an out-of-enum gender', async () => {
    const errors = await validateDto({ ...validPayload, gender: 'OTHER' });
    expect(errors.some((e) => e.property === 'gender')).toBe(true);
  });

  it('rejects an out-of-enum bloodType', async () => {
    const errors = await validateDto({ ...validPayload, bloodType: 'X_POS' });
    expect(errors.some((e) => e.property === 'bloodType')).toBe(true);
  });

  it('rejects an out-of-enum source', async () => {
    const errors = await validateDto({ ...validPayload, source: 'MAGIC' });
    expect(errors.some((e) => e.property === 'source')).toBe(true);
  });

  it('rejects an out-of-enum accountType', async () => {
    const errors = await validateDto({ ...validPayload, accountType: 'PREMIUM' });
    expect(errors.some((e) => e.property === 'accountType')).toBe(true);
  });

  it('rejects an invalid dateOfBirth (not ISO 8601)', async () => {
    const errors = await validateDto({ ...validPayload, dateOfBirth: 'not-a-date' });
    expect(errors.some((e) => e.property === 'dateOfBirth')).toBe(true);
  });

  it('rejects a non-boolean isActive', async () => {
    const errors = await validateDto({ ...validPayload, isActive: 'yes' });
    expect(errors.some((e) => e.property === 'isActive')).toBe(true);
  });

  it('rejects a userId that is not a UUID', async () => {
    const errors = await validateDto({ ...validPayload, userId: 'not-a-uuid' });
    expect(errors.some((e) => e.property === 'userId')).toBe(true);
  });

  it('accepts a valid userId UUID', async () => {
    const errors = await validateDto({
      ...validPayload,
      userId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects allergies longer than 1000 chars', async () => {
    const errors = await validateDto({ ...validPayload, allergies: 'A'.repeat(1001) });
    expect(errors.some((e) => e.property === 'allergies')).toBe(true);
  });

  it('rejects notes longer than 2000 chars', async () => {
    const errors = await validateDto({ ...validPayload, notes: 'A'.repeat(2001) });
    expect(errors.some((e) => e.property === 'notes')).toBe(true);
  });
});
