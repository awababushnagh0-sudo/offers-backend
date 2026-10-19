import { randomInt } from 'node:crypto';

// Uppercase without look-alikes (0/O, 1/I/L), so a cashier can type it if the
// QR code won't scan. 31^8 ≈ 850 billion combinations.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CLAIM_CODE_LENGTH = 8;

export function generateClaimCode(): string {
  let code = '';
  for (let i = 0; i < CLAIM_CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

/** Accepts "abcd-2345", " ABCD 2345 " etc. and returns "ABCD2345". */
export function normalizeClaimCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}
