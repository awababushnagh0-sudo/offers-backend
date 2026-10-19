import { distanceKm } from './geo.js';

const tripoli = { latitude: 32.8872, longitude: 13.1913 };
const benghazi = { latitude: 32.1167, longitude: 20.0667 };
const misrata = { latitude: 32.3754, longitude: 15.0925 };

describe('distanceKm', () => {
  it('is zero for the same point', () => {
    expect(distanceKm(tripoli, tripoli)).toBe(0);
  });

  it('matches known distances between Libyan cities', () => {
    expect(distanceKm(tripoli, misrata)).toBeCloseTo(187, -1);
    expect(distanceKm(tripoli, benghazi)).toBeCloseTo(649, -1);
  });

  it('is symmetric', () => {
    expect(distanceKm(tripoli, benghazi)).toBeCloseTo(
      distanceKm(benghazi, tripoli),
      10,
    );
  });
});
