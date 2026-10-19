import { SetMetadata } from '@nestjs/common';

export const ALLOW_TEMPORARY_PASSWORD_KEY = 'allowTemporaryPassword';

/**
 * Users on a temporary password can only call routes marked with this
 * (e.g. viewing their profile and changing the password).
 */
export const AllowTemporaryPassword = () =>
  SetMetadata(ALLOW_TEMPORARY_PASSWORD_KEY, true);
