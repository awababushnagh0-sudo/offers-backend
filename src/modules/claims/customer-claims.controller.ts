import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { ClaimsService, MAX_ACTIVE_RESERVATIONS } from './claims.service.js';
import {
  CustomerClaimDto,
  CustomerClaimListDto,
  ListMyClaimsQueryDto,
} from './dto/customer-claims.dto.js';

@ApiTags('Claims')
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
@Controller()
export class CustomerClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Post('offers/:offerId/claim')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Claim an offer',
    description:
      'LIMITED offers reserve one piece until `expiresAt` (the claim window). ' +
      `A customer can hold ${MAX_ACTIVE_RESERVATIONS} reservations at once; ` +
      'every 3rd missed pickup blocks claiming for 7 days. ' +
      'UNLIMITED offers just give a code valid until the offer ends.',
  })
  claim(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<CustomerClaimDto> {
    return this.claims.claim(user.id, offerId);
  }

  @Get('me/claims')
  @ApiOperation({ summary: 'My claims (newest first, or active ones)' })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListMyClaimsQueryDto,
  ): Promise<CustomerClaimListDto> {
    return this.claims.list(user.id, query);
  }

  @Get('me/claims/:claimId')
  @ApiOperation({ summary: 'One claim, with the code for the QR' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('claimId', ParseUUIDPipe) claimId: string,
  ): Promise<CustomerClaimDto> {
    return this.claims.get(user.id, claimId);
  }

  @Post('me/claims/:claimId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Cancel a reservation I can't pick up",
    description: 'Gives the piece back. Cancelling in time is not a no-show.',
  })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('claimId', ParseUUIDPipe) claimId: string,
  ): Promise<CustomerClaimDto> {
    return this.claims.cancel(user.id, claimId);
  }
}
