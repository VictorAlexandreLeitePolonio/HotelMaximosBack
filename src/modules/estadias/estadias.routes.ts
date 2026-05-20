import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../../shared/prisma/client.js";
import { assertAllowedProfiles, getAuthenticatedUser } from "../auth/auth.guards.js";
import { PrismaAuthRepository } from "../auth/auth.repository.js";
import { PrismaEstadiasRepository } from "./estadias.repository.js";
import {
  activeStaysQuerySchema,
  activeStaysResponseSchema,
  checkInDoDiaListResponseSchema,
  checkInDoDiaQuerySchema,
  checkInFromReservationBodySchema,
  checkInResponseSchema,
  directCheckInBodySchema,
  estadiaParamsSchema,
  estadiasErrorResponses,
  estadiaResponseSchema,
  renewStayBodySchema,
  transferFlatBodySchema
} from "./estadias.schemas.js";
import { EstadiasService } from "./estadias.service.js";

export const estadiasRoutes: FastifyPluginAsyncZod = async (app) => {
  const authRepository = new PrismaAuthRepository(prisma);
  const estadiasService = new EstadiasService(new PrismaEstadiasRepository(prisma));

  app.post(
    "/reservas/:id/check-in",
    {
      schema: {
        tags: ["Estadias"],
        summary: "Realiza check-in a partir de reserva existente.",
        params: estadiaParamsSchema,
        body: checkInFromReservationBodySchema,
        response: {
          200: checkInResponseSchema,
          ...estadiasErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);

      return estadiasService.checkInFromReservation(request.params.id, user.id, request.body);
    }
  );

  app.post(
    "/estadias/check-in-direto",
    {
      schema: {
        tags: ["Estadias"],
        summary: "Realiza check-in direto sem reserva previa.",
        body: directCheckInBodySchema,
        response: {
          200: checkInResponseSchema,
          ...estadiasErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);

      return estadiasService.directCheckIn(user.id, request.body);
    }
  );

  app.get(
    "/estadias/check-in-do-dia",
    {
      schema: {
        tags: ["Estadias"],
        summary: "Lista reservas pendentes de check-in para hoje e atrasadas.",
        querystring: checkInDoDiaQuerySchema,
        response: {
          200: checkInDoDiaListResponseSchema,
          ...estadiasErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);

      return estadiasService.listCheckInDoDia(request.query);
    }
  );

  app.get(
    "/estadias/ativas",
    {
      schema: {
        tags: ["Estadias"],
        summary: "Lista estadias ativas com filtros e paginacao.",
        querystring: activeStaysQuerySchema,
        response: {
          200: activeStaysResponseSchema,
          ...estadiasErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);

      return estadiasService.listActive(request.query);
    }
  );

  app.post(
    "/estadias/:id/trocar-flat",
    {
      schema: {
        tags: ["Estadias"],
        summary: "Transfere uma estadia ativa para outro flat.",
        params: estadiaParamsSchema,
        body: transferFlatBodySchema,
        response: {
          200: estadiaResponseSchema,
          ...estadiasErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);

      return estadiasService.transferFlat(request.params.id, user.id, request.body);
    }
  );

  app.post(
    "/estadias/:id/renovar",
    {
      schema: {
        tags: ["Estadias"],
        summary: "Renova a data fim prevista de uma estadia ativa.",
        params: estadiaParamsSchema,
        body: renewStayBodySchema,
        response: {
          200: estadiaResponseSchema,
          ...estadiasErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);

      return estadiasService.renewStay(request.params.id, user.id, request.body);
    }
  );
};
