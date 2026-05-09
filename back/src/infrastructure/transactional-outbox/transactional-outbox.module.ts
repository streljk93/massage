import { Module, forwardRef } from '@nestjs/common';
import { DirectoryModule } from '../../modules/directory/directory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TransactionalOutboxCronService } from './transactional-outbox-cron.service';
import { TransactionalOutboxService } from './transactional-outbox.service';

@Module({
  imports: [PrismaModule, forwardRef(() => DirectoryModule)],
  providers: [TransactionalOutboxService, TransactionalOutboxCronService],
  exports: [TransactionalOutboxService],
})
export class TransactionalOutboxModule {}
