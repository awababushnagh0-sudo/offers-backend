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
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { AdminOffersService } from './admin-offers.service.js';
import {
  AdminOfferDto,
  ListOffersQueryDto,
  OfferListDto,
} from './dto/admin-offers.dto.js';

@ApiTags('Admin: Offers')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/offers')
export class AdminOffersController {
  constructor(private readonly offers: AdminOffersService) {}

  @Get()
  @ApiOperation({ summary: 'List offers across all stores' })
  list(@Query() query: ListOffersQueryDto): Promise<OfferListDto> {
    return this.offers.list(query);
  }

  @Post(':id/remove')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Take an offer down',
    description: 'Hides it from customers and cancels active reservations.',
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<AdminOfferDto> {
    return this.offers.remove(id);
  }
}
