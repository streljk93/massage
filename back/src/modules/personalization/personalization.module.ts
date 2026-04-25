import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DirectoryModule } from '../directory/directory.module';
import { JwtAccessOptionalGuard } from '../../common/guards';
import { PersonalizationCronService } from './application/personalization-cron.service';
import { PersonalizationService } from './application/personalization.service';
import { PersonalizationRepository } from './infrastructure/personalization.repository';
import { PersonalizationController } from './presentation/personalization.controller';

@Module({
  imports: [AuthModule, forwardRef(() => DirectoryModule)],
  controllers: [PersonalizationController],
  providers: [
    PersonalizationService,
    PersonalizationRepository,
    PersonalizationCronService,
    JwtAccessOptionalGuard,
  ],
  exports: [PersonalizationService, PersonalizationRepository],
})
export class PersonalizationModule {}
