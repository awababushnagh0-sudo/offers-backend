import { randomInt } from 'node:crypto';

// No look-alike characters (0/O, 1/l/I), since these are read out or texted.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A random password given to a new merchant, who must change it on first login. */
export function generateTemporaryPassword(length = 10): string {
  let password = '';
  for (let i = 0; i < length; i++) {
    password += ALPHABET[randomInt(ALPHABET.length)];
  }
  return password;
}
