import { ApiPaginatedResponse } from './api-paginated-response.decorator';

class TestDto {}

describe('ApiPaginatedResponse', () => {
  it('should return a decorator function', () => {
    const decorator = ApiPaginatedResponse(TestDto);
    expect(typeof decorator).toBe('function');
  });

  it('should accept custom description', () => {
    const decorator = ApiPaginatedResponse(TestDto, 'Custom desc');
    expect(typeof decorator).toBe('function');
  });
});
