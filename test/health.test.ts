import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("health endpoint", () => {
  it("returns api health status with trace id", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/health",
      headers: {
        "x-trace-id": "test-trace-id"
      }
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "hotel-maximos-back",
      traceId: "test-trace-id"
    });
  });
});
