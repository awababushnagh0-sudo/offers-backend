import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type StoreAccess,
  CurrentStore,
} from '../stores/access/store-access.js';
import { StoreAccessGuard } from '../stores/access/store-access.guard.js';
import { BusinessClaimsService } from './business-claims.service.js';
import {
  BusinessClaimDto,
  BusinessClaimListDto,
  ListBusinessClaimsQueryDto,
  RedeemClaimDto,
} from './dto/business-claims.dto.js';

// Owners and staff can both use these: redeeming is the counter's job.
@ApiTags('Business: Claims')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('business/stores/:storeId/claims')
export class BusinessClaimsController {
  constructor(private readonly claims: BusinessClaimsService) {}

  @Get()
  @ApiOperation({
    summary: 'Claims for this store (default: reserved, soonest expiry first)',
  })
  list(
    @CurrentStore() store: StoreAccess,
    @Query() query: ListBusinessClaimsQueryDto,
  ): Promise<BusinessClaimListDto> {
    return this.claims.list(store, query);
  }

  @Get('code/:code')
  @ApiOperation({
    summary: 'Look up a scanned code before redeeming it',
    description: '`canRedeem` and `problem` say whether it can be redeemed.',
  })
  lookup(
    @CurrentStore() store: StoreAccess,
    @Param('code') code: string,
  ): Promise<BusinessClaimDto> {
    return this.claims.lookup(store, code);
  }

  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Redeem a claim at the counter',
    description:
      'Fails with 409 if it was already redeemed, expired or cancelled.',
  })
  redeem(
    @CurrentStore() store: StoreAccess,
    @Body() dto: RedeemClaimDto,
  ): Promise<BusinessClaimDto> {
    return this.claims.redeem(store, dto);
  }
}
