import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../../shared/prisma/client.js";
import { assertAllowedProfiles, getAuthenticatedUser } from "../auth/auth.guards.js";
import { PrismaAuthRepository } from "../auth/auth.repository.js";
import { PrismaCheckoutsRepository } from "./checkouts.repository.js";
import {
  checkoutBodySchema,
  checkoutParamsSchema,
  checkoutResponseSchema,
  checkoutsErrorResponses
} from "./checkouts.schemas.js";
import { CheckoutsService } from "./checkouts.service.js";

export const checkoutsRoutes: FastifyPluginAsyncZod = async (app) => {
  const authRepository = new PrismaAuthRepository(prisma);
  const checkoutsService = new CheckoutsService(new PrismaCheckoutsRepository(prisma));

  app.post(
    "/estadias/:id/checkout",
    {
      schema: {
        tags: ["Checkouts"],
        summary: "Encerra a estadia, gera o recibo final e move o flat para aguardando limpeza.",
        params: checkoutParamsSchema,
        body: checkoutBodySchema.optional(),
        response: {
          200: checkoutResponseSchema,
          ...checkoutsErrorResponses
        }
      }
    },
    async (request) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);
      return checkoutsService.checkout(request.params.id, user, request.body ?? {});
    }
  );

  app.get(
    "/estadias/:id/checkout/recibo",
    {
      schema: {
        tags: ["Checkouts"],
        summary: "Gera o PDF do recibo final de uma estadia encerrada.",
        params: checkoutParamsSchema,
        response: {
          200: z.any(),
          ...checkoutsErrorResponses
        }
      }
    },
    async (request, reply) => {
      const user = await getAuthenticatedUser(request, authRepository);
      assertAllowedProfiles(user, ["Admin", "Recepcionista"]);

      const { buffer, fileName } = await checkoutsService.generateReceiptPdf(request.params.id);

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename="${fileName}"`);
      return reply.send(buffer);
    }
  );
};
