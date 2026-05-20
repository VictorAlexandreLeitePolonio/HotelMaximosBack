import { z } from "zod";
import { errorResponseSchema } from "../../shared/errors/error-response.schema.js";
import { paginatedResponseSchema, paginationQuerySchema } from "../../shared/pagination/pagination.schema.js";

export const cashRegisterPaymentMethodSchema = z.enum([
  "Pix",
  "Dinheiro",
  "CartaoCredito",
  "CartaoDebito",
  "Transferencia"
]);

const profileSchema = z.enum(["Admin", "Recepcionista"]);

export const cashBreakdownValueSchema = z.object({
  formaPagamento: cashRegisterPaymentMethodSchema,
  valor: z.number()
});

export const cashRegisterUserResponseSchema = z.object({
  id: z.number().int().positive(),
  login: z.string(),
  nomeCompleto: z.string(),
  perfil: profileSchema
});

export const cashRegisterPaymentResponseSchema = z.object({
  id: z.number().int().positive(),
  cobrancaId: z.number().int().positive(),
  estadiaId: z.number().int().positive(),
  estadiaExtraId: z.number().int().positive().nullable(),
  origemCobranca: z.enum(["Mensalidade", "Extra"]),
  usuarioId: z.number().int().positive(),
  caixaId: z.number().int().positive(),
  formaPagamento: cashRegisterPaymentMethodSchema,
  valor: z.number(),
  comprovante: z.string().nullable(),
  criadoEm: z.date(),
  atualizadoEm: z.date()
});

export const cashRegisterAdjustmentResponseSchema = z.object({
  id: z.number().int().positive(),
  caixaId: z.number().int().positive(),
  usuario: cashRegisterUserResponseSchema,
  motivo: z.string(),
  observacoes: z.string().nullable(),
  valores: z.array(cashBreakdownValueSchema),
  criadoEm: z.date()
});

export const cashRegisterSummaryItemSchema = z.object({
  formaPagamento: cashRegisterPaymentMethodSchema,
  valorCalculado: z.number(),
  valorConferido: z.number().nullable(),
  diferenca: z.number().nullable(),
  valorAjuste: z.number(),
  valorFinal: z.number()
});

export const cashRegisterSummarySchema = z.object({
  itens: z.array(cashRegisterSummaryItemSchema),
  totalCalculado: z.number(),
  totalConferido: z.number().nullable(),
  diferencaTotal: z.number().nullable(),
  totalAjustes: z.number(),
  totalFinal: z.number()
});

export const cashRegisterResponseSchema = z.object({
  id: z.number().int().positive(),
  usuario: cashRegisterUserResponseSchema,
  turno: z.string().nullable(),
  status: z.enum(["Aberto", "Fechado"]),
  abertoEm: z.date(),
  fechadoEm: z.date().nullable(),
  observacoesFechamento: z.string().nullable(),
  criadoEm: z.date(),
  atualizadoEm: z.date(),
  pagamentos: z.array(cashRegisterPaymentResponseSchema),
  ajustes: z.array(cashRegisterAdjustmentResponseSchema),
  resumoFechamento: cashRegisterSummarySchema.nullable()
});

export const cashRegisterListItemResponseSchema = z.object({
  id: z.number().int().positive(),
  usuario: cashRegisterUserResponseSchema,
  turno: z.string().nullable(),
  status: z.enum(["Aberto", "Fechado"]),
  abertoEm: z.date(),
  fechadoEm: z.date().nullable(),
  criadoEm: z.date(),
  atualizadoEm: z.date(),
  resumoFechamento: cashRegisterSummarySchema.nullable()
});

export const myCashRegisterResponseSchema = z.object({
  caixa: cashRegisterResponseSchema.nullable()
});

export const openCashRegisterBodySchema = z.object({
  turno: z.string().trim().min(1)
});

export const cashRegisterParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const closeCashRegisterBodySchema = z.object({
  valoresConferidos: z.array(cashBreakdownValueSchema).max(5),
  observacoes: z.string().trim().optional()
});

export const createCashRegisterAdjustmentBodySchema = z.object({
  motivo: z.string().trim().min(1),
  observacoes: z.string().trim().optional(),
  valores: z.array(cashBreakdownValueSchema).max(5)
});

export const closedCashRegistersListQuerySchema = paginationQuerySchema.extend({
  usuarioId: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

export const closedCashRegistersListResponseSchema = paginatedResponseSchema(
  cashRegisterListItemResponseSchema
);

export const caixasErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema
};

export type OpenCashRegisterBody = z.infer<typeof openCashRegisterBodySchema>;
export type CloseCashRegisterBody = z.infer<typeof closeCashRegisterBodySchema>;
export type CreateCashRegisterAdjustmentBody = z.infer<typeof createCashRegisterAdjustmentBodySchema>;
export type ClosedCashRegistersListQuery = z.infer<typeof closedCashRegistersListQuerySchema>;
