import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../../shared/prisma/client.js";
import { errorResponseSchema } from "../../shared/errors/error-response.schema.js";
import { PrismaAuthRepository } from "../auth/auth.repository.js";
import { assertAdminUser, getAuthenticatedUser } from "../auth/auth.guards.js";
import { PrismaCategoriasRepository } from "../categorias/categorias.repository.js";
import {
  categoriaParamsSchema,
  subcategoriaBodySchema,
  subcategoriaResponseSchema,
  subcategoriasListQuerySchema,
  subcategoriasListResponseSchema,
  updateSubcategoriaBodySchema
} from "../categorias/categorias.schemas.js";
import { CategoriasService } from "../categorias/categorias.service.js";

const noContentSchema = z.null();

export const subcategoriasRoutes: FastifyPluginAsyncZod = async (app) => {
  const authRepository = new PrismaAuthRepository(prisma);
  const categoriasService = new CategoriasService(new PrismaCategoriasRepository(prisma));

  app.get(
    "/",
    {
      schema: {
        tags: ["Subcategorias"],
        summary: "Lista subcategorias com filtros e paginacao.",
        querystring: subcategoriasListQuerySchema,
        response: {
          200: subcategoriasListResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(requester);
      return categoriasService.listSubcategories(request.query);
    }
  );

  app.post(
    "/",
    {
      schema: {
        tags: ["Subcategorias"],
        summary: "Cria subcategoria.",
        body: subcategoriaBodySchema,
        response: {
          201: subcategoriaResponseSchema,
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
      return reply.status(201).send(await categoriasService.createSubcategory(request.body));
    }
  );

  app.get(
    "/:id",
    {
      schema: {
        tags: ["Subcategorias"],
        summary: "Busca subcategoria por id.",
        params: categoriaParamsSchema,
        response: {
          200: subcategoriaResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request) => {
      const requester = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(requester);
      return categoriasService.getSubcategoryById(request.params.id);
    }
  );

  app.put(
    "/:id",
    {
      schema: {
        tags: ["Subcategorias"],
        summary: "Atualiza subcategoria.",
        params: categoriaParamsSchema,
        body: updateSubcategoriaBodySchema,
        response: {
          200: subcategoriaResponseSchema,
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
      return categoriasService.updateSubcategory(request.params.id, request.body);
    }
  );

  app.delete(
    "/:id",
    {
      schema: {
        tags: ["Subcategorias"],
        summary: "Inativa subcategoria.",
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
      await categoriasService.deleteSubcategory(request.params.id);
      return reply.status(204).send(null);
    }
  );
};
