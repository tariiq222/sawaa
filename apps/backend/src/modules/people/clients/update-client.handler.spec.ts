import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateClientHandler } from './update-client.handler';

function createClient(overrides?: Partial<any>) {
  return {
    id: 'c1',
    name: 'John Doe',
    firstName: 'John',
    middleName: null,
    lastName: 'Doe',
    phone: '+966501234567',
    email: 'john@test.com',
    deletedAt: null,
    ...overrides,
  };
}

describe('UpdateClientHandler', () => {
  let handler: UpdateClientHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      client: { findFirst: jest.fn(), update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateClientHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<UpdateClientHandler>(UpdateClientHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should throw when client not found', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ clientId: 'c1' } as any)).rejects.toThrow(NotFoundException);
  });

  it('should throw when phone already exists', async () => {
    prisma.client.findFirst.mockResolvedValueOnce(createClient()).mockResolvedValueOnce(createClient({ id: 'c2' }));
    await expect(handler.execute({ clientId: 'c1', phone: '+966509999999' } as any)).rejects.toThrow(ConflictException);
  });

  it('should throw 409 when email already exists for another client', async () => {
    prisma.client.findFirst
      .mockResolvedValueOnce(createClient())
      .mockResolvedValueOnce(createClient({ id: 'c2', email: 'taken@test.com' }));
    await expect(
      handler.execute({ clientId: 'c1', email: 'taken@test.com' } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('should not check email when unchanged', async () => {
    prisma.client.findFirst.mockResolvedValue(createClient());
    prisma.client.update.mockResolvedValue(createClient());
    await handler.execute({ clientId: 'c1', email: 'john@test.com' } as any);
    expect(prisma.client.findFirst).toHaveBeenCalledTimes(1);
  });

  it('should not check phone when unchanged', async () => {
    prisma.client.findFirst.mockResolvedValue(createClient());
    prisma.client.update.mockResolvedValue(createClient());
    await handler.execute({ clientId: 'c1', phone: '+966501234567' } as any);
    expect(prisma.client.findFirst).toHaveBeenCalledTimes(1);
  });

  it('should update name composition', async () => {
    prisma.client.findFirst.mockResolvedValue(createClient());
    prisma.client.update.mockResolvedValue(createClient({ name: 'Jane Smith', firstName: 'Jane', lastName: 'Smith' }));
    const result = await handler.execute({ clientId: 'c1', firstName: 'Jane', lastName: 'Smith' } as any);
    expect(result.firstName).toBe('Jane');
  });

  it('should keep existing name when no name parts provided', async () => {
    // unchanged email so the email-uniqueness guard is skipped — this test is
    // about name composition, not email collisions.
    prisma.client.findFirst.mockResolvedValue(createClient());
    prisma.client.update.mockResolvedValue(createClient());
    await handler.execute({ clientId: 'c1', email: 'john@test.com' } as any);
    expect(prisma.client.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'John Doe' }),
    }));
  });

  it('should handle middleName', async () => {
    prisma.client.findFirst.mockResolvedValue(createClient());
    prisma.client.update.mockResolvedValue(createClient());
    await handler.execute({ clientId: 'c1', firstName: 'John', middleName: 'M', lastName: 'Doe' } as any);
    expect(prisma.client.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'John M Doe' }),
    }));
  });

  it('should set dateOfBirth to null when explicitly passed empty', async () => {
    prisma.client.findFirst.mockResolvedValue(createClient());
    prisma.client.update.mockResolvedValue(createClient());
    await handler.execute({ clientId: 'c1', dateOfBirth: '' } as any);
    expect(prisma.client.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ dateOfBirth: null }),
    }));
  });

  it('should set dateOfBirth when valid', async () => {
    prisma.client.findFirst.mockResolvedValue(createClient());
    prisma.client.update.mockResolvedValue(createClient());
    await handler.execute({ clientId: 'c1', dateOfBirth: '1990-01-01' } as any);
    expect(prisma.client.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ dateOfBirth: new Date('1990-01-01') }),
    }));
  });

  it('should not set dateOfBirth when undefined', async () => {
    prisma.client.findFirst.mockResolvedValue(createClient());
    prisma.client.update.mockResolvedValue(createClient());
    await handler.execute({ clientId: 'c1', name: 'New' } as any);
    const data = prisma.client.update.mock.calls[0][0].data;
    expect(data.dateOfBirth).toBeUndefined();
  });
});
