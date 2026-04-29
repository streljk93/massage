import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

/**
 * Ранняя загрузка `back/.env` до статических декораторов модулей (например условный BullMQ).
 * `ConfigModule.forRoot` дублирует загрузку — безопасно.
 */
const srcOrDistDir = __dirname;
loadEnv({ path: resolve(srcOrDistDir, '..', '.env') });
loadEnv({ path: resolve(srcOrDistDir, '..', '.env.local'), override: true });
