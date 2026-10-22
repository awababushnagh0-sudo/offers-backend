import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { StoreMemberRole } from '../../generated/prisma/enums.js';
import {
  type StoreAccess,
  CurrentStore,
  StoreRoles,
} from '../stores/access/store-access.js';
import { StoreAccessGuard } from '../stores/access/store-access.guard.js';
import { PartnerOffersService } from './partner-offers.service.js';
import {
  PartnerOfferDto,
  PartnerOfferListDto,
  CreateOfferDto,
  ListPartnerOffersQueryDto,
  UpdateOfferDto,
} from './dto/partner-offers.dto.js';

@ApiTags('Partner: Offers')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@ApiParam({ name: 'storeId', type: String, format: 'uuid' })
@Controller('partner/stores/:storeId/offers')
export class PartnerOffersController {
  constructor(private readonly offers: PartnerOffersService) {}

  @Get()
  @ApiOperation({ summary: "The store's offers with claim counts" })
  list(
    @CurrentStore() store: StoreAccess,
    @Query() query: ListPartnerOffersQueryDto,
  ): Promise<PartnerOfferListDto> {
    return this.offers.list(store.storeId, query);
  }

  @Post()
  @StoreRoles(StoreMemberRole.OWNER)
  @ApiOperation({
    summary: 'Post an offer from a product (owner)',
    description:
      'To repost an old offer, post again with the same productId: the photo and details are reused.',
  })
  create(
    @CurrentStore() store: StoreAccess,
    @Body() dto: CreateOfferDto,
  ): Promise<PartnerOfferDto> {
    return this.offers.create(store, dto);
  }

  @Get(':offerId')
  @ApiOperation({ summary: 'One offer with claim counts' })
  getOffer(
    @CurrentStore() store: StoreAccess,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ): Promise<PartnerOfferDto> {
    return this.offers.get(store.storeId, offerId);
  }

  @Patch(':offerId')
  @StoreRoles(StoreMemberRole.OWNER)
  @ApiOperation({ summary: 'Edit the title, description or end time (owner)' })
  update(
    @CurrentStore() store: StoreAccess,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: UpdateOfferDto,
  ): Promise<PartnerOfferDto> {
    return this.offers.update(store.storeId, offerId, dto);
  }

  @Post(':offerId/pause')
  @HttpCode(HttpStatus.OK)
  @StoreRoles(StoreMemberRole.OWNER)
  @ApiOperation({
    summary: 'Pause: hide from customers (owner)',
    description: 'Existing reservations can still be redeemed.',
  })
  pause(
    @CurrentStore() store: StoreAccess,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ): Promise<PartnerOfferDto> {
    return this.offers.pause(store.storeId, offerId);
  }

  @Post(':offerId/resume')
  @HttpCode(HttpStatus.OK)
  @StoreRoles(StoreMemberRole.OWNER)
  @ApiOperation({ summary: 'Resume a paused offer (owner)' })
  resume(
    @CurrentStore() store: StoreAccess,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ): Promise<PartnerOfferDto> {
    return this.offers.resume(store, offerId);
  }

  @Post(':offerId/end')
  @HttpCode(HttpStatus.OK)
  @StoreRoles(StoreMemberRole.OWNER)
  @ApiOperation({
    summary: 'End an offer for good (owner)',
    description: 'Existing reservations can still be redeemed.',
  })
  end(
    @CurrentStore() store: StoreAccess,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ): Promise<PartnerOfferDto> {
    return this.offers.end(store.storeId, offerId);
  }
}
