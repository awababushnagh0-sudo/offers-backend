import { Module } from '@nestjs/common';
import { AppConfigController } from './app-config.controller.js';

@Module({ controllers: [AppConfigController] })
export class AppConfigModule {}
