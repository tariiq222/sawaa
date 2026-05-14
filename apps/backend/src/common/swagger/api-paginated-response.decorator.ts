import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginationMetaDto } from './api-paginated.dto';

/**
 * Produces a typed `@ApiOkResponse` whose schema is
 *   { data: ItemDto[], meta: PaginationMetaDto }
 */
export const ApiPaginatedResponse = <TItem extends Type<unknown>>(
  item: TItem,
  description = 'Paginated result',
): ClassDecorator & MethodDecorator =>
  applyDecorators(
    ApiExtraModels(PaginationMetaDto, item),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(item) } },
          meta: { $ref: getSchemaPath(PaginationMetaDto) },
        },
      },
    }),
  );
