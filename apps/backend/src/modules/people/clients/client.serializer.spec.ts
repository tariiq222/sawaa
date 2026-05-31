import type { Client } from '@prisma/client';
import { serializeClient } from './client.serializer';

// Full Client row including the sensitive auth columns that must never leak.
function buildFullClientRow(): Client {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    userId: null,
    name: 'Sara Ahmed',
    firstName: 'Sara',
    middleName: null,
    lastName: 'Ahmed',
    phone: '+966500000000',
    email: 'sara@example.com',
    emailVerified: null,
    phoneVerified: null,
    gender: 'FEMALE',
    dateOfBirth: null,
    nationality: null,
    nationalId: null,
    emergencyName: null,
    emergencyPhone: null,
    bloodType: null,
    allergies: null,
    chronicConditions: null,
    avatarUrl: null,
    notes: null,
    source: 'WALK_IN',
    accountType: 'FULL',
    claimedAt: null,
    isActive: true,
    deletedAt: null,
    tokenVersion: 3,
    passwordHash: '$2b$10$super.secret.hash.value',
    loginAttempts: 2,
    lockoutUntil: new Date('2026-05-31T00:00:00.000Z'),
    lastLoginAt: null,
    preferredLocale: null,
    pushEnabled: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  } as Client;
}

describe('serializeClient', () => {
  it('does not leak sensitive auth columns in the output', () => {
    const result = serializeClient(buildFullClientRow());

    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('tokenVersion');
    expect(result).not.toHaveProperty('loginAttempts');
    expect(result).not.toHaveProperty('lockoutUntil');
  });

  it('keeps safe identity fields and normalizes gender/accountType', () => {
    const result = serializeClient(buildFullClientRow());

    expect(result.id).toBe('00000000-0000-0000-0000-000000000001');
    expect(result.firstName).toBe('Sara');
    expect(result.phone).toBe('+966500000000');
    expect(result.gender).toBe('female');
    expect(result.accountType).toBe('full');
  });

  it('maps WALK_IN account type and null gender', () => {
    const row = buildFullClientRow();
    row.accountType = 'WALK_IN';
    row.gender = null;

    const result = serializeClient(row);

    expect(result.accountType).toBe('walk_in');
    expect(result.gender).toBeNull();
  });

  it('passes through booking summaries from options', () => {
    const lastBooking = { id: 'b1', date: '2026-05-01', status: 'COMPLETED' };
    const nextBooking = { id: 'b2', date: '2026-06-01', status: 'CONFIRMED' };

    const result = serializeClient(buildFullClientRow(), { lastBooking, nextBooking });

    expect(result.lastBooking).toEqual(lastBooking);
    expect(result.nextBooking).toEqual(nextBooking);
  });
});
