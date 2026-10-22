import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  DASHBOARD_ROLES,
  Roles,
} from '../../common/decorators/roles.decorator.js';
import { ResolvedLocationDto, ResolveLocationDto } from './dto/location.dto.js';
import { LocationsService } from './locations.service.js';

const MINUTE_MS = 60_000;

@ApiTags('Admin: Locations')
@ApiBearerAuth()
@Roles(...DASHBOARD_ROLES)
@Controller('admin/locations')
export class AdminLocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  // Short links make the server call Google; keep that to a typing pace.
  @Throttle({ default: { limit: 60, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: 'Read the point in a Google Maps link or coordinates',
    description:
      'Short links (maps.app.goo.gl) are followed to the map. 400 with ' +
      'error "UnreadableLocation" or "LocationOutsideLibya" otherwise.',
  })
  resolve(@Body() dto: ResolveLocationDto): Promise<ResolvedLocationDto> {
    return this.locations.resolve(dto.link);
  }
}
