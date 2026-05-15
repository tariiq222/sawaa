import 'reflect-metadata';
import { CreateClientDto } from './create-client.dto';

describe('CreateClientDto', () => {
  it('should be defined', () => {
    const dto = new CreateClientDto();
    expect(dto).toBeDefined();
  });
});
