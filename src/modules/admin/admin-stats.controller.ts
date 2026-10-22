import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DASHBOARD_ROLES,
  Roles,
} from '../../common/decorators/roles.decorator.js';
import { AdminStatsService } from './admin-stats.service.js';
import { AdminStatsDto } from './dto/admin-stats.dto.js';

@ApiTags('Admin: Stats')
@ApiBearerAuth()
@Roles(...DASHBOARD_ROLES)
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get()
  @ApiOperation({ summary: 'Headline numbers for the dashboard' })
  getStats(): Promise<AdminStatsDto> {
    return this.stats.get();
  }
}
