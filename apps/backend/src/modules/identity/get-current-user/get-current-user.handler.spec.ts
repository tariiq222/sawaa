import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetCurrentUserHandler } from './get-current-user.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('GetCurrentUserHandler', () => {
  let handler: GetCurrentUserHandler;
   
  let prisma: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetCurrentUserHandler,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn() },
          },
        },
      ],
    }).compile();
    handler = module.get(GetCurrentUserHandler);
    prisma = module.get(PrismaService);
  });

  it('returns user when found', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', customRole: null });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.id).toBe('u1');
    expect(result.email).toBe('a@b.com');
  });

  it('throws NotFoundException when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ userId: 'u1' })).rejects.toThrow(NotFoundException);
  });

  it('returns firstName/lastName from user fields', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', firstName: 'Tariq', lastName: 'Al Walidi', customRole: null });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.firstName).toBe('Tariq');
    expect(result.lastName).toBe('Al Walidi');
  });

  it('returns phoneVerifiedAt and emailVerifiedAt in user payload', async () => {
    const now = new Date();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', phoneVerifiedAt: now, emailVerifiedAt: null, customRole: null });
    const result = await handler.execute({ userId: 'u1' });
    expect(result.phoneVerifiedAt).toBe(now);
    expect(result.emailVerifiedAt).toBeNull();
  });

  it('omits organizationId and legacy SaaS membership fields in single-tenant mode', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B', customRole: null, lastActiveOrganizationId: null });
    const result = await handler.execute({ userId: 'u1' });
    // Exact key set: user columns + derived names + onboardingCompletedAt only.
    // Guards against re-introducing removed SaaS fork fields.
    expect(Object.keys(result).sort()).toEqual([
      'customRole',
      'email',
      'firstName',
      'id',
      'lastActiveOrganizationId',
      'lastName',
      'onboardingCompletedAt',
    ]);
    expect(result.onboardingCompletedAt).toBeNull();
  });
});
