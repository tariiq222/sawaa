import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';

export interface DeleteFileCommand {
  fileId: string;
  /** Caller user id (req.user.sub). Used for uploader-only gate. */
  actorUserId: string;
  /** When true, caller bypasses the uploader check (e.g. SUPER_ADMIN). */
  bypassOwnership?: boolean;
}

@Injectable()
export class DeleteFileHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MinioService,
  ) {}

  async execute(cmd: DeleteFileCommand | string) {
    // Back-compat: callers that still pass a bare string get a NotFound (forces
    // them to migrate). Avoids silently deleting files without an uploader gate.
    if (typeof cmd === 'string') {
      throw new ForbiddenException(
        'DeleteFileHandler requires actorUserId — pass a DeleteFileCommand',
      );
    }
    const file = await this.prisma.file.findFirst({
      where: { id: cmd.fileId, isDeleted: false },
    });
    if (!file) throw new NotFoundException('File not found');

    // SECURITY (P1): only the uploader (or an explicit override) may delete.
    // Previously any caller with `manage:Setting` could wipe avatars, logos,
    // and bank-transfer receipts — including receipts uploaded by other
    // clients during payment verification.
    if (!cmd.bypassOwnership) {
      if (!file.uploadedBy || file.uploadedBy !== cmd.actorUserId) {
        throw new ForbiddenException('Only the uploader can delete this file');
      }
    }

    await this.storage.deleteFile(file.bucket, file.storageKey);

    return this.prisma.file.update({
      where: { id: file.id },
      data: { isDeleted: true },
    });
  }
}
