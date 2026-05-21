import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter pelo menos 32 caracteres."),
  JWT_EXPIRES_IN: z.string().default("15m"),
  CORS_ALLOWED_ORIGINS: z.string().default("").transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  ),
  UPLOADS_DIR: z.string().default("storage"),
  COMPROVANTE_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024)
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const nodeEnv = source.NODE_ENV ?? "development";
  const localCorsOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ].join(",");

  const corsDefaults =
    source.CORS_ALLOWED_ORIGINS === undefined && nodeEnv !== "production"
      ? {
          CORS_ALLOWED_ORIGINS: localCorsOrigins
        }
      : {};

  const testDefaults =
    source.NODE_ENV === "test"
      ? {
          DATABASE_URL: "postgresql://hotel_maximos:hotel_maximos@localhost:5432/hotel_maximos",
          JWT_SECRET: "test-secret-with-at-least-thirty-two-characters"
        }
      : {};

  return envSchema.parse({
    ...corsDefaults,
    ...testDefaults,
    ...source
  });
}

export const env = loadEnv();
