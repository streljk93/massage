import { Controller, Get } from '@nestjs/common';
import { HealthService } from '../application/health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): { status: string; service: string } {
    return this.healthService.getHealth();
  }
}
