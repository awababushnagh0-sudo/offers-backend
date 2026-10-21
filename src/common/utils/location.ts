import type { LatLng } from './geo.js';

const NUMBER = String.raw`(-?\d{1,3}(?:\.\d+)?)`;

const PATTERNS = [
  // The pin itself: ...!3d32.88!4d13.19 (place links).
  new RegExp(`!3d${NUMBER}!4d${NUMBER}`),
  // ?q=32.88,13.19 or ?query=... or &ll=...
  new RegExp(String.raw`[?&](?:q|query|ll|destination)=${NUMBER},\s*${NUMBER}`),
  // The map's center: /@32.88,13.19,17z
  new RegExp(`@${NUMBER},${NUMBER}`),
  // Plain coordinates, the whole input.
  new RegExp(String.raw`^${NUMBER}\s*[,،]\s*${NUMBER}$`),
];

/**
 * Reads a point from what our team has at hand: a Google Maps link (shared
 * from the app or copied from the browser) or plain coordinates
 * ("32.8872, 13.1913"). The coordinates are read wherever they appear in a
 * link, whatever its host. Null when there are none, e.g. in short links
 * (see `isShortMapsLink`).
 */
export function parseLocation(input: string): LatLng | null {
  const text = decode(input.trim());
  for (const pattern of PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    return { latitude, longitude };
  }
  return null;
}

/** Roughly Libya's borders, to catch swapped or mistyped coordinates. */
export function isInLibya(point: LatLng): boolean {
  return (
    point.latitude >= 19.5 &&
    point.latitude <= 33.5 &&
    point.longitude >= 9.3 &&
    point.longitude <= 25.2
  );
}

/**
 * Links that only lead to the map through a redirect, such as the ones the
 * Google Maps app shares (maps.app.goo.gl/AbC123).
 */
export function isShortMapsLink(url: URL): boolean {
  return (
    url.hostname === 'maps.app.goo.gl' ||
    (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps'))
  );
}

/** Hosts a short link may redirect through on its way to the map. */
export function isGoogleMapsHost(url: URL): boolean {
  return (
    isShortMapsLink(url) ||
    /^(www\.|maps\.|consent\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(
      url.hostname,
    )
  );
}

/** Links come percent-encoded (`%2C` for a comma); anything else is kept. */
function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
