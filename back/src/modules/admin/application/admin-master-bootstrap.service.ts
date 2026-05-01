import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { PasswordHasher } from '../../auth/infrastructure/password-hasher';

function normalizeMasterEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Поднимает или обновляет пользователя с ролью `master` по переменным `ADMIN_MASTER_*`
 * (только в `back/.env` или env контейнера; см. `bootstrap-env`, `docker-compose` → `env_file`).
 */
@Injectable()
export class AdminMasterBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminMasterBootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async onModuleInit(): Promise<void> {
    const emailRaw = this.config.get<string>('adminMaster.email')?.trim() ?? '';
    const password =
      this.config.get<string>('adminMaster.password')?.trim() ?? '';
    const name =
      this.config.get<string>('adminMaster.name')?.trim() || 'Platform Admin';
    if (!emailRaw || !password) {
      this.logger.log(
        'ADMIN_MASTER_EMAIL / ADMIN_MASTER_PASSWORD не заданы — пропуск bootstrap суперадмина',
      );
      return;
    }
    const email = normalizeMasterEmail(emailRaw);
    const passwordHash = await this.passwordHasher.hash(password);
    const existing = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          passwordHash,
          platformRole: PlatformRole.master,
          isContentModerator: true,
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
        },
      });
      this.logger.log(
        `Суперадмин master обновлён (email=${email}), пароль и флаги синхронизированы с env`,
      );
      return;
    }
    await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        platformRole: PlatformRole.master,
        isContentModerator: true,
        emailVerifiedAt: new Date(),
      },
    });
    this.logger.log(`Создан пользователь суперадмина master (email=${email})`);
  }
}
