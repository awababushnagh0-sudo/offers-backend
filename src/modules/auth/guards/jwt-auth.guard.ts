import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../../../common/auth/auth-user.js';
import { ALLOW_TEMPORARY_PASSWORD_KEY } from '../../../common/decorators/allow-temporary-password.decorator.js';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';

/** Registered globally: every route needs a valid access token unless @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      request.user = {
        id: payload.sub,
        role: payload.role,
        mustChangePassword: payload.mcp === true,
      };
    } catch {
      // A bad token on a public route is ignored, not rejected.
      if (!isPublic) {
        throw new UnauthorizedException('Invalid or expired access token');
      }
      return true;
    }

    if (request.user.mustChangePassword && !isPublic) {
      const allowed = this.reflector.getAllAndOverride<boolean>(
        ALLOW_TEMPORARY_PASSWORD_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!allowed) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'PasswordChangeRequired',
          message: 'Change your temporary password first',
        });
      }
    }
    return true;
  }
}

function extractBearerToken(request: Request): string | undefined {
  const [type, token] = request.headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' && token ? token : undefined;
}
