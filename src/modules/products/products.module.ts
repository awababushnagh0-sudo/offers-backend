import { Module } from '@nestjs/common';
import { PartnerProductsController } from './partner-products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  controllers: [PartnerProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
