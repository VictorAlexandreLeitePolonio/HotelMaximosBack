import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "../../shared/prisma/client.js";
import { errorResponseSchema } from "../../shared/errors/error-response.schema.js";
import { PrismaAuthRepository } from "../auth/auth.repository.js";
import { assertAllowedProfiles, getAuthenticatedUser } from "../auth/auth.guards.js";
import { PrismaHospedesRepository } from "./hospedes.repository.js";
import {
  createHospedeBodySchema,
  hospedeParamsSchema,
  hospedeResponseSchema,
  hospedesListQuerySchema,
  hospedesListResponseSchema,
  updateHospedeBodySchema
} from "./hospedes.schemas.js";
import { HospedesService } from "./hospedes.service.js";

const noContentSchema = z.null();

export const hospedesRoutes: FastifyPluginAsyncZod = async (app) => {
  const authRepository = new PrismaAuthRepository(prisma);
  const hospedesService = new HospedesService(new PrismaHospedesRepository(prisma));
  const allowedProfiles = ["Admin", "Recepcionista"] as const;

  app.get(
    "/",
    {
      schema: {
        tags: ["Hospedes"],
        summary: "Lista hospedes responsaveis com filtros e paginacao.",
        querystring: hospedesListQuerySchema,
        response: {
          200: hospedesListResponseSchema,
          401: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(requester, allowedProfiles);
      return hospedesService.list(request.query);
    }
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Hospedes"],
        summary: "Cria hospede responsavel e acompanhantes.",
        body: createHospedeBodySchema,
        response: {
          201: hospedeResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          409: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(requester, allowedProfiles);
      return reply.status(201).send(await hospedesService.create(request.body));
    }
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Hospedes"],
        summary: "Busca hospede responsavel com acompanhantes.",
        params: hospedeParamsSchema,
        response: {
          200: hospedeResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(requester, allowedProfiles);
      return hospedesService.getById(request.params.id);
    }
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Hospedes"],
        summary: "Atualiza hospede responsavel e sua lista de acompanhantes.",
        params: hospedeParamsSchema,
        body: updateHospedeBodySchema,
        response: {
          200: hospedeResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(requester, allowedProfiles);
      return hospedesService.update(request.params.id, request.body);
    }
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Hospedes"],
        summary: "Inativa o cadastro principal do hospede.",
        params: hospedeParamsSchema,
        response: {
          204: noContentSchema,
          401: errorResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(requester, allowedProfiles);
      await hospedesService.delete(request.params.id);
      return reply.status(204).send(null);
    }
  );
};
