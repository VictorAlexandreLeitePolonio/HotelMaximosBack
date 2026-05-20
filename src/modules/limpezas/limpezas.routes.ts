import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../../shared/prisma/client.js";
import { PrismaAuthRepository } from "../auth/auth.repository.js";
import { assertAllowedProfiles, getAuthenticatedUser } from "../auth/auth.guards.js";
import { PrismaLimpezasRepository } from "./limpezas.repository.js";
import {
  cleaningListQuerySchema,
  cleaningListResponseSchema,
  cleaningParamsSchema,
  cleaningResponseSchema,
  completeCleaningBodySchema,
  limpezasErrorResponses
} from "./limpezas.schemas.js";
import { LimpezasService } from "./limpezas.service.js";

export const limpezasRoutes: FastifyPluginAsyncZod = async (app) => {
  const authRepository = new PrismaAuthRepository(prisma);
  const limpezasService = new LimpezasService(new PrismaLimpezasRepository(prisma));

  app.get(
    "/limpezas",
    {
      schema: {
        tags: ["Limpezas"],
        summary: "Lista limpezas operacionais semanais e de checkout.",
        querystring: cleaningListQuerySchema,
        response: {
          200: cleaningListResponseSchema,
          401: limpezasErrorResponses[401],
          403: limpezasErrorResponses[403]
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);
      return limpezasService.list(request.query);
    }
  );

  app.post(
    "/limpezas/:id/concluir",
    {
      schema: {
        tags: ["Limpezas"],
        summary: "Conclui manualmente uma limpeza operacional.",
        params: cleaningParamsSchema,
        body: completeCleaningBodySchema.optional(),
        response: {
          200: cleaningResponseSchema,
          ...limpezasErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);
      return limpezasService.complete(request.params.id, user, request.body ?? {});
    }
  );
};
