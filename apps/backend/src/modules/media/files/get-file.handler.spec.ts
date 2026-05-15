import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetFileHandler } from './get-file.handler';

describe('GetFileHandler', () => {
  let handler: GetFileHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetFileHandler,
        { provide: PrismaService, useValue: {
    file: { findFirst: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetFileHandler>(GetFileHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.file.findFirst as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({});
    expect(result).toBeDefined();
    
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({})).rejects.toThrow();
  });
});
