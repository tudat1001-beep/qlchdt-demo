import 'dotenv/config';
import { z } from 'zod';

export function loadConfig() {
  const config = z.object({
    DATABASE_URL: z.string().url(), APP_ORIGIN: z.string().url(),
    HOST: z.string().default('127.0.0.1'), PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  }).parse(process.env);
  return config;
}
