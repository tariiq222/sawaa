import { BadRequestException } from '@nestjs/common';
import { UploadLogoHandler } from './upload-logo.handler';
import { UploadFileHandler } from '../../../media/files/upload-file.handler';
import { PrismaService } from '../../../../infrastructure/database';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MOCK_FILE_ROW = {
  id: 'file-7',
  bucket: 'sawaa',
  storageKey: 'tenant/new-logo.png',
  url: 'https://cdn/new-logo.png',
};

function makeHandler(overrides: { uploadResult?: typeof MOCK_FILE_ROW; existing?: { id: string } | null } = {}) {
  const brandingFindFirst = jest.fn().mockResolvedValue(overrides.existing !== undefined ? overrides.existing : { id: 'branding-1' });
  const brandingUpdate = jest.fn().mockResolvedValue({ id: 'branding-1' });
  const brandingCreate = jest.fn().mockResolvedValue({ id: 'branding-new' });
  const prisma = {
    brandingConfig: { findFirst: brandingFindFirst, update: brandingUpdate, create: brandingCreate },
  } as unknown as PrismaService;
  const uploadFileExecute = jest.fn().mockResolvedValue(
    overrides.uploadResult ?? MOCK_FILE_ROW,
  );
  const uploadFile = { execute: uploadFileExecute } as unknown as UploadFileHandler;
  return {
    handler: new UploadLogoHandler(prisma, uploadFile),
    brandingFindFirst,
    brandingUpdate,
    brandingCreate,
    uploadFileExecute,
  };
}

describe('UploadLogoHandler', () => {
  const validCmd = {
    filename: 'l.png',
    mimetype: 'image/png',
    size: 2048,
  };

  it('rejects non-image mimetype', async () => {
    const { handler } = makeHandler();
    await expect(
      handler.execute({ ...validCmd, mimetype: 'application/pdf' }, Buffer.alloc(2048)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversized logo', async () => {
    const { handler } = makeHandler();
    const size = MAX_LOGO_BYTES + 1;
    await expect(
      handler.execute({ ...validCmd, size }, Buffer.alloc(size)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('on happy path: calls uploadFile then updates existing branding logoUrl', async () => {
    const { handler, uploadFileExecute, brandingFindFirst, brandingUpdate } = makeHandler();

    const res = await handler.execute(validCmd, Buffer.alloc(2048));

    expect(uploadFileExecute).toHaveBeenCalledWith(
      expect.objectContaining({ ownerType: 'branding' }),
      expect.any(Buffer),
    );
    expect(brandingFindFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
    expect(brandingUpdate).toHaveBeenCalledWith({
      where: { id: 'branding-1' },
      data: { logoUrl: MOCK_FILE_ROW.url },
    });
    expect(res).toEqual({ fileId: MOCK_FILE_ROW.id, url: MOCK_FILE_ROW.url });
  });

  it('creates branding config when none exists', async () => {
    const { handler, uploadFileExecute, brandingFindFirst, brandingCreate } = makeHandler({ existing: null });

    const res = await handler.execute(validCmd, Buffer.alloc(2048));

    expect(uploadFileExecute).toHaveBeenCalledWith(
      expect.objectContaining({ ownerType: 'branding' }),
      expect.any(Buffer),
    );
    expect(brandingFindFirst).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
    expect(brandingCreate).toHaveBeenCalledWith({
      data: { organizationNameAr: 'منظمتي', logoUrl: MOCK_FILE_ROW.url },
    });
    expect(res).toEqual({ fileId: MOCK_FILE_ROW.id, url: MOCK_FILE_ROW.url });
  });
});
