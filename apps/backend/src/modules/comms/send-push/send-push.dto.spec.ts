import 'reflect-metadata';
import { SendPushDto } from './send-push.dto';

describe('SendPushDto', () => {
  it('should be defined', () => {
    const dto = new SendPushDto();
    expect(dto).toBeDefined();
  });
});
