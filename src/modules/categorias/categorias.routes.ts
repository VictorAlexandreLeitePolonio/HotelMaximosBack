import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../../shared/prisma/client.js";
import { errorResponseSchema } from "../../shared/errors/error-response.schema.js";
import { PrismaAuthRepository } from "../auth/auth.repository.js";
import { assertAdminUser, getAuthenticatedUser } from "../auth/auth.guards.js";
import { PrismaCategoriasRepository } from "./categorias.repository.js";
import {
  categoriaBodySchema,
  categoriaParamsSchema,
  categoriaResponseSchema,
  categoriasListQuerySchema,
  categoriasListResponseSchema,
  updateCategoriaBodySchema
} from "./categorias.schemas.js";
import { CategoriasService } from "./categorias.service.js";

const noContentSchema = z.null();

export const categoriasRoutes: FastifyPluginAsyncZod = async (app) => {
  const authRepository = new PrismaAuthRepository(prisma);
  const categoriasService = new CategoriasService(new PrismaCategoriasRepository(prisma));

  app.get(
    "/",
    {
      schema: {
        tags: ["Categorias"],
        summary: "Lista categorias com filtros e paginacao.",
        querystring: categoriasListQuerySchema,
        response: {
          200: categoriasListResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(requester);
      return categoriasService.listCategories(request.query);
    }
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Categorias"],
        summary: "Cria categoria.",
        body: categoriaBodySchema,
        response: {
          201: categoriaResponseSchema,
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
      return reply.status(201).send(await categoriasService.createCategory(request.body));
    }
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Categorias"],
        summary: "Busca categoria por id.",
        params: categoriaParamsSchema,
        response: {
          200: categoriaResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(requester);
      return categoriasService.getCategoryById(request.params.id);
    }
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Categorias"],
        summary: "Atualiza categoria.",
        params: categoriaParamsSchema,
        body: updateCategoriaBodySchema,
        response: {
          200: categoriaResponseSchema,
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
      return categoriasService.updateCategory(request.params.id, request.body);
    }
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Categorias"],
        summary: "Inativa categoria.",
        params: categoriaParamsSchema,
        response: {
          204: noContentSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(requester);
      await categoriasService.deleteCategory(request.params.id);
      return reply.status(204).send(null);
    }
  );
};
