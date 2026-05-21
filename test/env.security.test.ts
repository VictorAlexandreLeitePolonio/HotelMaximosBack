import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";

const requiredEnv = {
  DATABASE_URL: "postgresql://hotel_maximos:hotel_maximos@localhost:5432/hotel_maximos",
  JWT_SECRET: "test-secret-with-at-least-thirty-two-characters"
};

describe("environment security defaults", () => {
  it("keeps production CORS closed unless origins are explicitly configured", () => {
    const env = loadEnv({
      ...requiredEnv,
      NODE_ENV: "production"
    });

    expect(env.CORS_ALLOWED_ORIGINS).toEqual([]);
  });

  it("allows only explicit production CORS origins", () => {
    const env = loadEnv({
      ...requiredEnv,
      NODE_ENV: "production",
      CORS_ALLOWED_ORIGINS: "https://app.hotelmaximos.com.br, https://admin.hotelmaximos.com.br"
    });

    expect(env.CORS_ALLOWED_ORIGINS).toEqual([
      "https://app.hotelmaximos.com.br",
      "https://admin.hotelmaximos.com.br"
    ]);
  });

  it("uses local-only CORS defaults outside production", () => {
    const env = loadEnv({
      ...requiredEnv,
      NODE_ENV: "development"
    });

    expect(env.CORS_ALLOWED_ORIGINS).toContain("http://localhost:3000");
    expect(env.CORS_ALLOWED_ORIGINS).toContain("http://127.0.0.1:5173");
  });
});
