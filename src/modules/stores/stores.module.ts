import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminStoresController } from './admin-stores.controller.js';
import { BusinessStoresController } from './business-stores.controller.js';
import { MerchantAccountsService } from './merchant-accounts.service.js';
import { StoreStatsService } from './store-stats.service.js';
import { StoresService } from './stores.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminStoresController, BusinessStoresController],
  providers: [StoresService, MerchantAccountsService, StoreStatsService],
})
export class StoresModule {}
