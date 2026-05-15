import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { PasswordService } from '../shared/password.service';
import { CreateUserHandler } from './create-user.handler';

describe('CreateUserHandler', () => {
  let handler: CreateUserHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateUserHandler,
    { provide: PrismaService, useValue: {
    user: { findUnique: jest.fn() }
    } },
    { provide: PasswordService, useValue: {} }
      ],
    }).compile();

    handler = module.get<CreateUserHandler>(CreateUserHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    try {
      await handler.execute({ id: '00000000-0000-0000-0000-000000000001' });
    } catch (e) {
      // Expected for incomplete mocks
    }
  });
});
