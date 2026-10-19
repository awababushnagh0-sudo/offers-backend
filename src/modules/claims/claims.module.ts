import { Module } from '@nestjs/common';
import { BusinessClaimsController } from './business-claims.controller.js';
import { BusinessClaimsService } from './business-claims.service.js';
import { ClaimsExpiryService } from './claims-expiry.service.js';
import { ClaimsService } from './claims.service.js';
import { CustomerClaimsController } from './customer-claims.controller.js';

@Module({
  controllers: [CustomerClaimsController, BusinessClaimsController],
  providers: [ClaimsService, BusinessClaimsService, ClaimsExpiryService],
})
export class ClaimsModule {}
