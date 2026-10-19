import { Module } from '@nestjs/common';
import { BusinessClaimsController } from './business-claims.controller.js';
import { BusinessClaimsService } from './business-claims.service.js';

@Module({
  controllers: [BusinessClaimsController],
  providers: [BusinessClaimsService],
})
export class ClaimsModule {}
