import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AddressPersistenceService } from './application/address-persistence.service';
import { AddressResolutionService } from './application/address-resolution.service';
import { AddressProviderRegistry } from './infrastructure/address-provider-registry.service';
import { GeoapifyAddressHttpService } from './infrastructure/geoapify-address.http.service';
import { LocationIqAddressHttpService } from './infrastructure/locationiq-address.http.service';
import { NominatimAddressHttpService } from './infrastructure/nominatim-address.http.service';
import { OpenCageAddressHttpService } from './infrastructure/opencage-address.http.service';
import { AddressController } from './presentation/address.controller';

@Module({
  imports: [
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
  controllers: [AddressController],
  providers: [
    LocationIqAddressHttpService,
    OpenCageAddressHttpService,
    GeoapifyAddressHttpService,
    NominatimAddressHttpService,
    AddressProviderRegistry,
    AddressResolutionService,
    AddressPersistenceService,
  ],
  exports: [AddressResolutionService, AddressPersistenceService],
})
export class AddressModule {}
