import 'reflect-metadata';
import { BankTransferUploadDto } from './bank-transfer-upload.dto';

describe('BankTransferUploadDto', () => {
  it('should be defined', () => {
    const dto = new BankTransferUploadDto();
    expect(dto).toBeDefined();
  });
});
