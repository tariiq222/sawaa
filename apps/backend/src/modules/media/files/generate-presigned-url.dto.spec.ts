import 'reflect-metadata';
import { GeneratePresignedUrlDto } from './generate-presigned-url.dto';

describe('GeneratePresignedUrlDto', () => {
  it('should be defined', () => {
    const dto = new GeneratePresignedUrlDto();
    expect(dto).toBeDefined();
  });
});
