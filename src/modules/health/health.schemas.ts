import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("hotel-maximos-back"),
  timestamp: z.string().datetime(),
  traceId: z.string()
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
