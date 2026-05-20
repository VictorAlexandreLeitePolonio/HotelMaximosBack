import { z } from "zod";
import { errorResponseSchema } from "../../shared/errors/error-response.schema.js";
import { paginatedResponseSchema, paginationQuerySchema } from "../../shared/pagination/pagination.schema.js";
import {
  multipartBooleanField,
  multipartDateField,
  multipartNumberField,
  multipartStringField,
  optionalMultipartFileSchema,
  unwrapMultipartValue
} from "../../shared/multipart/multipart-fields.js";

export const formaPagamentoSchema = z.enum([
  "Pix",
  "Dinheiro",
  "CartaoCredito",
  "CartaoDebito",
  "Transferencia"
]);

export const statusCobrancaSchema = z.enum(["Pendente", "Paga", "Cancelada"]);
export const origemCobrancaSchema = z.enum(["Mensalidade", "Extra"]);
export const statusEstadiaSchema = z.enum(["Ativa", "Encerrada"]);
export const statusEstadiaExtraSchema = z.enum(["Pendente", "Pago"]);

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

export const cobrancaResponseSchema = z.object({
  id: z.number().int().positive(),
  estadiaId: z.number().int().positive(),
  origem: origemCobrancaSchema,
  estadiaExtraId: z.number().int().positive().nullable(),
  competenciaInicio: z.date(),
  competenciaFim: z.date(),
  valor: z.number(),
  status: statusCobrancaSchema,
  geradaEm: z.date(),
  liquidadaEm: z.date().nullable(),
  criadoEm: z.date(),
  atualizadoEm: z.date(),
  pagamentos: z.array(pagamentoResponseSchema)
});

export const tipoExtraSummarySchema = z.object({
  id: z.number().int().positive(),
  nome: z.string(),
  ativo: z.boolean()
});

export const tipoExtraResponseSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string(),
  valorPadrao: z.number(),
  ativo: z.boolean(),
  criadoEm: z.date(),
  atualizadoEm: z.date()
});

export const estadiaFinanceiroItemSchema = z.object({
  id: z.number().int().positive(),
  status: statusEstadiaSchema,
  dataInicio: z.date(),
  dataFimPrevista: z.date(),
  dataFimEfetiva: z.date().nullable(),
  valorTotalContratado: z.number()
});

export const estadiaExtraResponseSchema = z.object({
  id: z.number().int().positive(),
  estadiaId: z.number().int().positive(),
  tipoExtraId: z.number().int().positive(),
  tipoExtra: tipoExtraSummarySchema,
  descricaoSnapshot: z.string(),
  valorUnitario: z.number(),
  quantidade: z.number().int().positive(),
  valorTotal: z.number(),
  status: statusEstadiaExtraSchema,
  pagoEm: z.date().nullable(),
  criadoEm: z.date(),
  atualizadoEm: z.date(),
  cobranca: cobrancaResponseSchema.nullable()
});

export const stayFinancialResponseSchema = z.object({
  estadia: estadiaFinanceiroItemSchema,
  cobrancas: z.array(cobrancaResponseSchema),
  extras: z.array(estadiaExtraResponseSchema)
});

export const chargePaymentResponseSchema = z.object({
  cobranca: cobrancaResponseSchema,
  pagamento: pagamentoResponseSchema,
  extra: estadiaExtraResponseSchema.nullable()
});

export const stayExtraMutationResponseSchema = z.object({
  extra: estadiaExtraResponseSchema,
  cobranca: cobrancaResponseSchema,
  pagamento: pagamentoResponseSchema.nullable()
});

export const generatedChargesResponseSchema = z.object({
  estadia: estadiaFinanceiroItemSchema,
  cobrancasGeradas: z.array(cobrancaResponseSchema)
});

export const extraTypeParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const extraTypesListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  ativo: z.preprocess(unwrapMultipartValue, z.coerce.boolean().optional()),
  sortField: z.enum(["nome", "valorPadrao", "criadoEm", "atualizadoEm"]).default("nome"),
  sortOrder: z.enum(["asc", "desc"]).default("asc")
});

export const createExtraTypeBodySchema = z.object({
  nome: z.string().trim().min(1),
  valorPadrao: z.number().nonnegative()
});

export const updateExtraTypeBodySchema = createExtraTypeBodySchema.partial();

export const financeEstadiaParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const chargeParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const extraParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const generateMonthlyChargesBodySchema = z.object({
  referenceDate: multipartDateField(z.coerce.date()).optional()
});

export const payChargeBodySchema = z.object({
  formaPagamento: multipartStringField(formaPagamentoSchema),
  valorPago: multipartNumberField(z.coerce.number().nonnegative()),
  comprovante: multipartStringField(z.string().trim()).optional(),
  comprovanteArquivo: optionalMultipartFileSchema
});

export const createStayExtraBodySchema = z.object({
  tipoExtraId: multipartNumberField(z.coerce.number().int().positive()),
  descricao: multipartStringField(z.string().trim()).optional(),
  valorUnitario: multipartNumberField(z.coerce.number().nonnegative()).optional(),
  quantidade: multipartNumberField(z.coerce.number().int().positive()).optional(),
  pagarAgora: multipartBooleanField(false).optional(),
  formaPagamento: multipartStringField(formaPagamentoSchema).optional(),
  valorPago: multipartNumberField(z.coerce.number().nonnegative()).optional(),
  comprovante: multipartStringField(z.string().trim()).optional(),
  comprovanteArquivo: optionalMultipartFileSchema
});

export const payExtraBodySchema = z.object({
  formaPagamento: multipartStringField(formaPagamentoSchema),
  valorPago: multipartNumberField(z.coerce.number().nonnegative()),
  comprovante: multipartStringField(z.string().trim()).optional(),
  comprovanteArquivo: optionalMultipartFileSchema
});

export const financeiroErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  413: errorResponseSchema
};

export type ExtraTypesListQuery = z.infer<typeof extraTypesListQuerySchema>;
export type CreateExtraTypeBody = z.infer<typeof createExtraTypeBodySchema>;
export type UpdateExtraTypeBody = z.infer<typeof updateExtraTypeBodySchema>;
export type GenerateMonthlyChargesBody = z.infer<typeof generateMonthlyChargesBodySchema>;
export type PayChargeBody = z.infer<typeof payChargeBodySchema>;
export type CreateStayExtraBody = z.infer<typeof createStayExtraBodySchema>;
export type PayExtraBody = z.infer<typeof payExtraBodySchema>;
