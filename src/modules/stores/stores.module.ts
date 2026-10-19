import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OffersModule } from '../offers/offers.module.js';
import { AdminStoresController } from './admin-stores.controller.js';
import { BusinessStoresController } from './business-stores.controller.js';
import { MerchantAccountsService } from './merchant-accounts.service.js';
import { PublicStoresController } from './public-stores.controller.js';
import { PublicStoresService } from './public-stores.service.js';
import { StoreStatsService } from './store-stats.service.js';
import { StoresService } from './stores.service.js';

@Module({
  imports: [AuthModule, OffersModule],
  controllers: [
    PublicStoresController,
    BusinessStoresController,
    AdminStoresController,
  ],
  providers: [
    StoresService,
    PublicStoresService,
    MerchantAccountsService,
    StoreStatsService,
  ],
})
export class StoresModule {}
