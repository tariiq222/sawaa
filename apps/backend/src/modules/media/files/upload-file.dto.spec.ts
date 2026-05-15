import 'reflect-metadata';
import { UploadFileDto } from './upload-file.dto';

describe('UploadFileDto', () => {
  it('should be defined', () => {
    const dto = new UploadFileDto();
    expect(dto).toBeDefined();
  });
});
