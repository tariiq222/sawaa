import 'reflect-metadata';
import { ClientResponseDto } from './people-response.dto';

describe('ClientResponseDto', () => {
  it('should be defined', () => {
    const dto = new ClientResponseDto();
    expect(dto).toBeDefined();
  });
});
