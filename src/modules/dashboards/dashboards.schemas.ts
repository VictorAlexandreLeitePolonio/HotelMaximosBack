import { z } from "zod";
import { errorResponseSchema } from "../../shared/errors/error-response.schema.js";
import { paginatedResponseSchema, paginationQuerySchema } from "../../shared/pagination/pagination.schema.js";
import { flatStatusSchema } from "../flats/flats.schemas.js";

export const dashboardAlertTypeSchema = z.enum([
  "CheckInAtrasado",
  "EstadiaVencendo",
  "EstadiaVencida",
  "LimpezaPendente",
  "LimpezaAtrasada",
  "LimpezaSuspensa"
]);

export const dashboardAlertSeveritySchema = z.enum(["warning", "critical"]);
export const dashboardPaymentMethodSchema = z.enum([
  "Pix",
  "Dinheiro",
  "CartaoCredito",
  "CartaoDebito",
  "Transferencia"
]);
export const flatHistoryTypeSchema = z.enum([
  "CheckIn",
  "CheckOut",
  "TransferenciaSaida",
  "TransferenciaEntrada",
  "Renovacao",
  "ManutencaoIniciada",
  "ManutencaoFinalizada",
  "NoShowManual",
  "ObservacaoOperacional",
  "ObservacaoOperacionalCorrigida",
  "ObservacaoOperacionalCancelada"
]);

export const dashboardUserSchema = z.object({
  id: z.number().int().positive(),
  login: z.string(),
  nomeCompleto: z.string(),
  perfil: z.enum(["Admin", "Recepcionista"])
});

export const dashboardAlertSchema = z.object({
  tipo: dashboardAlertTypeSchema,
  severidade: dashboardAlertSeveritySchema,
  titulo: z.string(),
  descricao: z.string(),
  referencia: z.object({
    flatId: z.number().int().positive().nullable(),
    reservaId: z.number().int().positive().nullable(),
    estadiaId: z.number().int().positive().nullable(),
    limpezaId: z.number().int().positive().nullable()
  }),
  ocorridoEm: z.date()
});

export const operationalDashboardResponseSchema = z.object({
  generatedAt: z.date(),
  resumo: z.object({
    flatsPorStatus: z.object({
      Livre: z.number().int().nonnegative(),
      Reservado: z.number().int().nonnegative(),
      Ocupado: z.number().int().nonnegative(),
      AguardandoLimpeza: z.number().int().nonnegative(),
      Manutencao: z.number().int().nonnegative()
    }),
    estadiasAtivas: z.number().int().nonnegative(),
    checkInsHoje: z.number().int().nonnegative(),
    checkInsAtrasados: z.number().int().nonnegative(),
    reservasRequerRealocacao: z.number().int().nonnegative(),
    limpezasAbertas: z.number().int().nonnegative()
  }),
  avisos: z.array(dashboardAlertSchema)
});

export const financialDashboardPaymentSchema = z.object({
  formaPagamento: dashboardPaymentMethodSchema,
  quantidade: z.number().int().nonnegative(),
  valor: z.number()
});

export const financialDashboardResponseSchema = z.object({
  generatedAt: z.date(),
  resumo: z.object({
    totalCobrancasPendentes: z.number().int().nonnegative(),
    valorCobrancasPendentes: z.number(),
    totalExtrasPendentes: z.number().int().nonnegative(),
    valorExtrasPendentes: z.number(),
    totalPagamentosHoje: z.number().int().nonnegative(),
    valorPagamentosHoje: z.number(),
    totalCaixasAbertos: z.number().int().nonnegative(),
    totalCaixasFechadosHoje: z.number().int().nonnegative()
  }),
  pagamentosHojePorForma: z.array(financialDashboardPaymentSchema)
});

export const noShowReservationResponseSchema = z.object({
  id: z.number().int().positive(),
  flatId: z.number().int().positive(),
  status: z.enum(["Confirmada", "RequerRealocacao", "Cancelada", "NoShow"]),
  dataInicio: z.date(),
  dataFim: z.date()
});

export const flatHistoryResponseSchema = z.object({
  id: z.number().int().positive(),
  flatId: z.number().int().positive(),
  estadiaId: z.number().int().positive().nullable(),
  usuario: dashboardUserSchema.nullable(),
  tipo: flatHistoryTypeSchema,
  descricao: z.string(),
  metadata: z.unknown().nullable(),
  criadoEm: z.date()
});

export const flatHistoryListResponseSchema = paginatedResponseSchema(flatHistoryResponseSchema);

export const markNoShowBodySchema = z.object({
  motivo: z.string().trim().min(1),
  observacoes: z.string().trim().optional()
});

export const markNoShowResponseSchema = z.object({
  reserva: noShowReservationResponseSchema,
  historico: flatHistoryResponseSchema
});

export const flatParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const reservationParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const flatHistoryParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  historicoId: z.coerce.number().int().positive()
});

export const createOperationalObservationBodySchema = z.object({
  descricao: z.string().trim().min(1),
  observacoes: z.string().trim().optional()
});

export const correctOperationalObservationBodySchema = z.object({
  descricaoCorrigida: z.string().trim().min(1),
  motivo: z.string().trim().min(1),
  observacoes: z.string().trim().optional()
});

export const cancelOperationalObservationBodySchema = z.object({
  motivo: z.string().trim().min(1),
  observacoes: z.string().trim().optional()
});

export const flatHistoryListQuerySchema = paginationQuerySchema;

export const dashboardsErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema
};

export type MarkNoShowBody = z.infer<typeof markNoShowBodySchema>;
export type CreateOperationalObservationBody = z.infer<typeof createOperationalObservationBodySchema>;
export type CorrectOperationalObservationBody = z.infer<typeof correctOperationalObservationBodySchema>;
export type CancelOperationalObservationBody = z.infer<typeof cancelOperationalObservationBodySchema>;
export type FlatHistoryListQuery = z.infer<typeof flatHistoryListQuerySchema>;

