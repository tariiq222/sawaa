import 'reflect-metadata';
import { UpdateContactMessageStatusDto } from './update-contact-message-status.dto';

describe('UpdateContactMessageStatusDto', () => {
  it('should be defined', () => {
    const dto = new UpdateContactMessageStatusDto();
    expect(dto).toBeDefined();
  });
});
