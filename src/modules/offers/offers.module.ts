import { Module } from '@nestjs/common';
import { AdminOffersController } from './admin-offers.controller.js';
import { AdminOffersService } from './admin-offers.service.js';
import { PartnerOffersController } from './partner-offers.controller.js';
import { PartnerOffersService } from './partner-offers.service.js';
import { PublicOffersController } from './public-offers.controller.js';
import { PublicOffersService } from './public-offers.service.js';

@Module({
  controllers: [
    PublicOffersController,
    PartnerOffersController,
    AdminOffersController,
  ],
  providers: [PublicOffersService, PartnerOffersService, AdminOffersService],
  exports: [PublicOffersService],
})
export class OffersModule {}
