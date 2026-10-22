import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import type { Env } from '../../config/env.validation.js';
import { AppConfigDto } from './dto/app-config.dto.js';

@ApiTags('App config')
@Public()
@Controller('app-config')
export class AppConfigController {
  constructor(private readonly config: ConfigService<Env, true>) {}

  @Get()
  @ApiOperation({
    summary: 'Settings the apps read on startup (minimum versions)',
  })
  getAppConfig(): AppConfigDto {
    return {
      partner: {
        minVersion: this.config.get('PARTNER_APP_MIN_VERSION', {
          infer: true,
        }),
      },
      customer: {
        minVersion: this.config.get('CUSTOMER_APP_MIN_VERSION', {
          infer: true,
        }),
      },
      admin: {
        minVersion: this.config.get('ADMIN_APP_MIN_VERSION', { infer: true }),
      },
    };
  }
}
