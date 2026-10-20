import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import {
  AddMemberDto,
  CreateBranchDto,
  CreateStoreDto,
  ListStoresQueryDto,
  UpdateBranchDto,
  UpdateStoreDto,
} from './dto/store-requests.dto.js';
import {
  AddMemberResponseDto,
  BranchDto,
  CreateStoreResponseDto,
  StoreDetailDto,
  StoreListDto,
} from './dto/store-responses.dto.js';
import { StoresService } from './stores.service.js';

@ApiTags('Admin: Stores')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/stores')
export class AdminStoresController {
  constructor(private readonly stores: StoresService) {}

  @Get()
  @ApiOperation({ summary: 'List and search stores' })
  list(@Query() query: ListStoresQueryDto): Promise<StoreListDto> {
    return this.stores.list(query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a store with its branches and owner account',
    description:
      'Returns a temporary password for the owner, shown only once. ' +
      'If the phone already has a merchant account, it is linked instead.',
  })
  create(
    @Body() dto: CreateStoreDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<CreateStoreResponseDto> {
    return this.stores.create(dto, admin.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Store details with branches and staff' })
  getStore(@Param('id', ParseUUIDPipe) id: string): Promise<StoreDetailDto> {
    return this.stores.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit, disable or enable a store' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStoreDto,
  ): Promise<StoreDetailDto> {
    return this.stores.update(id, dto);
  }

  @Post(':id/branches')
  @ApiOperation({ summary: 'Add a branch' })
  addBranch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBranchDto,
  ): Promise<BranchDto> {
    return this.stores.addBranch(id, dto);
  }

  @Patch(':id/branches/:branchId')
  @ApiOperation({ summary: 'Edit, disable or enable a branch' })
  updateBranch(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchDto> {
    return this.stores.updateBranch(id, branchId, dto);
  }

  @Post(':id/members')
  @ApiOperation({
    summary: 'Add an owner or staff member',
    description:
      'Creates a merchant account with a temporary password (shown once), ' +
      'or links an existing merchant with the same phone.',
  })
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
  ): Promise<AddMemberResponseDto> {
    return this.stores.addMember(id, dto);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiOperation({
    summary: 'Remove someone from the store (keeps their account)',
  })
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.stores.removeMember(id, userId);
  }
}
