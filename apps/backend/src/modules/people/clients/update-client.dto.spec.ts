import 'reflect-metadata';
import { UpdateClientDto } from './update-client.dto';

describe('UpdateClientDto', () => {
  it('should be defined', () => {
    const dto = new UpdateClientDto();
    expect(dto).toBeDefined();
  });
});
