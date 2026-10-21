import { Module } from '@nestjs/common';
import { AdminLocationsController } from './admin-locations.controller.js';
import { LocationsService } from './locations.service.js';

@Module({
  controllers: [AdminLocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}
