import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter pelo menos 32 caracteres."),
  JWT_EXPIRES_IN: z.string().default("15m")
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const testDefaults =
    source.NODE_ENV === "test"
      ? {
          DATABASE_URL: "postgresql://hotel_maximos:hotel_maximos@localhost:5432/hotel_maximos",
          JWT_SECRET: "test-secret-with-at-least-thirty-two-characters"
        }
      : {};

  return envSchema.parse({
    ...testDefaults,
    ...source
  });
}

export const env = loadEnv();
