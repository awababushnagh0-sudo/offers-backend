import { BadRequestException } from '@nestjs/common';
import { LocationsService } from './locations.service.js';

const redirect = (location: string) =>
  new Response(null, { status: 302, headers: { location } });

const place =
  'https://www.google.com/maps/place/Some+Cafe/@32.80,13.10,15z/' +
  'data=!3m1!4b1!8m2!3d32.8872!4d13.1913';

describe('LocationsService', () => {
  const service = new LocationsService();
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, 'fetch');
  });
  afterEach(() => vi.restoreAllMocks());

  const errorCode = async (link: string) => {
    try {
      await service.resolve(link);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      return ((error as BadRequestException).getResponse() as { error: string })
        .error;
    }
    throw new Error('expected a failure');
  };

  it('reads full links without calling anyone', async () => {
    await expect(service.resolve(place)).resolves.toEqual({
      latitude: 32.8872,
      longitude: 13.1913,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('follows a short link to the map', async () => {
    fetchMock
      .mockResolvedValueOnce(redirect('https://maps.app.goo.gl/next'))
      .mockResolvedValueOnce(redirect(place));
    await expect(
      service.resolve('https://maps.app.goo.gl/AbC123'),
    ).resolves.toEqual({ latitude: 32.8872, longitude: 13.1913 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reads the map link a consent page carries', async () => {
    fetchMock.mockResolvedValueOnce(
      redirect(
        `https://consent.google.com/ml?continue=${encodeURIComponent(place)}`,
      ),
    );
    await expect(
      service.resolve('https://maps.app.goo.gl/AbC123'),
    ).resolves.toEqual({ latitude: 32.8872, longitude: 13.1913 });
  });

  it('never follows a redirect away from Google', async () => {
    fetchMock.mockResolvedValueOnce(redirect('https://evil.com/@32.88,13.19'));
    expect(await errorCode('https://maps.app.goo.gl/AbC123')).toBe(
      'UnreadableLocation',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('only calls out for short links', async () => {
    expect(await errorCode('https://example.com/somewhere')).toBe(
      'UnreadableLocation',
    );
    expect(await errorCode('http://maps.app.goo.gl/AbC123')).toBe(
      'UnreadableLocation',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives up on redirect loops and network errors', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(redirect('https://maps.app.goo.gl/again')),
    );
    expect(await errorCode('https://maps.app.goo.gl/AbC123')).toBe(
      'UnreadableLocation',
    );
    expect(fetchMock).toHaveBeenCalledTimes(5);

    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await errorCode('https://maps.app.goo.gl/AbC123')).toBe(
      'UnreadableLocation',
    );
  });

  it('refuses points outside Libya', async () => {
    expect(await errorCode('48.85, 2.35')).toBe('LocationOutsideLibya');
  });
});
