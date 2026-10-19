import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Put,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StoreMemberRole } from '../../generated/prisma/enums.js';
import { ImageUpload, requireFile } from '../../storage/upload.decorators.js';
import {
  type StoreAccess,
  CurrentStore,
  StoreRoles,
} from './access/store-access.js';
import { StoreAccessGuard } from './access/store-access.guard.js';
import {
  StoreImageKind,
  UpdateBranchDto,
  UpdateStoreProfileDto,
} from './dto/store-requests.dto.js';
import { StoreStatsDto } from './dto/store-stats.dto.js';
import { BranchDto, StoreDetailDto } from './dto/store-responses.dto.js';
import { StoreStatsService } from './store-stats.service.js';
import { StoresService } from './stores.service.js';

@ApiTags('Business: Store')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('business/stores/:storeId')
export class BusinessStoresController {
  constructor(
    private readonly stores: StoresService,
    private readonly stats: StoreStatsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'My store with its branches and staff' })
  get(@CurrentStore() store: StoreAccess): Promise<StoreDetailDto> {
    return this.stores.get(store.storeId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Claims, redemptions and top offers' })
  getStats(@CurrentStore() store: StoreAccess): Promise<StoreStatsDto> {
    return this.stats.get(store.storeId);
  }

  @Patch()
  @StoreRoles(StoreMemberRole.OWNER)
  @ApiOperation({ summary: 'Edit description and contact details (owner)' })
  updateProfile(
    @CurrentStore() store: StoreAccess,
    @Body() dto: UpdateStoreProfileDto,
  ): Promise<StoreDetailDto> {
    return this.stores.update(store.storeId, dto);
  }

  @Put('images/:kind')
  @StoreRoles(StoreMemberRole.OWNER)
  @ImageUpload()
  @ApiOperation({ summary: 'Upload the store logo or cover photo (owner)' })
  setImage(
    @CurrentStore() store: StoreAccess,
    @Param('kind', new ParseEnumPipe(StoreImageKind)) kind: StoreImageKind,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<StoreDetailDto> {
    return this.stores.setImage(
      store.storeId,
      kind,
      requireFile(file, 'image'),
    );
  }

  @Patch('branches/:branchId')
  @StoreRoles(StoreMemberRole.OWNER)
  @ApiOperation({ summary: 'Edit a branch, e.g. opening hours (owner)' })
  updateBranch(
    @CurrentStore() store: StoreAccess,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchDto> {
    return this.stores.updateBranch(store.storeId, branchId, dto);
  }
}
