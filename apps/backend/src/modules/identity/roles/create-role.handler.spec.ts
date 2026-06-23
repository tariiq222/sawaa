import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateRoleHandler } from './create-role.handler';

describe('CreateRoleHandler', () => {
  let handler: CreateRoleHandler;
  let prisma: { customRole: { findFirst: jest.Mock; create: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateRoleHandler,
        {
          provide: PrismaService,
          useValue: {
            customRole: { findFirst: jest.fn(), create: jest.fn() },
          },
        },
      ],
    }).compile();
    handler = module.get<CreateRoleHandler>(CreateRoleHandler);
    prisma = module.get<PrismaService>(PrismaService) as any;
  });

  it('creates the role when no existing role with the same name exists', async () => {
    prisma.customRole.findFirst.mockResolvedValue(null);
    prisma.customRole.create.mockResolvedValue({ id: 'r1', name: 'Reception Manager' });

    const result = await handler.execute({ name: 'Reception Manager' });
    expect(result).toEqual({ id: 'r1', name: 'Reception Manager' });
    expect(prisma.customRole.create).toHaveBeenCalledTimes(1);
  });

  it('looks up by exact name match before creating', async () => {
    prisma.customRole.findFirst.mockResolvedValue(null);
    prisma.customRole.create.mockResolvedValue({ id: 'r1' });

    await handler.execute({ name: 'Reception Manager' });

    expect(prisma.customRole.findFirst).toHaveBeenCalledWith({
      where: { name: 'Reception Manager' },
    });
  });

  it('passes { name } into create data with permissions include', async () => {
    prisma.customRole.findFirst.mockResolvedValue(null);
    prisma.customRole.create.mockResolvedValue({ id: 'r1' });

    await handler.execute({ name: 'Reception Manager' });

    expect(prisma.customRole.create).toHaveBeenCalledWith({
      data: { name: 'Reception Manager' },
      include: { permissions: true },
    });
  });

  it('throws ConflictException when a role with the same name already exists', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'r1', name: 'Reception Manager' });

    await expect(handler.execute({ name: 'Reception Manager' })).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.customRole.create).not.toHaveBeenCalled();
  });

  it('error message includes the duplicate role name for the API consumer', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'r1', name: 'Reception Manager' });

    await expect(handler.execute({ name: 'Reception Manager' })).rejects.toThrow(
      /Reception Manager/,
    );
  });

  it('propagates Prisma errors when create rejects', async () => {
    prisma.customRole.findFirst.mockResolvedValue(null);
    prisma.customRole.create.mockRejectedValue(new Error('FK violation'));

    await expect(handler.execute({ name: 'X' })).rejects.toThrow('FK violation');
  });
});
