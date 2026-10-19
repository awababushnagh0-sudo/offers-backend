import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Every route requires a logged-in user by default. Mark a route or
 * controller with @Public() to allow anonymous access. If a valid token is
 * sent anyway, the user is still attached to the request.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
