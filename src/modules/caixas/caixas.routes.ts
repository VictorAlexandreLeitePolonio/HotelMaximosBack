import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../../shared/prisma/client.js";
import { PrismaAuthRepository } from "../auth/auth.repository.js";
import { assertAdminUser, assertAllowedProfiles, getAuthenticatedUser } from "../auth/auth.guards.js";
import { PrismaCaixasRepository } from "./caixas.repository.js";
import {
  caixasErrorResponses,
  cashRegisterParamsSchema,
  cashRegisterResponseSchema,
  closedCashRegistersListQuerySchema,
  closedCashRegistersListResponseSchema,
  closeCashRegisterBodySchema,
  createCashRegisterAdjustmentBodySchema,
  myCashRegisterResponseSchema,
  openCashRegisterBodySchema
} from "./caixas.schemas.js";
import { CaixasService } from "./caixas.service.js";

export const caixasRoutes: FastifyPluginAsyncZod = async (app) => {
  const authRepository = new PrismaAuthRepository(prisma);
  const caixasService = new CaixasService(new PrismaCaixasRepository(prisma));

  app.post(
    "/caixas/abrir",
    {
      schema: {
        tags: ["Caixas"],
        summary: "Abre um novo caixa para o usuario autenticado.",
        body: openCashRegisterBodySchema,
        response: {
          201: cashRegisterResponseSchema,
          ...caixasErrorResponses
        }
      }
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);
      return reply.status(201).send(await caixasService.openCashRegister(user, request.body));
    }
  );

  app.get(
    "/caixas/meu-caixa",
    {
      schema: {
        tags: ["Caixas"],
        summary: "Retorna o caixa aberto atual do usuario autenticado.",
        response: {
          200: myCashRegisterResponseSchema,
          401: caixasErrorResponses[401],
          403: caixasErrorResponses[403]
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);
      return caixasService.getOwnCashRegister(user.id);
    }
  );

  app.get(
    "/caixas/fechados",
    {
      schema: {
        tags: ["Caixas"],
        summary: "Lista caixas fechados para consulta administrativa.",
        querystring: closedCashRegistersListQuerySchema,
        response: {
          200: closedCashRegistersListResponseSchema,
          401: caixasErrorResponses[401],
          403: caixasErrorResponses[403]
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(user);
      return caixasService.listClosedCashRegisters(request.query);
    }
  );

  app.post(
    "/caixas/:id/fechar",
    {
      schema: {
        tags: ["Caixas"],
        summary: "Fecha o proprio caixa informando os valores conferidos por forma de pagamento.",
        params: cashRegisterParamsSchema,
        body: closeCashRegisterBodySchema,
        response: {
          200: cashRegisterResponseSchema,
          ...caixasErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);
      return caixasService.closeCashRegister(user, request.params.id, request.body);
    }
  );

  app.post(
    "/caixas/:id/ajustes",
    {
      schema: {
        tags: ["Caixas"],
        summary: "Cria um ajuste administrativo auditavel para um caixa fechado.",
        params: cashRegisterParamsSchema,
        body: createCashRegisterAdjustmentBodySchema,
        response: {
          200: cashRegisterResponseSchema,
          ...caixasErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(user);
      return caixasService.createAdjustment(user, request.params.id, request.body);
    }
  );

  app.get(
    "/caixas/:id/pdf",
    {
      schema: {
        tags: ["Caixas"],
        summary: "Gera o PDF de fechamento de um caixa encerrado.",
        params: cashRegisterParamsSchema,
        response: {
          200: z.any(),
          401: caixasErrorResponses[401],
          403: caixasErrorResponses[403],
          404: caixasErrorResponses[404],
          409: caixasErrorResponses[409]
        }
      }
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);

      const { buffer, fileName } = await caixasService.generateClosingPdf(user, request.params.id);

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename="${fileName}"`);
      return reply.send(buffer);
    }
  );

  app.get(
    "/caixas/:id",
    {
      schema: {
        tags: ["Caixas"],
        summary: "Retorna o detalhe de um caixa.",
        params: cashRegisterParamsSchema,
        response: {
          200: cashRegisterResponseSchema,
          ...caixasErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);
      return caixasService.getCashRegisterById(user, request.params.id);
    }
  );
};
