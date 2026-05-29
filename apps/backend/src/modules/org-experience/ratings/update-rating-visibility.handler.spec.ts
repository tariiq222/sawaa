import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateRatingVisibilityHandler } from './update-rating-visibility.handler';

describe('UpdateRatingVisibilityHandler', () => {
  let handler: UpdateRatingVisibilityHandler;
  const mockFindUnique = jest.fn();
  const mockUpdate = jest.fn();

  beforeEach(async () => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        UpdateRatingVisibilityHandler,
        {
          provide: PrismaService,
          useValue: {
            rating: {
              findUnique: mockFindUnique,
              update: mockUpdate,
            },
          },
        },
      ],
    }).compile();

    handler = module.get(UpdateRatingVisibilityHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('updates visibility when rating exists', async () => {
    mockFindUnique.mockResolvedValue({ id: 'r1' });
    mockUpdate.mockResolvedValue({ id: 'r1', isPublic: true });

    const result = await handler.execute({ id: 'r1', isPublic: true });

    expect(result.id).toBe('r1');
    expect(result.isPublic).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { isPublic: true },
    });
  });

  it('throws NotFoundException when rating does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(handler.execute({ id: 'missing', isPublic: false })).rejects.toThrow(NotFoundException);
  });
});
