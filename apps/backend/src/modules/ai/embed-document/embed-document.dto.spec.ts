import 'reflect-metadata';
import { EmbedDocumentDto } from './embed-document.dto';

describe('EmbedDocumentDto', () => {
  it('should be defined', () => {
    const dto = new EmbedDocumentDto();
    expect(dto).toBeDefined();
  });
});
