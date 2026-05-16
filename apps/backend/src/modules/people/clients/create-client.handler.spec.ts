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

  it('should throw ConflictException when phone exists', async () => {
    prisma.client.findFirst.mockResolvedValue({ id: 'existing', phone: dtoBase.phone });
    await expect(handler.execute(dtoBase)).rejects.toThrow(ConflictException);
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

  it('should skip phone check when phone is not provided', async () => {
    prisma.client.create.mockResolvedValue({
      id: 'client-1',
      name: 'Ahmed Ali',
      firstName: 'Ahmed',
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
      isActive: true,
      userId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      middleName: null,
    });

    await handler.execute({ firstName: 'Ahmed', lastName: 'Ali', phone: '+966500000002' });
    expect(prisma.client.findFirst).not.toHaveBeenCalled();
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
