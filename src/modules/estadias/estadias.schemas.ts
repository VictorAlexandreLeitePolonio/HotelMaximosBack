import { z } from "zod";
import { paginatedResponseSchema, paginationQuerySchema } from "../../shared/pagination/pagination.schema.js";
import { errorResponseSchema } from "../../shared/errors/error-response.schema.js";
import { flatStatusSchema } from "../flats/flats.schemas.js";
import { reservaResponseSchema } from "../reservas/reservas.schemas.js";

export const formaPagamentoSchema = z.enum([
  "Pix",
  "Dinheiro",
  "CartaoCredito",
  "CartaoDebito",
  "Transferencia"
]);

export const statusEstadiaSchema = z.enum(["Ativa", "Encerrada"]);
export const statusCobrancaSchema = z.enum(["Pendente", "Paga", "Cancelada"]);
export const grupoCheckInSchema = z.enum(["Hoje", "Atrasado"]);

const estadiaSubcategoriaSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string(),
  precoBase: z.number(),
  capacidadeMaxima: z.number().int().positive()
});

const estadiaFlatSchema = z.object({
  id: z.number().int().positive(),
  numero: z.string(),
  statusOperacional: flatStatusSchema
});

const estadiaHospedeResponsavelSchema = z.object({
  id: z.number().int().positive(),
  nomeCompleto: z.string(),
  cpf: z.string()
});

const estadiaAcompanhanteSchema = z.object({
  id: z.number().int().positive(),
  nomeCompleto: z.string(),
  documento: z.string().nullable(),
  menorDeIdade: z.boolean()
});

export const estadiaResponseSchema = z.object({
  id: z.number().int().positive(),
  reservaId: z.number().int().positive().nullable(),
  flatId: z.number().int().positive(),
  flat: estadiaFlatSchema,
  subcategoriaId: z.number().int().positive(),
  subcategoria: estadiaSubcategoriaSchema,
  hospedeResponsavelId: z.number().int().positive(),
  hospedeResponsavel: estadiaHospedeResponsavelSchema,
  acompanhantes: z.array(estadiaAcompanhanteSchema),
  dataInicio: z.date(),
  dataFimPrevista: z.date(),
  dataFimEfetiva: z.date().nullable(),
  status: statusEstadiaSchema,
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

export const cobrancaResponseSchema = z.object({
  id: z.number().int().positive(),
  estadiaId: z.number().int().positive(),
  competenciaInicio: z.date(),
  competenciaFim: z.date(),
  valor: z.number(),
  status: statusCobrancaSchema,
  geradaEm: z.date(),
  liquidadaEm: z.date().nullable(),
  criadoEm: z.date(),
  atualizadoEm: z.date()
});

export const pagamentoResponseSchema = z.object({
  id: z.number().int().positive(),
  cobrancaId: z.number().int().positive(),
  usuarioId: z.number().int().positive(),
  caixaId: z.number().int().positive(),
  formaPagamento: formaPagamentoSchema,
  valor: z.number(),
  comprovante: z.string().nullable(),
  criadoEm: z.date(),
  atualizadoEm: z.date()
});

export const checkInResponseSchema = z.object({
  reserva: reservaResponseSchema,
  estadia: estadiaResponseSchema,
  cobranca: cobrancaResponseSchema,
  pagamento: pagamentoResponseSchema
});

export const estadiaParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const checkInFromReservationBodySchema = z.object({
  dataInicioEfetiva: z.coerce.date().optional(),
  dataFimPrevista: z.coerce.date().optional(),
  formaPagamento: formaPagamentoSchema,
  valorPago: z.number().nonnegative(),
  comprovante: z.string().trim().optional(),
  observacoes: z.string().trim().optional()
});

export const directCheckInBodySchema = z.object({
  flatId: z.number().int().positive(),
  hospedeResponsavelId: z.number().int().positive(),
  acompanhanteIds: z.array(z.number().int().positive()).default([]),
  dataInicio: z.coerce.date().optional(),
  dataFimPrevista: z.coerce.date().optional(),
  cafeContratado: z.boolean().default(false),
  valorCafePorPessoa: z.number().nonnegative().default(0),
  formaPagamento: formaPagamentoSchema,
  valorPago: z.number().nonnegative(),
  comprovante: z.string().trim().optional(),
  observacoes: z.string().trim().optional()
});

export const checkInDoDiaQuerySchema = paginationQuerySchema.extend({
  grupo: grupoCheckInSchema.optional(),
  referenceDate: z.coerce.date().optional()
});

export const checkInDoDiaItemSchema = reservaResponseSchema.extend({
  grupoCheckIn: grupoCheckInSchema
});

export const checkInDoDiaListResponseSchema = paginatedResponseSchema(checkInDoDiaItemSchema);

export const activeStaysQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  flatId: z.coerce.number().int().positive().optional(),
  hospedeResponsavelId: z.coerce.number().int().positive().optional(),
  sortField: z.enum(["dataInicio", "dataFimPrevista", "criadoEm", "atualizadoEm"]).default("dataInicio"),
  sortOrder: z.enum(["asc", "desc"]).default("asc")
});

export const activeStaysResponseSchema = paginatedResponseSchema(estadiaResponseSchema);

export const transferFlatBodySchema = z.object({
  novoFlatId: z.number().int().positive(),
  observacoes: z.string().trim().optional()
});

export const renewStayBodySchema = z.object({
  dataFimPrevista: z.coerce.date(),
  observacoes: z.string().trim().optional()
});

export const estadiasErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema
};

export type CheckInFromReservationBody = z.infer<typeof checkInFromReservationBodySchema>;
export type DirectCheckInBody = z.infer<typeof directCheckInBodySchema>;
export type CheckInDoDiaQuery = z.infer<typeof checkInDoDiaQuerySchema>;
export type ActiveStaysQuery = z.infer<typeof activeStaysQuerySchema>;
export type TransferFlatBody = z.infer<typeof transferFlatBodySchema>;
export type RenewStayBody = z.infer<typeof renewStayBodySchema>;
