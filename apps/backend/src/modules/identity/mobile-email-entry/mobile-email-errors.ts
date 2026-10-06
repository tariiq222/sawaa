import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
export const invalidCode = () => new BadRequestException({ code: 'invalid_or_expired_code' });
export const invalidFlow = () => new BadRequestException({ code: 'invalid_or_expired_flow' });
export const detailsUnavailable = () => new ConflictException({ code: 'details_unavailable' });
export const deliveryUnavailable = () => new ServiceUnavailableException({ code: 'delivery_unavailable' });
export function translateConflict(error: unknown): never {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw detailsUnavailable();
  throw error;
}
