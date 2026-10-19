import { Module } from '@nestjs/common';
import { BusinessProductsController } from './business-products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  controllers: [BusinessProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
