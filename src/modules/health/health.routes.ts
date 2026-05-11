import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { errorResponseSchema } from "../../shared/errors/error-response.schema.js";
import { healthResponseSchema } from "./health.schemas.js";

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Verifica se a API está respondendo.",
        response: {
          200: healthResponseSchema,
          500: errorResponseSchema
        }
      }
    },
    async (request) => {
      return {
        status: "ok",
        service: "hotel-maximos-back",
        timestamp: new Date().toISOString(),
        traceId: request.id
      } as const;
    }
  );
};
