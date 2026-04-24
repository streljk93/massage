import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DirectoryModule } from '../directory/directory.module';
import { FavoritesService } from './application/favorites.service';
import { FavoritesRepository } from './infrastructure/favorites.repository';
import { FavoritesController } from './presentation/favorites.controller';

@Module({
  imports: [AuthModule, DirectoryModule],
  controllers: [FavoritesController],
  providers: [FavoritesService, FavoritesRepository],
})
export class FavoritesModule {}
