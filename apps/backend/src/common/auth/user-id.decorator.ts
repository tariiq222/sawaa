import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/** Injects the authenticated user's ID from req.user (populated by JwtStrategy). */
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    if (!req.user?.id) throw new Error('UserId: no authenticated user on request');
    return req.user.id;
  },
);
