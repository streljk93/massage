import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DirectoryService } from './application/directory.service';
import { SpecialistsDirectorySearchIndexReconcileCronService } from './application/specialists-directory-search-index-reconcile-cron.service';
import { MarketplaceListingEdgesIndexService } from './application/marketplace-listing-edges-index.service';
import { SpecialistOfferingEdgeLifecycleService } from './application/specialist-offering-edge-lifecycle.service';
import { DirectoryRepository } from './infrastructure/directory.repository';
import { DirectoryController } from './presentation/directory.controller';
import { OrganizationsController } from './presentation/organizations.controller';
import { SpecialistsController } from './presentation/specialists.controller';
import { PersonalizationModule } from '../personalization/personalization.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { JwtAccessOptionalGuard } from '../../common/guards';

@Module({
  imports: [
    forwardRef(() => PersonalizationModule),
    forwardRef(() => OrganizationsModule),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: { algorithm: 'HS256' as const },
      }),
    }),
  ],
  controllers: [
    SpecialistsController,
    OrganizationsController,
    DirectoryController,
  ],
  providers: [
    DirectoryService,
    DirectoryRepository,
    JwtAccessOptionalGuard,
    MarketplaceListingEdgesIndexService,
    SpecialistsDirectorySearchIndexReconcileCronService,
    SpecialistOfferingEdgeLifecycleService,
  ],
  exports: [
    DirectoryService,
    MarketplaceListingEdgesIndexService,
    SpecialistOfferingEdgeLifecycleService,
  ],
})
export class DirectoryModule {}
