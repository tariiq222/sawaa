import 'reflect-metadata';
import { SendStaffMessageDto } from './send-staff-message.dto';

describe('SendStaffMessageDto', () => {
  it('should be defined', () => {
    const dto = new SendStaffMessageDto();
    expect(dto).toBeDefined();
  });
});
