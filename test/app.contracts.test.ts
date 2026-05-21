import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("app contracts hardening", () => {
  it("echoes the trace id header and exposes it for browser clients", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/health",
      headers: {
        origin: "http://localhost:3000",
        "x-trace-id": "qa-trace-id"
      }
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-trace-id"]).toBe("qa-trace-id");
    expect(response.headers["access-control-expose-headers"]).toContain("x-trace-id");
  });

  it("does not grant credentialed CORS access to untrusted origins", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/health",
      headers: {
        origin: "https://malicious.example",
        "x-trace-id": "blocked-origin-trace-id"
      }
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(response.headers["x-trace-id"]).toBe("blocked-origin-trace-id");
  });

  it("documents bearer authentication only on protected api routes", async () => {
    const app = await buildApp();

    await app.ready();

    const spec = app.swagger() as {
      components?: {
        securitySchemes?: Record<string, unknown>;
      };
      paths?: Record<
        string,
        Record<string, { security?: Array<Record<string, string[]>> | undefined }>
      >;
    };

    await app.close();

    expect(spec.components?.securitySchemes?.bearerAuth).toBeDefined();
    expect(spec.paths?.["/api/auth/login"]?.post?.security).toBeUndefined();
    expect(spec.paths?.["/api/auth/password"]?.patch?.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.paths?.["/api/dashboards/financeiro"]?.get?.security).toEqual([{ bearerAuth: [] }]);
  });
});
