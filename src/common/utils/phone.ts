const ARABIC_DIGITS = /[٠-٩]/g;

/**
 * Normalizes a Libyan mobile number to E.164 (+2189XXXXXXXX).
 * Accepts 0912345678, 912345678, 218912345678, +218 91 234 5678,
 * 00218912345678 and Arabic-Indic digits. Returns null if it isn't valid.
 */
export function normalizeLibyanPhone(input: string): string | null {
  const digits = input
    .replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s\-().]/g, '')
    .replace(/^\+/, '')
    .replace(/^00/, '');

  let national: string;
  if (/^2189\d{8}$/.test(digits)) national = digits.slice(3);
  else if (/^09\d{8}$/.test(digits)) national = digits.slice(1);
  else if (/^9\d{8}$/.test(digits)) national = digits;
  else return null;

  return `+218${national}`;
}
