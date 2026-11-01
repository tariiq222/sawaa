import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { DashboardMediaController } from './media.controller';
import { UploadFileHandler } from '../../modules/media/files/upload-file.handler';
import { GetFileHandler } from '../../modules/media/files/get-file.handler';
import { DeleteFileHandler } from '../../modules/media/files/delete-file.handler';
import { GeneratePresignedUrlHandler } from '../../modules/media/files/generate-presigned-url.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardMediaController (e2e)', () => {
  let app: INestApplication;

  const mockUpload = { execute: jest.fn() };
  const mockGetFile = { execute: jest.fn() };
  const mockDeleteFile = { execute: jest.fn() };
  const mockPresignedUrl = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardMediaController],
      providers: [
        { provide: UploadFileHandler, useValue: mockUpload },
        { provide: GetFileHandler, useValue: mockGetFile },
        { provide: DeleteFileHandler, useValue: mockDeleteFile },
        { provide: GeneratePresignedUrlHandler, useValue: mockPresignedUrl },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = { sub: 'user-1' };
          return true;
        },
      })
      .overrideGuard(CaslGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const fileId = '00000000-0000-4000-a000-000000000001';

  describe('POST /dashboard/media/upload', () => {
    it('documents storageKey in the generated upload response contract', () => {
      const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
      const response = document.paths['/dashboard/media/upload'].post!.responses['201'] as unknown as {
        content: { 'application/json': { schema: { properties: Record<string, unknown> } } };
      };
      expect(response.content['application/json'].schema.properties.storageKey).toEqual({ type: 'string' });
    });

    it.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])('passes supported %s uploads to the handler', async (contentType) => {
      mockUpload.execute.mockResolvedValue({ id: fileId, storageKey: 'org/image' });
      await request(app.getHttpServer())
        .post('/dashboard/media/upload')
        .attach('file', Buffer.from('test'), { filename: 'image', contentType })
        .expect(201);
      expect(mockUpload.execute).toHaveBeenCalledWith(expect.objectContaining({ mimetype: contentType }), expect.any(Buffer));
    });

    it.each([
      'application/pdf', 'application/msword', 'text/plain', 'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/svg+xml',
    ])('rejects unused %s uploads before invoking the handler', async (contentType) => {
      await request(app.getHttpServer())
        .post('/dashboard/media/upload')
        .attach('file', Buffer.from('test'), { filename: 'file', contentType })
        .expect(400);
      expect(mockUpload.execute).not.toHaveBeenCalled();
    });

    it('rejects a file larger than 10 MiB at the HTTP boundary', async () => {
      await request(app.getHttpServer())
        .post('/dashboard/media/upload')
        .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' })
        .expect(413);
      expect(mockUpload.execute).not.toHaveBeenCalled();
    });

    it('accepts a file immediately below the 10 MiB HTTP limit', async () => {
      mockUpload.execute.mockResolvedValue({ id: fileId, storageKey: 'org/image' });
      await request(app.getHttpServer())
        .post('/dashboard/media/upload')
        .attach('file', Buffer.alloc(10 * 1024 * 1024 - 1), { filename: 'large.png', contentType: 'image/png' })
        .expect(201);
    });

    it('returns 201 on file upload', async () => {
      mockUpload.execute.mockResolvedValue({ id: fileId, storageKey: 'org/image', url: 'https://cdn.example.com/file.png' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/media/upload')
        .set('Authorization', 'Bearer fake-jwt')
        .attach('file', Buffer.from('test content'), 'test.png')
        .field('visibility', 'PUBLIC')
        .field('ownerType', 'Employee')
        .field('ownerId', '00000000-0000-4000-a000-000000000002')
        .expect(201);

      expect(res.body.id).toBe(fileId);
    });

    it('returns 400 when no file is uploaded', async () => {
      const res = await request(app.getHttpServer())
        .post('/dashboard/media/upload')
        .set('Authorization', 'Bearer fake-jwt')
        .field('visibility', 'PUBLIC')
        .expect(400);

      expect(res.body.message).toBe('No file uploaded');
    });

    it('returns 400 for invalid visibility', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/media/upload')
        .set('Authorization', 'Bearer fake-jwt')
        .attach('file', Buffer.from('test'), 'test.png')
        .field('visibility', 'SECRET')
        .expect(400);
    });

    it('returns 400 for invalid ownerId', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/media/upload')
        .set('Authorization', 'Bearer fake-jwt')
        .attach('file', Buffer.from('test'), 'test.png')
        .field('ownerId', 'not-a-uuid')
        .expect(400);
    });
  });

  describe('GET /dashboard/media/:id', () => {
    it('returns 200 with file metadata', async () => {
      mockGetFile.execute.mockResolvedValue({ id: fileId, filename: 'test.txt', size: 1024 });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/media/${fileId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.filename).toBe('test.txt');
      expect(mockGetFile.execute).toHaveBeenCalledWith(fileId);
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/media/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('DELETE /dashboard/media/:id', () => {
    it('returns 403 when actor identity is missing (JwtGuard mocked, no req.user populated)', async () => {
      // P1: handler now requires actorUserId from req.user. The mocked guard
      // here doesn't populate it, so the controller throws ForbiddenException.
      // Production wires JwtStrategy which does set req.user.
      await request(app.getHttpServer())
        .delete(`/dashboard/media/${fileId}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(403);
      expect(mockDeleteFile.execute).not.toHaveBeenCalled();
    });
  });

  describe('GET /dashboard/media/:id/presigned-url', () => {
    it('returns 200 with presigned url', async () => {
      mockPresignedUrl.execute.mockResolvedValue({
        url: 'https://storage.example.com/presigned',
        expiresAt: '2026-12-31T23:59:59Z',
      });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/media/${fileId}/presigned-url`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.url).toBe('https://storage.example.com/presigned');
      expect(mockPresignedUrl.execute).toHaveBeenCalledWith(
        expect.objectContaining({ fileId, expirySeconds: undefined }),
      );
    });

    it('passes expirySeconds query param', async () => {
      mockPresignedUrl.execute.mockResolvedValue({ url: 'https://example.com', expiresAt: '2026-12-31T23:59:59Z' });

      await request(app.getHttpServer())
        .get(`/dashboard/media/${fileId}/presigned-url?expirySeconds=600`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(mockPresignedUrl.execute).toHaveBeenCalledWith(
        expect.objectContaining({ fileId, expirySeconds: 600 }),
      );
    });

    it('returns 400 for invalid expirySeconds', async () => {
      return request(app.getHttpServer())
        .get(`/dashboard/media/${fileId}/presigned-url?expirySeconds=30`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });
});
