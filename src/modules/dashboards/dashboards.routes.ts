import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../../shared/prisma/client.js";
import { PrismaAuthRepository } from "../auth/auth.repository.js";
import { assertAdminUser, assertAllowedProfiles, getAuthenticatedUser } from "../auth/auth.guards.js";
import { PrismaDashboardsRepository } from "./dashboards.repository.js";
import {
  cancelOperationalObservationBodySchema,
  correctOperationalObservationBodySchema,
  createOperationalObservationBodySchema,
  dashboardsErrorResponses,
  financialDashboardResponseSchema,
  flatHistoryListQuerySchema,
  flatHistoryListResponseSchema,
  flatHistoryParamsSchema,
  flatHistoryResponseSchema,
  flatParamsSchema,
  markNoShowBodySchema,
  markNoShowResponseSchema,
  operationalDashboardResponseSchema,
  reservationParamsSchema
} from "./dashboards.schemas.js";
import { DashboardsService } from "./dashboards.service.js";

export const dashboardsRoutes: FastifyPluginAsyncZod = async (app) => {
  const authRepository = new PrismaAuthRepository(prisma);
  const dashboardsService = new DashboardsService(new PrismaDashboardsRepository(prisma));
  const operationalProfiles = ["Admin", "Recepcionista"] as const;

  app.get(
    "/dashboards/operacional",
    {
      schema: {
        tags: ["Dashboards"],
        summary: "Retorna o dashboard operacional para polling do frontend.",
        response: {
          200: operationalDashboardResponseSchema,
          401: dashboardsErrorResponses[401],
          403: dashboardsErrorResponses[403]
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, operationalProfiles);
      return dashboardsService.getOperationalDashboard();
    }
  );

  app.get(
    "/dashboards/financeiro",
    {
      schema: {
        tags: ["Dashboards"],
        summary: "Retorna o dashboard financeiro administrativo.",
        response: {
          200: financialDashboardResponseSchema,
          401: dashboardsErrorResponses[401],
          403: dashboardsErrorResponses[403]
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(user);
      return dashboardsService.getFinancialDashboard();
    }
  );

  app.post(
    "/reservas/:id/no-show",
    {
      schema: {
        tags: ["Dashboards"],
        summary: "Marca manualmente uma reserva atrasada como no-show.",
        params: reservationParamsSchema,
        body: markNoShowBodySchema,
        response: {
          200: markNoShowResponseSchema,
          ...dashboardsErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, operationalProfiles);
      return dashboardsService.markReservationAsNoShow(request.params.id, user, request.body);
    }
  );

  app.get(
    "/flats/:id/historico",
    {
      schema: {
        tags: ["Dashboards"],
        summary: "Lista o historico operacional e auditavel de um flat.",
        params: flatParamsSchema,
        querystring: flatHistoryListQuerySchema,
        response: {
          200: flatHistoryListResponseSchema,
          ...dashboardsErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, operationalProfiles);
      return dashboardsService.listFlatHistory(request.params.id, request.query);
    }
  );

  app.post(
    "/flats/:id/observacoes-operacionais",
    {
      schema: {
        tags: ["Dashboards"],
        summary: "Cria uma observacao operacional imutavel para o flat.",
        params: flatParamsSchema,
        body: createOperationalObservationBodySchema,
        response: {
          201: flatHistoryResponseSchema,
          ...dashboardsErrorResponses
        }
      }
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, operationalProfiles);
      return reply
        .status(201)
        .send(await dashboardsService.createOperationalObservation(request.params.id, user, request.body));
    }
  );

  app.post(
    "/flats/:id/observacoes-operacionais/:historicoId/corrigir",
    {
      schema: {
        tags: ["Dashboards"],
        summary: "Cria uma correcao administrativa auditavel para uma observacao operacional.",
        params: flatHistoryParamsSchema,
        body: correctOperationalObservationBodySchema,
        response: {
          200: flatHistoryResponseSchema,
          ...dashboardsErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(user);
      return dashboardsService.correctOperationalObservation(
        request.params.id,
        request.params.historicoId,
        user,
        request.body
      );
    }
  );

  app.post(
    "/flats/:id/observacoes-operacionais/:historicoId/cancelar",
    {
      schema: {
        tags: ["Dashboards"],
        summary: "Cancela administrativamente uma observacao operacional via novo evento auditavel.",
        params: flatHistoryParamsSchema,
        body: cancelOperationalObservationBodySchema,
        response: {
          200: flatHistoryResponseSchema,
          ...dashboardsErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAdminUser(user);
      return dashboardsService.cancelOperationalObservation(
        request.params.id,
        request.params.historicoId,
        user,
        request.body
      );
    }
  );
};
