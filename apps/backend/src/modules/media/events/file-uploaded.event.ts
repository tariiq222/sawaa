import { BaseEvent } from '../../../common/events';

export interface FileUploadedPayload {
  fileId: string;
  organizationId: string;
  sizeBytes: number;
}

export class FileUploadedEvent extends BaseEvent<FileUploadedPayload> {
  readonly eventName = 'media.file.uploaded';

  constructor(payload: FileUploadedPayload) {
    super({ source: 'media', version: 1, payload });
  }
}
