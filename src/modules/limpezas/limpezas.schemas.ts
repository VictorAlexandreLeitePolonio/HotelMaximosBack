import { z } from "zod";
import { errorResponseSchema } from "../../shared/errors/error-response.schema.js";
import { paginatedResponseSchema, paginationQuerySchema } from "../../shared/pagination/pagination.schema.js";

const profileSchema = z.enum(["Admin", "Recepcionista"]);
const flatStatusSchema = z.enum(["Livre", "Reservado", "Ocupado", "AguardandoLimpeza", "Manutencao"]);
const cleaningTypeSchema = z.enum(["Semanal", "Checkout"]);
const cleaningStatusSchema = z.enum(["Pendente", "Concluida", "Atrasada", "Suspensa"]);

const cleaningUserSchema = z.object({
  id: z.number().int().positive(),
  login: z.string(),
  nomeCompleto: z.string(),
  perfil: profileSchema
});

const cleaningFlatSchema = z.object({
  id: z.number().int().positive(),
  numero: z.string(),
  statusOperacional: flatStatusSchema
});

export const cleaningResponseSchema = z.object({
  id: z.number().int().positive(),
  flatId: z.number().int().positive(),
  flat: cleaningFlatSchema,
  estadiaId: z.number().int().positive().nullable(),
  tipo: cleaningTypeSchema,
  status: cleaningStatusSchema,
  dataProgramada: z.date(),
  atrasaEm: z.date(),
  concluidaEm: z.date().nullable(),
  usuarioConclusao: cleaningUserSchema.nullable(),
  observacoesConclusao: z.string().nullable(),
  criadoEm: z.date(),
  atualizadoEm: z.date()
});

export const cleaningListResponseSchema = paginatedResponseSchema(cleaningResponseSchema);

export const cleaningListQuerySchema = paginationQuerySchema.extend({
  tipo: cleaningTypeSchema.optional(),
  status: cleaningStatusSchema.optional(),
  flatId: z.coerce.number().int().positive().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

export const cleaningParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const completeCleaningBodySchema = z.object({
  observacoes: z.string().trim().optional()
});

export const limpezasErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema
};
