import { z } from "zod";
import { paginatedResponseSchema, paginationQuerySchema } from "../../shared/pagination/pagination.schema.js";
import { flatStatusSchema } from "../flats/flats.schemas.js";

export const reservaStatusSchema = z.enum(["Confirmada", "Cancelada", "NoShow"]);

const reservaSubcategoriaSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string(),
  precoBase: z.number(),
  capacidadeMaxima: z.number().int().positive()
});

const reservaFlatSchema = z.object({
  id: z.number().int().positive(),
  numero: z.string(),
  statusOperacional: flatStatusSchema
});

const reservaHospedeResponsavelSchema = z.object({
  id: z.number().int().positive(),
  nomeCompleto: z.string(),
  cpf: z.string()
});

const reservaAcompanhanteSchema = z.object({
  id: z.number().int().positive(),
  nomeCompleto: z.string(),
  documento: z.string().nullable(),
  menorDeIdade: z.boolean()
});

export const reservaResponseSchema = z.object({
  id: z.number().int().positive(),
  flatId: z.number().int().positive(),
  flat: reservaFlatSchema,
  subcategoriaId: z.number().int().positive(),
  subcategoria: reservaSubcategoriaSchema,
  hospedeResponsavelId: z.number().int().positive(),
  hospedeResponsavel: reservaHospedeResponsavelSchema,
  acompanhantes: z.array(reservaAcompanhanteSchema),
  dataInicio: z.date(),
  dataFim: z.date(),
  status: reservaStatusSchema,
  quantidadeHospedes: z.number().int().positive(),
  cafeContratado: z.boolean(),
  valorBaseContratado: z.number(),
  valorCafePorPessoa: z.number(),
  valorCafeContratado: z.number(),
  valorTotalContratado: z.number(),
  observacoes: z.string().nullable(),
  criadoEm: z.date(),
  atualizadoEm: z.date()
});

export const reservasListResponseSchema = paginatedResponseSchema(reservaResponseSchema);

export const reservaParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const createReservaBodySchema = z.object({
  flatId: z.number().int().positive(),
  hospedeResponsavelId: z.number().int().positive(),
  acompanhanteIds: z.array(z.number().int().positive()).default([]),
  dataInicio: z.coerce.date(),
  dataFim: z.coerce.date(),
  cafeContratado: z.boolean().default(false),
  valorCafePorPessoa: z.number().nonnegative().default(0),
  observacoes: z.string().trim().optional()
});

export const reservasListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  flatId: z.coerce.number().int().positive().optional(),
  hospedeResponsavelId: z.coerce.number().int().positive().optional(),
  status: reservaStatusSchema.optional(),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
  sortField: z.enum(["dataInicio", "dataFim", "criadoEm", "atualizadoEm"]).default("dataInicio"),
  sortOrder: z.enum(["asc", "desc"]).default("asc")
});

export const disponibilidadeQuerySchema = paginationQuerySchema.extend({
  dataInicio: z.coerce.date(),
  dataFim: z.coerce.date(),
  categoriaId: z.coerce.number().int().positive().optional(),
  subcategoriaId: z.coerce.number().int().positive().optional()
});

export const disponibilidadeFlatResponseSchema = z.object({
  id: z.number().int().positive(),
  numero: z.string(),
  subcategoriaId: z.number().int().positive(),
  subcategoria: reservaSubcategoriaSchema,
  statusOperacional: flatStatusSchema,
  statusDisponibilidade: flatStatusSchema,
  disponivel: z.boolean()
});

export const disponibilidadeListResponseSchema = paginatedResponseSchema(disponibilidadeFlatResponseSchema);

export type CreateReservaBody = z.infer<typeof createReservaBodySchema>;
export type ReservasListQuery = z.infer<typeof reservasListQuerySchema>;
export type DisponibilidadeQuery = z.infer<typeof disponibilidadeQuerySchema>;
