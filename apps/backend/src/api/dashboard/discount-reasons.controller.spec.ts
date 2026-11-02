import 'reflect-metadata';
import { HttpStatus, type INestApplication } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { DashboardDiscountReasonsController } from './discount-reasons.controller';
import { ListDiscountReasonsHandler } from '../../modules/org-experience/discount-reasons/list-discount-reasons.handler';
import { CreateDiscountReasonHandler } from '../../modules/org-experience/discount-reasons/create-discount-reason.handler';
import { UpdateDiscountReasonHandler } from '../../modules/org-experience/discount-reasons/update-discount-reason.handler';
import { DeleteDiscountReasonHandler } from '../../modules/org-experience/discount-reasons/delete-discount-reason.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

const reason = {
  id: '00000000-0000-0000-0000-000000000001',
  labelAr: 'خصم خاص',
  labelEn: null,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('DashboardDiscountReasonsController response contract', () => {
  const listReasons = { execute: jest.fn() };
  const createReason = { execute: jest.fn() };
  const updateReason = { execute: jest.fn() };
  const deleteReason = { execute: jest.fn() };
  let app: INestApplication;
  let controller: DashboardDiscountReasonsController;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardDiscountReasonsController],
      providers: [
        { provide: ListDiscountReasonsHandler, useValue: listReasons },
        { provide: CreateDiscountReasonHandler, useValue: createReason },
        { provide: UpdateDiscountReasonHandler, useValue: updateReason },
        { provide: DeleteDiscountReasonHandler, useValue: deleteReason },
      ],
    })
      .overrideGuard(JwtGuard).useValue({ canActivate: () => true })
      .overrideGuard(CaslGuard).useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    controller = app.get(DashboardDiscountReasonsController);
    document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
  });

  afterAll(async () => app?.close());

  beforeEach(() => jest.clearAllMocks());

  it('documents the complete Prisma row returned by list/create/update', () => {
    const schema = document.components?.schemas?.DiscountReasonResponseDto as SchemaObject | undefined;
    expect(schema).toBeDefined();
    if (!schema) throw new Error('DiscountReasonResponseDto schema was not generated');

    expect(Object.keys(schema.properties ?? {}).sort()).toEqual(Object.keys(reason).sort());
    expect(schema.required?.sort()).toEqual(Object.keys(reason).sort());
    expect(schema.properties?.labelEn).toMatchObject({ type: 'string', nullable: true });
    expect(schema.properties?.createdAt).toMatchObject({ type: 'string', format: 'date-time' });
  });

  it('binds list/create/update Swagger responses to DiscountReasonResponseDto', () => {
    const reasonRef = { $ref: '#/components/schemas/DiscountReasonResponseDto' };
    const itemResponse = { content: { 'application/json': { schema: reasonRef } } };

    expect(document.paths['/dashboard/discount-reasons']?.get?.responses?.['200']).toMatchObject({
      content: { 'application/json': { schema: { type: 'array', items: reasonRef } } },
    });
    expect(document.paths['/dashboard/discount-reasons']?.post?.responses?.['201']).toMatchObject(itemResponse);
    expect(document.paths['/dashboard/discount-reasons/{id}']?.patch?.responses?.['200']).toMatchObject(itemResponse);
  });

  it('preserves the actual 204 no-content delete HTTP contract', async () => {
    deleteReason.execute.mockResolvedValue({ id: reason.id });

    await expect(controller.deleteEndpoint(reason.id)).resolves.toEqual({ id: reason.id });
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, controller.deleteEndpoint)).toBe(HttpStatus.NO_CONTENT);

    const deleteResponse = document.paths['/dashboard/discount-reasons/{id}']?.delete?.responses?.['204'];
    expect(deleteResponse).toEqual({ description: 'Discount reason deleted' });
  });
});
