import { config } from 'dotenv';
import { resolve } from 'node:path';

/** Load project `.env` before `validateEnv` runs (e2e bootstraps `AppModule`). */
config({ path: resolve(__dirname, '../.env') });
