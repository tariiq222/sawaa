import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UploadAvatarHandler } from './upload-avatar.handler';
import { UploadFileHandler } from '../../../media/files/upload-file.handler';
import { ResolveEmployeeImageHandler } from '../../../media/files/resolve-employee-image.handler';
import { MinioService } from '../../../../infrastructure/storage/minio.service';
import { PrismaService } from '../../../../infrastructure/database';

const EMPLOYEE_ID = '00000000-0000-0000-0000-000000000002';
const MAX_AVATAR_BYTES = 1 * 1024 * 1024;

const MOCK_FILE_ROW = {
  id: 'file-9',
  bucket: 'sawaa',
  storageKey: 'org/new.png',
  filename: 'a.png',
  mimetype: 'image/png',
  size: 1024,
  url: 'https://cdn/new.png',
} as const;

const EXPECTED_URL = 'https://files.test/signed-avatar';

function makeHandler(overrides: {
  employeeExists?: boolean;
  uploadResult?: typeof MOCK_FILE_ROW;
  throwOnUpload?: Error;
  employee?: { avatarUrl: string | null; publicImageUrl: string | null };
} = {}) {
  const employeeFindUnique = jest.fn().mockResolvedValue(
    overrides.employeeExists === false ? null : { id: EMPLOYEE_ID, ...overrides.employee },
  );
  const employeeUpdate = jest.fn().mockResolvedValue({ id: EMPLOYEE_ID });
  const prisma = {
    employee: { findUnique: employeeFindUnique, update: employeeUpdate },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ employee: { update: employeeUpdate } }),
    ),
  } as unknown as PrismaService;

  const uploadFileExecute = overrides.throwOnUpload
    ? jest.fn().mockRejectedValue(overrides.throwOnUpload)
    : jest.fn().mockResolvedValue(overrides.uploadResult ?? MOCK_FILE_ROW);
  const uploadFile = { execute: uploadFileExecute } as unknown as UploadFileHandler;

  const handler = new UploadAvatarHandler(prisma, uploadFile, { getSignedUrl: jest.fn().mockResolvedValue(EXPECTED_URL) } as unknown as MinioService, { execute: async (q: { reference?: string | null }) => q.reference ?? null } as unknown as ResolveEmployeeImageHandler);
  return { handler, employeeFindUnique, employeeUpdate, uploadFileExecute };
}

describe('UploadAvatarHandler', () => {
  const validCmd = {
    employeeId: EMPLOYEE_ID,
    filename: 'a.png',
    mimetype: 'image/png',
    size: 1024,
  };

  it('rejects non-image mimetype', async () => {
    const { handler } = makeHandler();
    await expect(
      handler.execute({ ...validCmd, mimetype: 'application/pdf' }, Buffer.alloc(1024)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversized avatars', async () => {
    const { handler } = makeHandler();
    const size = MAX_AVATAR_BYTES + 1;
    await expect(
      handler.execute({ ...validCmd, size }, Buffer.alloc(size)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when employee does not exist', async () => {
    const { handler } = makeHandler({ employeeExists: false });
    await expect(
      handler.execute(validCmd, Buffer.alloc(1024)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps a separately selected public portrait when the staff avatar changes', async () => {
    const { handler, employeeUpdate } = makeHandler({ employee: { avatarUrl: 'org/old.jpg', publicImageUrl: 'https://cdn.test/explicit.jpg' } });
    await handler.execute(validCmd, Buffer.alloc(1024));
    expect(employeeUpdate.mock.calls[0][0].data).toEqual({ avatarUrl: 'org/new.png' });
  });

  it('updates a legacy public filename matching the uploaded avatar', async () => {
    const { handler, employeeUpdate } = makeHandler({ employee: { avatarUrl: 'http://minio:9000/sawaa/old.jpg', publicImageUrl: 'a.png' } });
    await handler.execute(validCmd, Buffer.alloc(1024));
    expect(employeeUpdate.mock.calls[0][0].data.publicImageUrl).toBe('org/new.png');
  });

  it('on happy path: calls uploadFile then updates employee.avatarUrl', async () => {
    const { handler, uploadFileExecute, employeeUpdate } = makeHandler();

    const res = await handler.execute(validCmd, Buffer.alloc(1024));

    expect(uploadFileExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: 'employee',
        ownerId: EMPLOYEE_ID,
      }),
      expect.any(Buffer),
    );
    expect(employeeUpdate).toHaveBeenCalledWith({
      where: { id: EMPLOYEE_ID },
      data: { avatarUrl: MOCK_FILE_ROW.storageKey, publicImageUrl: MOCK_FILE_ROW.storageKey },
    });
    expect(res).toEqual({ fileId: MOCK_FILE_ROW.id, url: EXPECTED_URL });
  });
  it('uploads the explicitly selected public image without replacing the internal avatar', async () => {
    const { handler, employeeUpdate } = makeHandler();
    await handler.execute({ ...validCmd, target: 'public' } as never, Buffer.alloc(1024));
    expect(employeeUpdate).toHaveBeenCalledWith({ where: { id: EMPLOYEE_ID }, data: { publicImageUrl: 'org/new.png' } });
  });
});
