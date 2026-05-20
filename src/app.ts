import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider
} from "fastify-type-provider-zod";
import { env } from "./config/env.js";
import { registerErrorHandler } from "./shared/errors/error-handler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { categoriasRoutes } from "./modules/categorias/categorias.routes.js";
import { estadiasRoutes } from "./modules/estadias/estadias.routes.js";
import { financeiroRoutes } from "./modules/financeiro/financeiro.routes.js";
import { flatsRoutes } from "./modules/flats/flats.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { hospedesRoutes } from "./modules/hospedes/hospedes.routes.js";
import { reservasRoutes } from "./modules/reservas/reservas.routes.js";
import { subcategoriasRoutes } from "./modules/subcategorias/subcategorias.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : "info",
      redact: {
        paths: [
          "req.headers.authorization",
          "request.headers.authorization",
          "body.senha",
          "body.senhaAtual",
          "body.novaSenha",
          "body.refreshToken",
          "accessToken",
          "refreshToken"
        ],
        censor: "[REDACTED]"
      }
    },
    genReqId: (request) => {
      const headerTraceId = request.headers["x-trace-id"];
      return typeof headerTraceId === "string" && headerTraceId.trim().length > 0
        ? headerTraceId
        : randomUUID();
    }
  }).withTypeProvider<ZodTypeProvider>();

  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;

    if (origin) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Vary", "Origin");
    }

    reply.header("Access-Control-Allow-Credentials", "true");
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    reply.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-trace-id"
    );

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(multipart, {
    attachFieldsToBody: true,
    limits: {
      fileSize: env.COMPROVANTE_MAX_FILE_SIZE_BYTES,
      files: 1,
      fields: 20
    },
    throwFileSizeLimit: true
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Hotel Maximos API",
        description: "Backend do sistema de gestão do Hotel Maximos.",
        version: "0.1.0"
      },
      tags: [
        { name: "Auth", description: "Endpoints de autenticacao." },
        { name: "Categorias", description: "Endpoints de gestao de categorias." },
        { name: "Estadias", description: "Endpoints operacionais de check-in e estadias ativas." },
        { name: "Financeiro", description: "Endpoints de cobranças, pagamentos e extras." },
        { name: "Flats", description: "Endpoints de gestao de flats." },
        { name: "Health", description: "Endpoints de verificação da API." },
        { name: "Hospedes", description: "Endpoints de gestao de hospedes." },
        { name: "Reservas", description: "Endpoints de disponibilidade e reservas." },
        { name: "Subcategorias", description: "Endpoints de gestao de subcategorias, valores e capacidade." },
        { name: "Users", description: "Endpoints de gestao de usuarios." }
      ],
      components: {}
    },
    transform: jsonSchemaTransform
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs"
  });

  registerErrorHandler(app);

  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(categoriasRoutes, { prefix: "/api/categorias" });
  await app.register(estadiasRoutes, { prefix: "/api" });
  await app.register(financeiroRoutes, { prefix: "/api" });
  await app.register(flatsRoutes, { prefix: "/api/flats" });
  await app.register(hospedesRoutes, { prefix: "/api/hospedes" });
  await app.register(reservasRoutes, { prefix: "/api/reservas" });
  await app.register(subcategoriasRoutes, { prefix: "/api/subcategorias" });
  await app.register(usersRoutes, { prefix: "/api/users" });

  return app;
}
