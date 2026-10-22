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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  type StoreAccess,
  CurrentStore,
} from '../stores/access/store-access.js';
import { StoreAccessGuard } from '../stores/access/store-access.guard.js';
import { PartnerClaimsService } from './partner-claims.service.js';
import {
  PartnerClaimDto,
  PartnerClaimListDto,
  ListPartnerClaimsQueryDto,
  RedeemClaimDto,
} from './dto/partner-claims.dto.js';

// Owners and staff can both use these: redeeming is the counter's job.
@ApiTags('Partner: Claims')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@ApiParam({ name: 'storeId', type: String, format: 'uuid' })
@Controller('partner/stores/:storeId/claims')
export class PartnerClaimsController {
  constructor(private readonly claims: PartnerClaimsService) {}

  @Get()
  @ApiOperation({
    summary: 'Claims for this store (default: reserved, soonest expiry first)',
  })
  list(
    @CurrentStore() store: StoreAccess,
    @Query() query: ListPartnerClaimsQueryDto,
  ): Promise<PartnerClaimListDto> {
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
  ): Promise<PartnerClaimDto> {
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
  ): Promise<PartnerClaimDto> {
    return this.claims.redeem(store, dto);
  }
}
