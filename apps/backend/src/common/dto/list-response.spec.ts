import { toListResponse } from './list-response';

describe('toListResponse', () => {
  it('builds canonical meta for a middle page', () => {
    const res = toListResponse(['a', 'b'], 25, 2, 10);
    expect(res).toEqual({
      items: ['a', 'b'],
      meta: {
        total: 25,
        page: 2,
        perPage: 10,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      },
    });
  });

  it('first page has no previous page', () => {
    const { meta } = toListResponse([], 25, 1, 10);
    expect(meta.hasPreviousPage).toBe(false);
    expect(meta.hasNextPage).toBe(true);
  });

  it('last page has no next page', () => {
    const { meta } = toListResponse([], 25, 3, 10);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPreviousPage).toBe(true);
  });

  it('rounds totalPages up for partial pages', () => {
    expect(toListResponse([], 11, 1, 5).meta.totalPages).toBe(3);
  });

  describe('edge inputs', () => {
    it('total=0 still reports totalPages=1 (never 0)', () => {
      const { meta } = toListResponse([], 0, 1, 10);
      expect(meta.totalPages).toBe(1);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(false);
    });

    it('perPage=0 falls back to 1 instead of dividing by zero', () => {
      const { meta } = toListResponse([], 5, 1, 0);
      expect(meta.perPage).toBe(1);
      expect(meta.totalPages).toBe(5);
      expect(Number.isFinite(meta.totalPages)).toBe(true);
    });

    it('negative perPage falls back to 1', () => {
      const { meta } = toListResponse([], 3, 1, -10);
      expect(meta.perPage).toBe(1);
      expect(meta.totalPages).toBe(3);
    });

    it('page beyond totalPages reports no next page but a previous page', () => {
      const { meta } = toListResponse([], 10, 99, 10);
      expect(meta.totalPages).toBe(1);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.hasPreviousPage).toBe(true);
    });

    it('exact multiple of perPage does not add a phantom page', () => {
      expect(toListResponse([], 20, 1, 10).meta.totalPages).toBe(2);
    });
  });
});
