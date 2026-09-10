import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ClientSource } from '@prisma/client';
import { CreateClientHandler } from './create-client.handler';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';

const buildPrisma = () => ({
  client: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
});

describe('CreateClientHandler', () => {
  let handler: CreateClientHandler;
  let prisma: ReturnType<typeof buildPrisma>;
  let eventBus: jest.Mocked<Partial<EventBusService>>;

  beforeEach(async () => {
    prisma = buildPrisma();
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateClientHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    handler = module.get<CreateClientHandler>(CreateClientHandler);
  });

  const dtoBase = {
    firstName: 'Ahmed',
    lastName: 'Ali',
    phone: '+966500000001',
    email: 'ahmed@test.com',
    gender: 'MALE' as const,
    source: ClientSource.ONLINE,
  };

  it('should return existing client with isExisting=true when phone exists', async () => {
    prisma.client.findFirst.mockResolvedValue({ id: 'existing', name: 'Existing', phone: dtoBase.phone });
    const result = await handler.execute(dtoBase);
    expect(result).toMatchObject({ id: 'existing', isExisting: true });
    expect(prisma.client.create).not.toHaveBeenCalled();
  });

  it('should reject with 409 on email-only collision (different phone)', async () => {
    // phone lookup misses, email lookup hits a different record
    prisma.client.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'other', name: 'Other', email: dtoBase.email });
    await expect(handler.execute(dtoBase)).rejects.toThrow(ConflictException);
    expect(prisma.client.create).not.toHaveBeenCalled();
  });

  it('should create client and publish event', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    prisma.client.create.mockResolvedValue({
      id: 'client-1',
      name: 'Ahmed Ali',
      firstName: 'Ahmed',
      lastName: 'Ali',
      phone: dtoBase.phone,
      email: dtoBase.email,
      gender: 'MALE',
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
      source: 'dashboard',
      accountType: null,
      isActive: true,
      userId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      middleName: null,
    });

    const result = await handler.execute(dtoBase);
    expect(prisma.client.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Ahmed Ali', phone: dtoBase.phone, isActive: true }),
    }));
    expect(eventBus.publish).toHaveBeenCalledWith('people.client.enrolled', expect.any(Object));
    expect(result.id).toBe('client-1');
  });

  it('should include middleName in full name', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    prisma.client.create.mockResolvedValue({
      id: 'client-1',
      name: 'Ahmed Mohammed Ali',
      firstName: 'Ahmed',
      middleName: 'Mohammed',
      lastName: 'Ali',
      phone: null,
      email: null,
      gender: null,
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
      source: 'dashboard',
      accountType: null,
      isActive: false,
      userId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await handler.execute({ firstName: 'Ahmed', middleName: 'Mohammed', lastName: 'Ali', phone: '+966500000003', isActive: false });
    expect(prisma.client.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Ahmed Mohammed Ali', isActive: false }),
    }));
  });

  it('should parse dateOfBirth when provided', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    prisma.client.create.mockResolvedValue({
      id: 'client-1',
      name: 'Ahmed Ali',
      firstName: 'Ahmed',
      lastName: 'Ali',
      phone: null,
      email: null,
      gender: null,
      dateOfBirth: new Date('1990-01-01'),
      nationality: null,
      nationalId: null,
      emergencyName: null,
      emergencyPhone: null,
      bloodType: null,
      allergies: null,
      chronicConditions: null,
      avatarUrl: null,
      notes: null,
      source: 'dashboard',
      accountType: null,
      isActive: true,
      userId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      middleName: null,
    });

    await handler.execute({ firstName: 'Ahmed', lastName: 'Ali', phone: '+966500000004', dateOfBirth: '1990-01-01' });
    expect(prisma.client.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ dateOfBirth: new Date('1990-01-01') }),
    }));
  });
});

describe('CreateClientHandler notification outbox transaction', () => {
  it('captures the client enrollment in the same transaction as the client row', async () => {
    const createdAt = new Date('2026-09-05T12:00:00Z');
    const client = {
      id: 'client-tx', name: 'Ahmed Ali', firstName: 'Ahmed', middleName: null, lastName: 'Ali',
      phone: '+966500000001', email: 'ahmed@example.com', gender: 'MALE', dateOfBirth: null,
      nationality: null, nationalId: null, emergencyName: null, emergencyPhone: null, bloodType: null,
      allergies: null, chronicConditions: null, avatarUrl: null, notes: null, source: 'ONLINE', accountType: null,
      isActive: true, userId: null, createdAt, updatedAt: createdAt, deletedAt: null,
    };
    const tx = {
      client: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(client) },
    };
    const prisma = {
      client: { findFirst: jest.fn().mockResolvedValue(null), create: tx.client.create },
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const capture = { execute: jest.fn().mockResolvedValue('intent-client') };
    const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    const handler = new (CreateClientHandler as any)(prisma, eventBus, capture, { shouldCapture: () => true });

    await handler.execute({ firstName: 'Ahmed', lastName: 'Ali', phone: client.phone, email: client.email, gender: 'MALE', source: 'ONLINE' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(capture.execute).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: 'client-enrolled:client-tx',
      consumerKey: 'comms.client-enrolled-client.v2',
      payload: expect.objectContaining({ kind: 'client-enrolled-client', clientId: 'client-tx', name: 'Ahmed Ali' }),
    }), tx);
    expect(capture.execute).toHaveBeenCalledWith(expect.objectContaining({ consumerKey: 'comms.client-enrolled-staff.v2' }), tx);
    expect(capture.execute).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledWith('people.client.enrolled', expect.any(Object));
  });

  it('does not return a committed client when durable enrollment capture fails', async () => {
    const tx = { client: { create: jest.fn().mockResolvedValue({ id: 'client-fail', name: 'A', phone: null, email: null }) } };
    const prisma = { client: { findFirst: jest.fn().mockResolvedValue(null), create: tx.client.create }, $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)) };
    const capture = { execute: jest.fn().mockRejectedValue(new Error('capture unavailable')) };
    const handler = new (CreateClientHandler as any)(prisma, { publish: jest.fn() }, capture, { shouldCapture: () => true });

    await expect(handler.execute({ firstName: 'A', lastName: 'B' })).rejects.toThrow('capture unavailable');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('preserves legacy creation when capture is injected but the rollout gate is disabled', async () => {
    const client = { id: 'disabled-client', name: 'A B', phone: null, email: null, accountType: 'FULL' };
    const prisma = { client: { create: jest.fn().mockResolvedValue(client) }, $transaction: jest.fn() };
    const publish = jest.fn(); const capture = { execute: jest.fn() };
    const handler = new (CreateClientHandler as any)(prisma, { publish }, capture, { shouldCapture: () => false });
    expect(await handler.execute({ firstName: 'A', lastName: 'B' })).toMatchObject({ id: 'disabled-client', accountType: 'full' });
    expect(capture.execute).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('preserves the serialized full account type after transactional creation', async () => {
    const tx = { client: { create: jest.fn().mockResolvedValue({ id: 'full-client', name: 'A B', accountType: 'FULL' }) } };
    const prisma = { $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)) };
    const handler = new (CreateClientHandler as any)(prisma, { publish: jest.fn() }, { execute: jest.fn() }, { shouldCapture: () => true });
    expect(await handler.execute({ firstName: 'A', lastName: 'B' })).toMatchObject({ accountType: 'full' });
  });


  it('returns committed success when Redis publish fails after both durable captures', async () => {
    const tx = { client: { create: jest.fn().mockResolvedValue({ id: 'committed-client', name: 'A B', accountType: 'FULL' }) } };
    const prisma = { $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)) };
    const capture = { execute: jest.fn() };
    const publish = jest.fn().mockRejectedValue(new Error('synthetic Redis outage'));
    const handler = new (CreateClientHandler as any)(prisma, { publish }, capture, { shouldCapture: () => true });
    expect(await handler.execute({ firstName: 'A', lastName: 'B' })).toMatchObject({ id: 'committed-client', isExisting: false });
    expect(capture.execute).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledTimes(1);
  });

});
