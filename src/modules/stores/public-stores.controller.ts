import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { LocationQueryDto } from '../offers/dto/public-offers.dto.js';
import { toLocation } from '../offers/public-offers.service.js';
import { FollowedStoreDto, PublicStoreDto } from './dto/public-stores.dto.js';
import { PublicStoresService } from './public-stores.service.js';

@ApiTags('Stores')
@Controller()
export class PublicStoresController {
  constructor(private readonly stores: PublicStoresService) {}

  @Public()
  @Get('stores/:storeId')
  @ApiOperation({
    summary: 'Store page with branches and live offers',
    description: 'With a customer token, `isFollowing` is filled in.',
  })
  getStore(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: LocationQueryDto,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<PublicStoreDto> {
    return this.stores.get(storeId, toLocation(query.lat, query.lng), user);
  }

  @Post('stores/:storeId/follow')
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({ summary: 'Follow a store to hear about its new offers' })
  follow(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.stores.follow(user.id, storeId);
  }

  @Delete('stores/:storeId/follow')
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({ summary: 'Unfollow a store' })
  unfollow(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.stores.unfollow(user.id, storeId);
  }

  @Get('me/follows')
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stores I follow' })
  followed(@CurrentUser() user: AuthUser): Promise<FollowedStoreDto[]> {
    return this.stores.followed(user.id);
  }
}
