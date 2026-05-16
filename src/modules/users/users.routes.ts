import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../../shared/prisma/client.js";
import { errorResponseSchema } from "../../shared/errors/error-response.schema.js";
import { PrismaAuthRepository } from "../auth/auth.repository.js";
import { assertAdminUser, getAuthenticatedUser } from "../auth/auth.guards.js";
import { PrismaUsersRepository } from "./users.repository.js";
import { UsersService } from "./users.service.js";
import {
  createUserBodySchema,
  updateUserBodySchema,
  updateUserStatusBodySchema,
  userParamsSchema,
  userResponseSchema,
  usersListQuerySchema,
  usersListResponseSchema
} from "./users.schemas.js";

export const usersRoutes: FastifyPluginAsyncZod = async (app) => {
  const authRepository = new PrismaAuthRepository(prisma);
  const usersService = new UsersService(new PrismaUsersRepository(prisma));

  app.get(
    "/",
    {
      schema: {
        tags: ["Users"],
        summary: "Lista usuarios com filtros, ordenacao e paginacao.",
        querystring: usersListQuerySchema,
        response: {
          200: usersListResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(requester);

      return usersService.list(request.query);
    }
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Users"],
        summary: "Cria usuario.",
        body: createUserBodySchema,
        response: {
          201: userResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(requester);

      return reply.status(201).send(await usersService.create(request.body));
    }
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Users"],
        summary: "Busca usuario por id.",
        params: userParamsSchema,
        response: {
          200: userResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(requester);

      return usersService.getById(request.params.id);
    }
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Users"],
        summary: "Atualiza dados editaveis do usuario.",
        params: userParamsSchema,
        body: updateUserBodySchema,
        response: {
          200: userResponseSchema,
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

      return usersService.update(request.params.id, request.body);
    }
  );

  app.put(
    "/:id/status",
    {
      schema: {
        tags: ["Users"],
        summary: "Ativa ou inativa usuario.",
        params: userParamsSchema,
        body: updateUserStatusBodySchema,
        response: {
          200: userResponseSchema,
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

      return usersService.setStatus(requester.id, request.params.id, request.body.ativo);
    }
  );

  app.post(
    "/:id/reset-password",
    {
      schema: {
        tags: ["Users"],
        summary: "Reseta senha do usuario para senha padrao local.",
        params: userParamsSchema,
        response: {
          200: userResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(requester);

      return usersService.resetPassword(request.params.id);
    }
  );
};
