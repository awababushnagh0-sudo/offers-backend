import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

const MAX_HEAP_BYTES = 300 * 1024 * 1024;

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check that the API is up and healthy' })
  check() {
    // The database check is added here once Postgres is set up.
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', MAX_HEAP_BYTES),
    ]);
  }
}
