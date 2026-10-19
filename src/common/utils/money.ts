/** Formats a Prisma Decimal price as a string with 3 decimals, e.g. "4.000". */
export function formatPrice(value: {
  toFixed(digits: number): string;
}): string {
  return value.toFixed(3);
}
