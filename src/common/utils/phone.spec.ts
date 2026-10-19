import { normalizeLibyanPhone } from './phone.js';

describe('normalizeLibyanPhone', () => {
  it.each([
    '0912345678',
    '912345678',
    '218912345678',
    '+218912345678',
    '00218912345678',
    '+218 91 234 5678',
    '091-234-5678',
    '٠٩١٢٣٤٥٦٧٨',
  ])('normalizes %s', (input) => {
    expect(normalizeLibyanPhone(input)).toBe('+218912345678');
  });

  it.each(['', '12345', '0212345678', '+20912345678', '09123456789', 'abc'])(
    'rejects %s',
    (input) => {
      expect(normalizeLibyanPhone(input)).toBeNull();
    },
  );
});
