import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "../../shared/prisma/client.js";
import { errorResponseSchema } from "../../shared/errors/error-response.schema.js";
import { AuthService } from "./auth.service.js";
import { PrismaAuthRepository } from "./auth.repository.js";
import {
  authResponseSchema,
  changePasswordBodySchema,
  loginBodySchema,
  logoutBodySchema,
  refreshBodySchema
} from "./auth.schemas.js";
import { getAuthenticatedUser } from "./auth.guards.js";

const noContentSchema = z.null();

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const repository = new PrismaAuthRepository(prisma);
  const authService = new AuthService(repository);

  app.post(
    "/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Autentica usuario por login e senha.",
        body: loginBodySchema,
        response: {
          200: authResponseSchema,
          401: errorResponseSchema
        }
      }
    },
    async (request) => {
      return authService.login(request.body);
    }
  );

  app.post(
    "/refresh",
    {
      schema: {
        tags: ["Auth"],
        summary: "Rotaciona refresh token e emite nova sessao.",
        body: refreshBodySchema,
        response: {
          200: authResponseSchema,
          401: errorResponseSchema
        }
      }
    },
    async (request) => {
      return authService.refresh(request.body);
    }
  );

  app.post(
    "/logout",
    {
      schema: {
        tags: ["Auth"],
        summary: "Revoga o refresh token atual.",
        body: logoutBodySchema,
        response: {
          204: noContentSchema,
          401: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      await authService.logout(request.body);
      return reply.status(204).send(null);
    }
  );

  app.patch(
    "/password",
    {
      schema: {
        tags: ["Auth"],
        summary: "Altera a senha do usuario autenticado.",
        body: changePasswordBodySchema,
        response: {
          204: noContentSchema,
          400: errorResponseSchema,
          401: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request, repository);
      await authService.changePassword(user.id, request.body);

      return reply.status(204).send(null);
    }
  );
};
