import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { SubmitRatingHandler } from './submit-rating.handler';

describe('SubmitRatingHandler', () => {
  let handler: SubmitRatingHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmitRatingHandler,
        { provide: PrismaService, useValue: {
          rating: { findUnique: jest.fn(), create: jest.fn() },
        } },
      ],
    }).compile();

    handler = module.get<SubmitRatingHandler>(SubmitRatingHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should submit rating', async () => {
    (prisma.rating.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.rating.create as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({
      bookingId: 'b', clientId: 'c', employeeId: 'e', score: 4, comment: 'Good', isPublic: true,
    });
    expect(prisma.rating.create).toHaveBeenCalled();
  });

  it('should throw when score out of range', async () => {
    await expect(handler.execute({
      bookingId: 'b', clientId: 'c', employeeId: 'e', score: 6, comment: '', isPublic: false,
    })).rejects.toThrow();
  });

  it('should throw when rating already exists', async () => {
    (prisma.rating.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });
    await expect(handler.execute({
      bookingId: 'b', clientId: 'c', employeeId: 'e', score: 3, comment: '', isPublic: false,
    })).rejects.toThrow();
  });
});
