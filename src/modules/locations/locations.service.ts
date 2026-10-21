import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { LatLng } from '../../common/utils/geo.js';
import {
  isGoogleMapsHost,
  isInLibya,
  isShortMapsLink,
  parseLocation,
} from '../../common/utils/location.js';
import type { ResolvedLocationDto } from './dto/location.dto.js';

/** Short links take one or two hops to the map; more means a loop. */
const MAX_REDIRECTS = 5;
const REDIRECT_TIMEOUT_MS = 5_000;

/** Reads branch locations from what the team pastes. */
@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  /**
   * The point in a Google Maps link or plain coordinates. Short links are
   * followed through their redirects, only ever to Google, until a link
   * with coordinates appears.
   */
  async resolve(link: string): Promise<ResolvedLocationDto> {
    const point = parseLocation(link) ?? (await this.followShortLink(link));
    if (!point) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'UnreadableLocation',
        message: "Couldn't read a location from this link",
      });
    }
    if (!isInLibya(point)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'LocationOutsideLibya',
        message: 'This location is outside Libya',
      });
    }
    return point;
  }

  private async followShortLink(link: string): Promise<LatLng | null> {
    let url = toUrl(link.trim());
    if (!url || url.protocol !== 'https:' || !isShortMapsLink(url)) {
      return null;
    }
    for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
      let response: Response;
      try {
        response = await fetch(url, {
          redirect: 'manual',
          signal: AbortSignal.timeout(REDIRECT_TIMEOUT_MS),
        });
      } catch (error) {
        this.logger.warn(
          `Couldn't follow a ${url.hostname} link: ${String(error)}`,
        );
        return null;
      }
      await response.body?.cancel();
      const next = toUrl(response.headers.get('location') ?? '', url);
      if (!next || next.protocol !== 'https:' || !isGoogleMapsHost(next)) {
        return null;
      }
      // Also finds the map link that a consent page carries in `continue`.
      const point = parseLocation(next.href);
      if (point) return point;
      url = next;
    }
    return null;
  }
}

function toUrl(text: string, base?: URL): URL | null {
  if (!text) return null;
  try {
    return new URL(text, base);
  } catch {
    return null;
  }
}
