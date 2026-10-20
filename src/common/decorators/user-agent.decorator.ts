import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * The client's User-Agent header, saved with refresh tokens to show which
 * device a session belongs to. Unlike @Headers('user-agent') it doesn't
 * appear in the API docs as a required parameter.
 */
export const UserAgent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined =>
    ctx.switchToHttp().getRequest<Request>().headers['user-agent'],
);
