import { FileUploadedEvent } from './file-uploaded.event';

describe('FileUploadedEvent', () => {
  it('should create an instance', () => {
    const event = new FileUploadedEvent({
    payload: 'test'
  });
    expect(event).toBeDefined();
  });
});
