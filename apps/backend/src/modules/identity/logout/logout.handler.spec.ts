import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { LogoutHandler } from './logout.handler';

describe('LogoutHandler', () => {
  let handler: LogoutHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogoutHandler,
        { provide: PrismaService, useValue: {
    refreshToken: { updateMany: jest.fn() },
    user: { update: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<LogoutHandler>(LogoutHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({userId:"00000000-0000-0000-0000-000000000001"});
  });
});
