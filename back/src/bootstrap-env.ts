import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Ранняя загрузка: при локальной разработке — корень монорепо (`../../.env` для JWT_SECRET и кредов инфраструктуры в одном месте с compose: POSTGRES_*, REDIS_PASSWORD, MINIO_ROOT_* и т.д.), затем `back/.env` (override).
 * Переменные суперадмина `ADMIN_MASTER_*` задаются только в `back/.env` (и в Docker для `back` через `env_file`).
 * В образе Docker только каталог приложения — монорепо-корня нет; переменные из окружения контейнера и `back/.env` при compose.
 * `ConfigModule.forRoot` дублирует загрузку — безопасно.
 */
const srcOrDistDir = __dirname;

const monoRootDotEnv = resolve(srcOrDistDir, '..', '..', '.env');
const monoGrandparentDir = dirname(monoRootDotEnv);
/** Не подхватывать `/.env` в одиночном приложении без монорепо (Docker). */
if (existsSync(monoRootDotEnv) && monoGrandparentDir !== resolve('/')) {
  loadEnv({ path: monoRootDotEnv });
}
const monoRootDotEnvLocal = resolve(srcOrDistDir, '..', '..', '.env.local');
if (
  existsSync(monoRootDotEnvLocal) &&
  dirname(monoRootDotEnvLocal) !== resolve('/')
) {
  loadEnv({ path: monoRootDotEnvLocal });
}
loadEnv({ path: resolve(srcOrDistDir, '..', '.env'), override: true });
loadEnv({ path: resolve(srcOrDistDir, '..', '.env.local'), override: true });
