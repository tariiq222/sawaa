import { SetMetadata } from '@nestjs/common';

/**
 * Routes decorated with `@AllowDuringSuspension()` bypass the suspended-org
 * check in JwtGuard — kept for future use or if org suspension is re-enabled.
 * Currently a no-op in single-tenant mode (JwtGuard does not enforce suspension).
 */
export const ALLOW_DURING_SUSPENSION_KEY = 'allowDuringSuspension';

export const AllowDuringSuspension = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_DURING_SUSPENSION_KEY, true);
