import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, Matches } from 'class-validator';
import { normalizeLibyanPhone } from '../utils/phone.js';

/**
 * Accepts any common Libyan mobile format and converts it to +2189XXXXXXXX.
 */
export function IsLibyanPhone() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string'
        ? (normalizeLibyanPhone(value) ?? value)
        : value,
    ),
    Matches(/^\+2189\d{8}$/, {
      message: '$property must be a valid Libyan mobile number',
    }),
  );
}

/** Optional boolean query parameter: accepts "true" / "false". */
export function OptionalBooleanQuery() {
  return applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) =>
      value === 'true' ? true : value === 'false' ? false : value,
    ),
    IsBoolean(),
  );
}
