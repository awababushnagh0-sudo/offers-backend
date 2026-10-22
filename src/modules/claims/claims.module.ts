import { Module } from '@nestjs/common';
import { PartnerClaimsController } from './partner-claims.controller.js';
import { PartnerClaimsService } from './partner-claims.service.js';
import { ClaimsExpiryService } from './claims-expiry.service.js';
import { ClaimsService } from './claims.service.js';
import { CustomerClaimsController } from './customer-claims.controller.js';

@Module({
  controllers: [CustomerClaimsController, PartnerClaimsController],
  providers: [ClaimsService, PartnerClaimsService, ClaimsExpiryService],
})
export class ClaimsModule {}
