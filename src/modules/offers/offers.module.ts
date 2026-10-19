import { Module } from '@nestjs/common';
import { AdminOffersController } from './admin-offers.controller.js';
import { AdminOffersService } from './admin-offers.service.js';
import { BusinessOffersController } from './business-offers.controller.js';
import { BusinessOffersService } from './business-offers.service.js';

@Module({
  controllers: [AdminOffersController, BusinessOffersController],
  providers: [AdminOffersService, BusinessOffersService],
})
export class OffersModule {}
