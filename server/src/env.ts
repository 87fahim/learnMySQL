import { z } from 'zod'

const EnvSchema = z.object({
  PORT: z.coerce.number().positive().default(4000),
  DB_HOST: z.string().trim().default('127.0.0.1'),
  DB_PORT: z.coerce.number().positive().default(3306),
  DB_USER: z.string().trim().default('root'),
  DB_PASSWORD: z.string().default('root'),
  DB_NAME: z.string().trim().default('mysql'),
  CORS_ORIGIN: z.string().optional(),
  QUERY_TIMEOUT_MS: z.coerce.number().positive().max(120_000).default(30_000),
  MAX_ROWS: z.coerce.number().positive().max(50_000).default(5000),
})

export type Env = z.infer<typeof EnvSchema>

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid environment: ${msg}`)
  }
  return parsed.data
}
