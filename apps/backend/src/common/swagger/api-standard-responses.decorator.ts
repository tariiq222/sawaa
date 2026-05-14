import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ApiErrorDto } from './api-error.dto';

/**
 * Applies the baseline error responses every PROTECTED endpoint can return:
 *   400 Bad Request   – validation failure
 *   401 Unauthorized  – missing/invalid JWT
 *   403 Forbidden     – CASL denied the action
 *   500 Internal      – unhandled error
 *
 * Endpoints that look up a resource should additionally add their own 404.
 *
 * Do NOT use on public/unauthenticated controllers (src/api/public/**) —
 * those should use `ApiPublicResponses()` below so they don't falsely
 * advertise 401/403.
 */
export const ApiStandardResponses = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiResponse({ status: 400, description: 'Validation failed', type: ApiErrorDto }),
    ApiResponse({ status: 401, description: 'Missing or invalid authentication', type: ApiErrorDto }),
    ApiResponse({ status: 403, description: 'Action denied by permission policy', type: ApiErrorDto }),
    ApiResponse({ status: 500, description: 'Unhandled server error', type: ApiErrorDto }),
  );

/**
 * Baseline error responses for public (unauthenticated) endpoints:
 *   400 Bad Request  – validation failure
 *   500 Internal     – unhandled error
 */
export const ApiPublicResponses = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    ApiResponse({ status: 400, description: 'Validation failed', type: ApiErrorDto }),
    ApiResponse({ status: 500, description: 'Unhandled server error', type: ApiErrorDto }),
  );
