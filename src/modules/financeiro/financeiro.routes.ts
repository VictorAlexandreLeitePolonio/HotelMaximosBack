import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../../shared/prisma/client.js";
import { resolveComprovanteValue } from "../../shared/uploads/comprovantes.storage.js";
import { PrismaAuthRepository } from "../auth/auth.repository.js";
import { assertAdminUser, assertAllowedProfiles, getAuthenticatedUser } from "../auth/auth.guards.js";
import { PrismaFinanceiroRepository } from "./financeiro.repository.js";
import {
  chargeParamsSchema,
  chargePaymentResponseSchema,
  createExtraTypeBodySchema,
  createStayExtraBodySchema,
  extraParamsSchema,
  extraTypeParamsSchema,
  extraTypesListQuerySchema,
  financeEstadiaParamsSchema,
  financeiroErrorResponses,
  generateMonthlyChargesBodySchema,
  generatedChargesResponseSchema,
  payChargeBodySchema,
  payExtraBodySchema,
  stayExtraMutationResponseSchema,
  stayFinancialResponseSchema,
  tipoExtraResponseSchema,
  tipoExtraSummarySchema,
  updateExtraTypeBodySchema
} from "./financeiro.schemas.js";
import { FinanceiroService } from "./financeiro.service.js";

const noContentSchema = z.null();

export const financeiroRoutes: FastifyPluginAsyncZod = async (app) => {
  const authRepository = new PrismaAuthRepository(prisma);
  const financeiroService = new FinanceiroService(new PrismaFinanceiroRepository(prisma));

  app.get(
    "/estadias/:id/financeiro",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Retorna cobranças e extras vinculados à estadia.",
        params: financeEstadiaParamsSchema,
        response: {
          200: stayFinancialResponseSchema,
          401: financeiroErrorResponses[401],
          403: financeiroErrorResponses[403],
          404: financeiroErrorResponses[404]
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);
      return financeiroService.getStayFinancial(request.params.id);
    }
  );

  app.post(
    "/estadias/:id/cobrancas/gerar",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Gera cobranças mensais pendentes da estadia até a data de referência.",
        params: financeEstadiaParamsSchema,
        body: generateMonthlyChargesBodySchema,
        response: {
          200: generatedChargesResponseSchema,
          ...financeiroErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);
      return financeiroService.generateMonthlyCharges(request.params.id, request.body);
    }
  );

  app.post(
    "/cobrancas/:id/pagar",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Liquida uma cobrança pendente.",
        consumes: ["application/json", "multipart/form-data"],
        params: chargeParamsSchema,
        body: payChargeBodySchema,
        response: {
          200: chargePaymentResponseSchema,
          ...financeiroErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);

      const { comprovanteArquivo, ...body } = request.body;
      const comprovante = await resolveComprovanteValue({
        comprovante: body.comprovante,
        comprovanteArquivo
      });

      return financeiroService.payCharge(request.params.id, user.id, {
        ...body,
        comprovante
      });
    }
  );

  app.get(
    "/tipos-extras",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Lista tipos de extras com filtros e paginação.",
        querystring: extraTypesListQuerySchema,
        response: {
          200: z.object({
            data: z.array(tipoExtraResponseSchema),
            meta: z.object({
              page: z.number().int().positive(),
              pageSize: z.number().int().positive(),
              total: z.number().int().nonnegative(),
              totalPages: z.number().int().nonnegative()
            })
          }),
          401: financeiroErrorResponses[401],
          403: financeiroErrorResponses[403]
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(user);
      return financeiroService.listExtraTypes(request.query);
    }
  );

  app.post(
    "/tipos-extras",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Cria um tipo de extra.",
        body: createExtraTypeBodySchema,
        response: {
          201: tipoExtraResponseSchema,
          ...financeiroErrorResponses
        }
      }
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(user);
      return reply.status(201).send(await financeiroService.createExtraType(request.body));
    }
  );

  app.get(
    "/tipos-extras/:id",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Busca um tipo de extra por id.",
        params: extraTypeParamsSchema,
        response: {
          200: tipoExtraResponseSchema,
          401: financeiroErrorResponses[401],
          403: financeiroErrorResponses[403],
          404: financeiroErrorResponses[404]
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(user);
      return financeiroService.getExtraTypeById(request.params.id);
    }
  );

  app.put(
    "/tipos-extras/:id",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Atualiza um tipo de extra.",
        params: extraTypeParamsSchema,
        body: updateExtraTypeBodySchema,
        response: {
          200: tipoExtraResponseSchema,
          ...financeiroErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(user);
      return financeiroService.updateExtraType(request.params.id, request.body);
    }
  );

  app.delete(
    "/tipos-extras/:id",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Inativa um tipo de extra.",
        params: extraTypeParamsSchema,
        response: {
          204: noContentSchema,
          ...financeiroErrorResponses
        }
      }
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(user);
      await financeiroService.deleteExtraType(request.params.id);
      return reply.status(204).send(null);
    }
  );

  app.post(
    "/estadias/:id/extras",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Lança um extra para a estadia, com pagamento imediato opcional.",
        consumes: ["application/json", "multipart/form-data"],
        params: financeEstadiaParamsSchema,
        body: createStayExtraBodySchema,
        response: {
          201: stayExtraMutationResponseSchema,
          ...financeiroErrorResponses
        }
      }
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);

      const { comprovanteArquivo, ...body } = request.body;
      const comprovante = await resolveComprovanteValue({
        comprovante: body.comprovante,
        comprovanteArquivo
      });

      return reply.status(201).send(
        await financeiroService.createStayExtra(request.params.id, user.id, {
          ...body,
          comprovante
        })
      );
    }
  );

  app.post(
    "/extras/:id/pagar",
    {
      schema: {
        tags: ["Financeiro"],
        summary: "Liquida um extra pendente.",
        consumes: ["application/json", "multipart/form-data"],
        params: extraParamsSchema,
        body: payExtraBodySchema,
        response: {
          200: z.object({
            extra: stayExtraMutationResponseSchema.shape.extra,
            cobranca: stayExtraMutationResponseSchema.shape.cobranca,
            pagamento: stayExtraMutationResponseSchema.shape.pagamento.unwrap()
          }),
          ...financeiroErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);

      const { comprovanteArquivo, ...body } = request.body;
      const comprovante = await resolveComprovanteValue({
        comprovante: body.comprovante,
        comprovanteArquivo
      });

      return financeiroService.payExtra(request.params.id, user.id, {
        ...body,
        comprovante
      });
    }
  );
};
