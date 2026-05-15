import { RequestContextStorage } from './request-context';

describe('RequestContextStorage', () => {
  it('should run function with context', () => {
    const ctx = { requestId: 'req-1', userId: 'u1' };
    const result = RequestContextStorage.run(ctx, () => {
      expect(RequestContextStorage.get()).toEqual(ctx);
      return 42;
    });
    expect(result).toBe(42);
  });

  it('should return undefined when no context', () => {
    expect(RequestContextStorage.get()).toBeUndefined();
  });

  it('should getOrThrow when context exists', () => {
    const ctx = { requestId: 'req-1' };
    RequestContextStorage.run(ctx, () => {
      expect(RequestContextStorage.getOrThrow()).toEqual(ctx);
    });
  });

  it('should throw when getOrThrow without context', () => {
    expect(() => RequestContextStorage.getOrThrow()).toThrow('RequestContext not initialized');
  });
});
