import { FileUploadedEvent } from './file-uploaded.event';

describe('FileUploadedEvent', () => {
  it('sets the canonical eventName, source, and version', () => {
    const event = new FileUploadedEvent({
      fileId: 'f-1',
      organizationId: 'org-1',
      sizeBytes: 1024,
    });

    expect(event.eventName).toBe('media.file.uploaded');
    expect(event.source).toBe('media');
    expect(event.version).toBe(1);
  });

  it('exposes the payload through toEnvelope / payload accessor', () => {
    const payload = {
      fileId: 'f-1',
      organizationId: 'org-1',
      sizeBytes: 2048,
    };
    const event = new FileUploadedEvent(payload);

    expect(event.payload).toEqual(payload);
    const envelope = event.toEnvelope();
    expect(envelope.payload).toEqual(payload);
    expect(envelope.source).toBe('media');
    expect(envelope.version).toBe(1);
    expect(envelope.eventId).toBeDefined();
    expect(envelope.correlationId).toBeDefined();
    expect(envelope.occurredAt).toBeInstanceOf(Date);
  });
});