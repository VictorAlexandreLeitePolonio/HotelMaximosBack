import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "./app-error.js";
import { comprovanteTooLargeError } from "../uploads/comprovantes.storage.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError | AppError | ZodError, request: FastifyRequest, reply: FastifyReply) => {
      const traceId = request.id;

      if (error instanceof AppError) {
        request.log.warn({ err: error, traceId }, "Handled application error");
        return reply.status(error.statusCode).send({
          error: {
            code: error.code,
            message: error.message,
            traceId,
            details: error.details
          }
        });
      }

      if (error instanceof ZodError) {
        request.log.warn({ err: error, traceId }, "Request validation error");
        return reply.status(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Dados inválidos.",
            traceId,
            details: error.flatten()
          }
        });
      }

      if (error.code === "FST_REQ_FILE_TOO_LARGE") {
        const uploadError = comprovanteTooLargeError();
        request.log.warn({ err: error, traceId }, "Multipart upload too large");
        return reply.status(uploadError.statusCode).send({
          error: {
            code: uploadError.code,
            message: uploadError.message,
            traceId,
            details: uploadError.details
          }
        });
      }

      request.log.error({ err: error, traceId }, "Unhandled server error");
      return reply.status(500).send({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Erro interno do servidor.",
          traceId
        }
      });
    }
  );
}
