import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth(): { status: string; service: string } {
    return { status: 'ok', service: 'back' };
  }
}
