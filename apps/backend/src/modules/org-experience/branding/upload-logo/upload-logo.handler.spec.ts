import { BadRequestException } from '@nestjs/common';
import { UploadLogoHandler } from './upload-logo.handler';
import { UploadFileHandler } from '../../../media/files/upload-file.handler';
import { PrismaService } from '../../../../infrastructure/database';
import { TenantContextService } from '../../../../common/tenant';

const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MOCK_FILE_ROW = {
  id: 'file-7',
  bucket: 'deqah',
  storageKey: 'tenant/new-logo.png',
  url: 'https://cdn/new-logo.png',
};

function makeHandler(overrides: { uploadResult?: typeof MOCK_FILE_ROW; orgId?: string } = {}) {
  const brandingUpsert = jest.fn().mockResolvedValue({ id: 'some-uuid', organizationId: overrides.orgId ?? DEFAULT_ORG });
  const prisma = {
    brandingConfig: { upsert: brandingUpsert },
  } as unknown as PrismaService;
  const uploadFileExecute = jest.fn().mockResolvedValue(
    overrides.uploadResult ?? MOCK_FILE_ROW,
  );
  const uploadFile = { execute: uploadFileExecute } as unknown as UploadFileHandler;
  const tenant = {
    requireOrganizationId: jest.fn().mockReturnValue(overrides.orgId ?? DEFAULT_ORG),
  } as unknown as TenantContextService;
  return {
    handler: new UploadLogoHandler(prisma, uploadFile, tenant),
    brandingUpsert,
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

  it('on happy path: calls uploadFile then upserts branding.logoUrl scoped by org', async () => {
    const { handler, uploadFileExecute, brandingUpsert } = makeHandler();

    const res = await handler.execute(validCmd, Buffer.alloc(2048));

    expect(uploadFileExecute).toHaveBeenCalledWith(
      expect.objectContaining({ ownerType: 'branding' }),
      expect.any(Buffer),
    );
    expect(brandingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: DEFAULT_ORG },
        update: { logoUrl: MOCK_FILE_ROW.url },
      }),
    );
    expect(res).toEqual({ fileId: MOCK_FILE_ROW.id, url: MOCK_FILE_ROW.url });
  });
});
