import { Module } from '@nestjs/common';
import { AdminOffersController } from './admin-offers.controller.js';
import { AdminOffersService } from './admin-offers.service.js';
import { BusinessOffersController } from './business-offers.controller.js';
import { BusinessOffersService } from './business-offers.service.js';
import { PublicOffersController } from './public-offers.controller.js';
import { PublicOffersService } from './public-offers.service.js';

@Module({
  controllers: [
    PublicOffersController,
    BusinessOffersController,
    AdminOffersController,
  ],
  providers: [PublicOffersService, BusinessOffersService, AdminOffersService],
  exports: [PublicOffersService],
})
export class OffersModule {}
