import { validateMagicBytes } from './magic-byte-validator';

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
}));

describe('validateMagicBytes', () => {
  it('accepts whitelisted text mime with no magic bytes', async () => {
    const { fileTypeFromBuffer } = jest.requireMock('file-type');
    fileTypeFromBuffer.mockResolvedValue(undefined);
    const result = await validateMagicBytes(
      Buffer.from('hello'),
      'text/plain',
      ['text/plain', 'text/csv'],
    );
    expect(result.ok).toBe(true);
    expect(result.detectedMime).toBeNull();
  });

  it('rejects non-whitelisted text mime with no magic bytes', async () => {
    const { fileTypeFromBuffer } = jest.requireMock('file-type');
    fileTypeFromBuffer.mockResolvedValue(undefined);
    const result = await validateMagicBytes(
      Buffer.from('hello'),
      'application/json',
      ['text/plain'],
    );
    expect(result.ok).toBe(false);
  });

  it('rejects detected mime not in allowed list', async () => {
    const { fileTypeFromBuffer } = jest.requireMock('file-type');
    fileTypeFromBuffer.mockResolvedValue({ mime: 'image/png' });
    const result = await validateMagicBytes(
      Buffer.from([0x89, 0x50]),
      'image/png',
      ['image/jpeg'],
    );
    expect(result.ok).toBe(false);
    expect(result.detectedMime).toBe('image/png');
  });

  it('rejects when claimed mime differs from detected', async () => {
    const { fileTypeFromBuffer } = jest.requireMock('file-type');
    fileTypeFromBuffer.mockResolvedValue({ mime: 'image/png' });
    const result = await validateMagicBytes(
      Buffer.from([0x89, 0x50]),
      'image/jpeg',
      ['image/png', 'image/jpeg'],
    );
    expect(result.ok).toBe(false);
  });

  it('accepts when detected mime matches claimed', async () => {
    const { fileTypeFromBuffer } = jest.requireMock('file-type');
    fileTypeFromBuffer.mockResolvedValue({ mime: 'image/png' });
    const result = await validateMagicBytes(
      Buffer.from([0x89, 0x50]),
      'image/png',
      ['image/png'],
    );
    expect(result.ok).toBe(true);
    expect(result.detectedMime).toBe('image/png');
  });

  it('uses custom textMimes option', async () => {
    const { fileTypeFromBuffer } = jest.requireMock('file-type');
    fileTypeFromBuffer.mockResolvedValue(undefined);
    const result = await validateMagicBytes(
      Buffer.from('hello'),
      'application/json',
      ['application/json'],
      { textMimes: ['application/json'] },
    );
    expect(result.ok).toBe(true);
  });
});
