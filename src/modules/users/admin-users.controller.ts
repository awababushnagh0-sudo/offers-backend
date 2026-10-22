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
  CreateDashboardUserDto,
  CreatedDashboardUserDto,
  ListTeamQueryDto,
  ListUsersQueryDto,
  ResetPasswordResponseDto,
  SetUserStatusDto,
  UpdateDashboardUserDto,
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

  @Get('team')
  @ApiOperation({ summary: 'List and search our team: admins and editors' })
  listTeam(@Query() query: ListTeamQueryDto): Promise<UserListDto> {
    return this.users.listTeam(query);
  }

  @Post()
  @ApiOperation({
    summary: 'Add an admin or editor to the dashboard',
    description:
      'Their temporary password is shown only once; they must change it on ' +
      'their first login.',
  })
  create(
    @Body() dto: CreateDashboardUserDto,
  ): Promise<CreatedDashboardUserDto> {
    return this.users.createDashboardUser(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One user' })
  getUser(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserDto> {
    return this.users.get(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Rename an admin or editor, or change their role',
    description: 'Admins cannot change their own role.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDashboardUserDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<AdminUserDto> {
    return this.users.updateDashboardUser(id, dto, admin.id);
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
