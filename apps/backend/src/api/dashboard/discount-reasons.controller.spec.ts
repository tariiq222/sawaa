import 'reflect-metadata';
import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { ModelPropertiesAccessor } from '@nestjs/swagger/dist/services/model-properties-accessor';
import { SchemaObjectFactory } from '@nestjs/swagger/dist/services/schema-object-factory';
import { SwaggerTypesMapper } from '@nestjs/swagger/dist/services/swagger-types-mapper';
import { DashboardDiscountReasonsController } from './discount-reasons.controller';
import { DiscountReasonResponseDto } from '../../modules/org-experience/discount-reasons/discount-reason-response.dto';

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
  const controller = new DashboardDiscountReasonsController(
    listReasons as never,
    createReason as never,
    updateReason as never,
    deleteReason as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('documents the complete Prisma row returned by list/create/update', () => {
    const schemas: Record<string, SchemaObject> = {};
    const factory = new SchemaObjectFactory(new ModelPropertiesAccessor(), new SwaggerTypesMapper());
    factory.exploreModelSchema(DiscountReasonResponseDto, schemas);

    expect(Object.keys(schemas['DiscountReasonResponseDto'].properties ?? {}).sort()).toEqual(Object.keys(reason).sort());
    expect(schemas['DiscountReasonResponseDto'].required?.sort()).toEqual(Object.keys(reason).sort());
    expect(schemas['DiscountReasonResponseDto'].properties?.labelEn).toMatchObject({ type: 'string', nullable: true });
    expect(schemas['DiscountReasonResponseDto'].properties?.createdAt).toMatchObject({ type: 'string', format: 'date-time' });
  });

  it('binds list/create/update Swagger responses to DiscountReasonResponseDto', () => {
    const listResponse = Reflect.getMetadata(DECORATORS.API_RESPONSE, controller.listEndpoint);
    const createResponse = Reflect.getMetadata(DECORATORS.API_RESPONSE, controller.createEndpoint);
    const updateResponse = Reflect.getMetadata(DECORATORS.API_RESPONSE, controller.updateEndpoint);

    expect(listResponse[HttpStatus.OK].type).toBe(DiscountReasonResponseDto);
    expect(listResponse[HttpStatus.OK].isArray).toBe(true);
    expect(createResponse[HttpStatus.CREATED].type).toBe(DiscountReasonResponseDto);
    expect(updateResponse[HttpStatus.OK].type).toBe(DiscountReasonResponseDto);
  });

  it('preserves the actual 204 no-content delete HTTP contract', async () => {
    deleteReason.execute.mockResolvedValue({ id: reason.id });

    await expect(controller.deleteEndpoint(reason.id)).resolves.toEqual({ id: reason.id });
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, controller.deleteEndpoint)).toBe(HttpStatus.NO_CONTENT);

    const deleteResponse = Reflect.getMetadata(DECORATORS.API_RESPONSE, controller.deleteEndpoint);
    expect(deleteResponse[HttpStatus.NO_CONTENT]).toMatchObject({ description: 'Discount reason deleted' });
    expect(deleteResponse[HttpStatus.NO_CONTENT].type).toBeUndefined();
  });
});
