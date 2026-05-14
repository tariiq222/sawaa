import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Shape of every error response produced by HttpExceptionFilter.
 * Used exclusively for OpenAPI documentation — not instantiated at runtime.
 */
export class ApiErrorDto {
  @ApiProperty({ example: 400, description: 'HTTP status code' })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request', description: 'Short error category' })
  error!: string;

  @ApiProperty({
    example: 'validation failed',
    description: 'Human-readable message or array of validation messages',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message!: string | string[];

  @ApiPropertyOptional({
    example: 'req-7f9c2e1a',
    description: 'Correlation ID for log lookup',
  })
  requestId?: string;

  @ApiProperty({ example: '2026-04-17T12:34:56.000Z', description: 'ISO timestamp' })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/dashboard/bookings', description: 'Request path' })
  path!: string;
}
