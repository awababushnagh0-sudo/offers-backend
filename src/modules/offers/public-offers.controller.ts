import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import {
  BrowseOffersQueryDto,
  LocationQueryDto,
  PublicOfferDetailDto,
  PublicOfferListDto,
} from './dto/public-offers.dto.js';
import { PublicOffersService, toLocation } from './public-offers.service.js';

@ApiTags('Offers')
@Public()
@Controller('offers')
export class PublicOffersController {
  constructor(private readonly offers: PublicOffersService) {}

  @Get()
  @ApiOperation({
    summary: 'Browse live offers',
    description:
      'Send lat/lng to get distances, filter by radius and sort by nearest.',
  })
  browse(@Query() query: BrowseOffersQueryDto): Promise<PublicOfferListDto> {
    return this.offers.browse(query);
  }

  @Get(':offerId')
  @ApiOperation({
    summary: 'Offer details with all its branches',
    description:
      'Works without login. With a customer token, `myActiveClaimId` shows their reservation.',
  })
  get(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Query() query: LocationQueryDto,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<PublicOfferDetailDto> {
    return this.offers.get(offerId, toLocation(query.lat, query.lng), user?.id);
  }
}
