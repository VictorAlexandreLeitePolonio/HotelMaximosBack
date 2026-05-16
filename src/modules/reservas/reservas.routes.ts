import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../../shared/prisma/client.js";
import { errorResponseSchema } from "../../shared/errors/error-response.schema.js";
import { PrismaAuthRepository } from "../auth/auth.repository.js";
import { assertAllowedProfiles, getAuthenticatedUser } from "../auth/auth.guards.js";
import { PrismaReservasRepository } from "./reservas.repository.js";
import {
  createReservaBodySchema,
  disponibilidadeListResponseSchema,
  disponibilidadeQuerySchema,
  reservaParamsSchema,
  reservaResponseSchema,
  reservasListQuerySchema,
  reservasListResponseSchema
} from "./reservas.schemas.js";
import { ReservasService } from "./reservas.service.js";

export const reservasRoutes: FastifyPluginAsyncZod = async (app) => {
  const authRepository = new PrismaAuthRepository(prisma);
  const reservasService = new ReservasService(new PrismaReservasRepository(prisma));
  const allowedProfiles = ["Admin", "Recepcionista"] as const;

  app.get(
    "/disponibilidade",
    {
      schema: {
        tags: ["Reservas"],
        summary: "Lista disponibilidade de flats por periodo.",
        querystring: disponibilidadeQuerySchema,
        response: {
          200: disponibilidadeListResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(requester, allowedProfiles);
      return reservasService.listAvailability(request.query);
    }
  );

  app.get(
    "/",
    {
      schema: {
        tags: ["Reservas"],
        summary: "Lista reservas com filtros e paginacao.",
        querystring: reservasListQuerySchema,
        response: {
          200: reservasListResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(requester, allowedProfiles);
      return reservasService.list(request.query);
    }
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Reservas"],
        summary: "Cria reserva com snapshot de valores e bloqueio por periodo.",
        body: createReservaBodySchema,
        response: {
          201: reservaResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(requester, allowedProfiles);
      return reply.status(201).send(await reservasService.create(request.body));
    }
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Reservas"],
        summary: "Busca reserva por id.",
        params: reservaParamsSchema,
        response: {
          200: reservaResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(requester, allowedProfiles);
      return reservasService.getById(request.params.id);
    }
  );
};
