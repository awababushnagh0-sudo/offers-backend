import {
  isGoogleMapsHost,
  isInLibya,
  isShortMapsLink,
  parseLocation,
} from './location.js';

const tripoli = { latitude: 32.8872, longitude: 13.1913 };

describe('parseLocation', () => {
  it.each(['32.8872, 13.1913', '32.8872,13.1913', ' 32.8872 ، 13.1913 '])(
    'reads plain coordinates: %s',
    (input) => {
      expect(parseLocation(input)).toEqual(tripoli);
    },
  );

  it.each([
    'https://www.google.com/maps?q=32.8872,13.1913',
    'https://maps.google.com/?q=32.8872,13.1913&z=17',
    'https://www.google.com/maps/@32.8872,13.1913,17z',
    'https://www.google.com/maps/search/?api=1&query=32.8872%2C13.1913',
    'https://www.google.ly/maps/@32.8872,13.1913,17z',
  ])('reads links from any Google Maps host: %s', (link) => {
    expect(parseLocation(link)).toEqual(tripoli);
  });

  it('prefers the pin over the map center in place links', () => {
    const link =
      'https://www.google.com/maps/place/Some+Cafe/@32.80,13.10,15z/' +
      'data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d32.8872!4d13.1913';
    expect(parseLocation(link)).toEqual(tripoli);
  });

  it.each([
    '',
    'Hay Al Andalus',
    'https://maps.app.goo.gl/AbCdEf123',
    '132.5, 13.1',
    'حي الأندلس ١٠٠%',
  ])('gives up on anything else: %s', (input) => {
    expect(parseLocation(input)).toBeNull();
  });
});

describe('isInLibya', () => {
  it('knows roughly where Libya is', () => {
    expect(isInLibya(tripoli)).toBe(true);
    expect(isInLibya({ latitude: 32.1167, longitude: 20.0667 })).toBe(true);
    // Latitude and longitude typed the wrong way round.
    expect(isInLibya({ latitude: 13.1913, longitude: 32.8872 })).toBe(false);
    expect(isInLibya({ latitude: 48.85, longitude: 2.35 })).toBe(false);
  });
});

describe('Google Maps hosts', () => {
  it('recognizes short links', () => {
    expect(isShortMapsLink(new URL('https://maps.app.goo.gl/AbC123'))).toBe(
      true,
    );
    expect(isShortMapsLink(new URL('https://goo.gl/maps/AbC123'))).toBe(true);
    expect(isShortMapsLink(new URL('https://goo.gl/other'))).toBe(false);
  });

  it.each([
    'https://www.google.com/maps/place/x',
    'https://maps.google.com/?q=x',
    'https://www.google.com.ly/maps',
    'https://consent.google.com/ml?continue=x',
  ])('lets redirects go through %s', (link) => {
    expect(isGoogleMapsHost(new URL(link))).toBe(true);
  });

  it.each([
    'https://evil.com/maps',
    'https://google.com.evil.com/maps',
    'http://169.254.169.254/latest',
    'https://localhost:3000/',
  ])('stops at %s', (link) => {
    expect(isGoogleMapsHost(new URL(link))).toBe(false);
  });
});
