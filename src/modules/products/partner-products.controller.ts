import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { StoreMemberRole } from '../../generated/prisma/enums.js';
import {
  ImageWithThumbUpload,
  requireFile,
} from '../../storage/upload.decorators.js';
import {
  type StoreAccess,
  CurrentStore,
  StoreRoles,
} from '../stores/access/store-access.js';
import { StoreAccessGuard } from '../stores/access/store-access.guard.js';
import {
  CreateProductDto,
  ListProductsQueryDto,
  ProductDto,
  ProductListDto,
  UpdateProductDto,
} from './dto/products.dto.js';
import { ProductsService } from './products.service.js';

@ApiTags('Partner: Products')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@ApiParam({ name: 'storeId', type: String, format: 'uuid' })
@StoreRoles(StoreMemberRole.OWNER)
@Controller('partner/stores/:storeId/products')
export class PartnerProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: "The store's saved products" })
  list(
    @CurrentStore() store: StoreAccess,
    @Query() query: ListProductsQueryDto,
  ): Promise<ProductListDto> {
    return this.products.list(store.storeId, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a product',
    description: 'Then upload its photo with PUT /products/{productId}/image.',
  })
  create(
    @CurrentStore() store: StoreAccess,
    @Body() dto: CreateProductDto,
  ): Promise<ProductDto> {
    return this.products.create(store.storeId, dto);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'One product' })
  getProduct(
    @CurrentStore() store: StoreAccess,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<ProductDto> {
    return this.products.get(store.storeId, productId);
  }

  @Patch(':productId')
  @ApiOperation({ summary: 'Edit or archive a product' })
  update(
    @CurrentStore() store: StoreAccess,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDto> {
    return this.products.update(store.storeId, productId, dto);
  }

  @Put(':productId/image')
  @ImageWithThumbUpload()
  @ApiOperation({ summary: 'Upload the product photo and its thumbnail' })
  setImage(
    @CurrentStore() store: StoreAccess,
    @Param('productId', ParseUUIDPipe) productId: string,
    @UploadedFiles()
    files: { image?: Express.Multer.File[]; thumb?: Express.Multer.File[] },
  ): Promise<ProductDto> {
    return this.products.setImage(
      store.storeId,
      productId,
      requireFile(files?.image?.[0], 'image'),
      requireFile(files?.thumb?.[0], 'thumb'),
    );
  }
}
