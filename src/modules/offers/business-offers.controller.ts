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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StoreMemberRole } from '../../generated/prisma/enums.js';
import {
  type StoreAccess,
  CurrentStore,
  StoreRoles,
} from '../stores/access/store-access.js';
import { StoreAccessGuard } from '../stores/access/store-access.guard.js';
import { BusinessOffersService } from './business-offers.service.js';
import {
  BusinessOfferDto,
  BusinessOfferListDto,
  CreateOfferDto,
  ListBusinessOffersQueryDto,
  UpdateOfferDto,
} from './dto/business-offers.dto.js';

@ApiTags('Business: Offers')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('business/stores/:storeId/offers')
export class BusinessOffersController {
  constructor(private readonly offers: BusinessOffersService) {}

  @Get()
  @ApiOperation({ summary: "The store's offers with claim counts" })
  list(
    @CurrentStore() store: StoreAccess,
    @Query() query: ListBusinessOffersQueryDto,
  ): Promise<BusinessOfferListDto> {
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
  ): Promise<BusinessOfferDto> {
    return this.offers.create(store, dto);
  }

  @Get(':offerId')
  @ApiOperation({ summary: 'One offer with claim counts' })
  get(
    @CurrentStore() store: StoreAccess,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ): Promise<BusinessOfferDto> {
    return this.offers.get(store.storeId, offerId);
  }

  @Patch(':offerId')
  @StoreRoles(StoreMemberRole.OWNER)
  @ApiOperation({ summary: 'Edit the title, description or end time (owner)' })
  update(
    @CurrentStore() store: StoreAccess,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: UpdateOfferDto,
  ): Promise<BusinessOfferDto> {
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
  ): Promise<BusinessOfferDto> {
    return this.offers.pause(store.storeId, offerId);
  }

  @Post(':offerId/resume')
  @HttpCode(HttpStatus.OK)
  @StoreRoles(StoreMemberRole.OWNER)
  @ApiOperation({ summary: 'Resume a paused offer (owner)' })
  resume(
    @CurrentStore() store: StoreAccess,
    @Param('offerId', ParseUUIDPipe) offerId: string,
  ): Promise<BusinessOfferDto> {
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
  ): Promise<BusinessOfferDto> {
    return this.offers.end(store.storeId, offerId);
  }
}
