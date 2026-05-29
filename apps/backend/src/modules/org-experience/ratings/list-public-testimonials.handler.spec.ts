import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { ListPublicTestimonialsHandler } from './list-public-testimonials.handler';

describe('ListPublicTestimonialsHandler', () => {
  let handler: ListPublicTestimonialsHandler;
  const mockFindManyRatings = jest.fn();
  const mockFindManyClients = jest.fn();

  beforeEach(async () => {
    mockFindManyRatings.mockReset();
    mockFindManyClients.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        ListPublicTestimonialsHandler,
        {
          provide: PrismaService,
          useValue: {
            rating: { findMany: mockFindManyRatings },
            client: { findMany: mockFindManyClients },
          },
        },
      ],
    }).compile();

    handler = module.get(ListPublicTestimonialsHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('returns anonymized testimonials with first letter', async () => {
    mockFindManyRatings.mockResolvedValue([
      {
        id: 'r1',
        clientId: 'c1',
        comment: 'Great service',
        score: 5,
        createdAt: new Date('2025-01-15'),
      },
    ]);
    mockFindManyClients.mockResolvedValue([
      { id: 'c1', name: 'أبو يامن', firstName: 'أبو يامن', lastName: null },
    ]);

    const result = await handler.execute({ limit: 6 });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('أب****');
    expect(result[0].letter).toBe('أ');
    expect(result[0].rating).toBe(5);
    expect(result[0].text).toBe('Great service');
  });

  it('falls back to عميل when client is missing', async () => {
    mockFindManyRatings.mockResolvedValue([
      {
        id: 'r2',
        clientId: 'c-missing',
        comment: null,
        score: 4,
        createdAt: new Date('2025-01-15'),
      },
    ]);
    mockFindManyClients.mockResolvedValue([]);

    const result = await handler.execute({ limit: 6 });

    expect(result[0].name).toBe('عم****');
    expect(result[0].letter).toBe('ع');
    expect(result[0].text).toBe('');
  });
});
