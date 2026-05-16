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
import { healthRoutes } from "./modules/health/health.routes.js";
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

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Hotel Maximos API",
        description: "Backend do sistema de gestão do Hotel Maximos.",
        version: "0.1.0"
      },
      tags: [
        { name: "Auth", description: "Endpoints de autenticacao." },
        { name: "Health", description: "Endpoints de verificação da API." },
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
  await app.register(usersRoutes, { prefix: "/api/users" });

  return app;
}
