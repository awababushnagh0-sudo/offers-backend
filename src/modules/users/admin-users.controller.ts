import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import {
  AdminUserDto,
  ListUsersQueryDto,
  ResetPasswordResponseDto,
  SetUserStatusDto,
  UserListDto,
} from './dto/admin-users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Admin: Users')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List and search users' })
  list(@Query() query: ListUsersQueryDto): Promise<UserListDto> {
    return this.users.list(query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Disable or enable an account' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserStatusDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<AdminUserDto> {
    return this.users.setStatus(id, dto.isActive, admin.id);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Give a merchant/admin a new temporary password',
    description: 'Logs them out everywhere. The password is shown only once.',
  })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResetPasswordResponseDto> {
    return this.users.resetPassword(id);
  }
}
