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

/**
 * An optional text field that an empty string clears: "" is stored as null.
 * Put it with `@IsOptional()`, which then skips the other checks.
 */
export function EmptyAsNull() {
  return Transform(({ value }: { value: unknown }) =>
    value === '' ? null : value,
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

/**
 * A price in LD with up to 3 decimals, e.g. "8" or "8.500". Numbers are
 * accepted and converted to strings, so no float rounding reaches the database.
 */
export function IsPrice() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'number' ? String(value) : value,
    ),
    Matches(/^(?!0+(\.0+)?$)\d{1,7}(\.\d{1,3})?$/, {
      message:
        '$property must be a price above 0 with up to 3 decimals, e.g. "8.500"',
    }),
  );
}
