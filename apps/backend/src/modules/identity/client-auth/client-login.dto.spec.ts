import 'reflect-metadata';
import { ClientLoginDto } from './client-login.dto';

describe('ClientLoginDto', () => {
  it('should be defined', () => {
    const dto = new ClientLoginDto();
    expect(dto).toBeDefined();
  });
});
