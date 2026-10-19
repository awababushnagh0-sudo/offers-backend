import { Module } from '@nestjs/common';
import { AdminOffersController } from './admin-offers.controller.js';
import { AdminOffersService } from './admin-offers.service.js';

@Module({
  controllers: [AdminOffersController],
  providers: [AdminOffersService],
})
export class OffersModule {}
