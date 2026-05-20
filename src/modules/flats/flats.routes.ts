import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../../shared/prisma/client.js";
import { errorResponseSchema } from "../../shared/errors/error-response.schema.js";
import { PrismaAuthRepository } from "../auth/auth.repository.js";
import { assertAdminUser, assertAllowedProfiles, getAuthenticatedUser } from "../auth/auth.guards.js";
import { PrismaFlatsRepository } from "./flats.repository.js";
import {
  createFlatBodySchema,
  flatMaintenanceResponseSchema,
  flatParamsSchema,
  releaseFlatMaintenanceBodySchema,
  flatResponseSchema,
  flatsListQuerySchema,
  flatsListResponseSchema,
  startFlatMaintenanceBodySchema,
  updateFlatBodySchema,
  updateFlatStatusBodySchema
} from "./flats.schemas.js";
import { FlatsService } from "./flats.service.js";

const noContentSchema = z.null();

export const flatsRoutes: FastifyPluginAsyncZod = async (app) => {
  const authRepository = new PrismaAuthRepository(prisma);
  const flatsService = new FlatsService(new PrismaFlatsRepository(prisma));
  const readProfiles = ["Admin", "Recepcionista"] as const;

  app.get(
    "/",
    {
      schema: {
        tags: ["Flats"],
        summary: "Lista flats com filtros e paginacao.",
        querystring: flatsListQuerySchema,
        response: {
          200: flatsListResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(requester, readProfiles);
      return flatsService.list(request.query);
    }
  );

  app.post(
    "/:id/manutencao",
    {
      schema: {
        tags: ["Flats"],
        summary: "Inicia manutencao do flat e sinaliza impactos operacionais.",
        params: flatParamsSchema,
        body: startFlatMaintenanceBodySchema,
        response: {
          200: flatMaintenanceResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(requester);
      return flatsService.startMaintenance(request.params.id, requester, request.body);
    }
  );

  app.post(
    "/:id/manutencao/liberar",
    {
      schema: {
        tags: ["Flats"],
        summary: "Libera manutencao do flat e restaura o fluxo operacional.",
        params: flatParamsSchema,
        body: releaseFlatMaintenanceBodySchema,
        response: {
          200: flatMaintenanceResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(requester);
      return flatsService.releaseMaintenance(request.params.id, requester, request.body);
    }
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Flats"],
        summary: "Cria flat.",
        body: createFlatBodySchema,
        response: {
          201: flatResponseSchema,
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
      assertAdminUser(requester);
      return reply.status(201).send(await flatsService.create(request.body));
    }
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Flats"],
        summary: "Busca flat por id.",
        params: flatParamsSchema,
        response: {
          200: flatResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(requester, readProfiles);
      return flatsService.getById(request.params.id);
    }
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Flats"],
        summary: "Atualiza flat.",
        params: flatParamsSchema,
        body: updateFlatBodySchema,
        response: {
          200: flatResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(requester);
      return flatsService.update(request.params.id, request.body);
    }
  );

  app.put(
    "/:id/status",
    {
      schema: {
        tags: ["Flats"],
        summary: "Atualiza status operacional do flat.",
        params: flatParamsSchema,
        body: updateFlatStatusBodySchema,
        response: {
          200: flatResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(requester);
      return flatsService.updateStatus(request.params.id, request.body.statusOperacional);
    }
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Flats"],
        summary: "Inativa flat.",
        params: flatParamsSchema,
        response: {
          204: noContentSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(requester);
      await flatsService.delete(request.params.id);
      return reply.status(204).send(null);
    }
  );
};
