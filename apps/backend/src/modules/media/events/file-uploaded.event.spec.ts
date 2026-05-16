import { FileUploadedEvent } from './file-uploaded.event';

describe('FileUploadedEvent', () => {
  it('should create an instance', () => {
    const event = new FileUploadedEvent({} as any);
    expect(event).toBeDefined();
  });
});
