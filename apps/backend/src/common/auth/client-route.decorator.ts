import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ClientSessionGuard } from '../guards/client-session.guard';
import { Public } from '../guards/jwt.guard';

/**
 * Protects a controller (or handler) with the client session.
 *
 * Exempts the route from the global staff JwtGuard via `@Public()` and requires
 * a valid client session via `ClientSessionGuard`. This is the only sanctioned
 * way to protect a client-session route; never combine `@Public()` and
 * `@UseGuards(ClientSessionGuard)` by hand.
 *
 * Extra guards that must run BEFORE the client session guard go in a
 * `@UseGuards(...)` placed BELOW `@ClientRoute()` (decorators apply bottom-up).
 */
export const ClientRoute = () =>
  applyDecorators(
    Public(),
    UseGuards(ClientSessionGuard),
    ApiBearerAuth(),
  );
