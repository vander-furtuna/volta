import { z } from "zod";

/**
 * Validated environment variables. Empty values are allowed so the app runs in demo mode;
 * call `requireEnv` wherever a real integration is mandatory.
 */
const envSchema = z.object({
  APP_URL: z.string().default("http://localhost:3000"),
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  CW_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  CW_CLIENT_ID: z.string().default(""),
  CW_REDIRECT_URI: z.string().default("http://localhost:3000/api/cw/oauth/callback"),
  CW_WEBHOOK_TOKEN: z.string().default(""),
  SUPABASE_URL: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  TOKEN_ENCRYPTION_KEY: z.string().default(""),
  SESSION_SECRET: z.string().default(""),
  CRON_SECRET: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

type StringEnvKey = { [K in keyof Env]: Env[K] extends string ? K : never }[keyof Env];

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return envSchema.parse(source);
}

export function requireEnv(name: StringEnvKey, env: Env = readEnv()): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set. See .env.example.`);
  }
  return value;
}
