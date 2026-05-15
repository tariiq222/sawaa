import 'reflect-metadata';
import { RegisterFcmTokenDto } from './register-fcm-token.dto';

describe('RegisterFcmTokenDto', () => {
  it('should be defined', () => {
    const dto = new RegisterFcmTokenDto();
    expect(dto).toBeDefined();
  });
});
