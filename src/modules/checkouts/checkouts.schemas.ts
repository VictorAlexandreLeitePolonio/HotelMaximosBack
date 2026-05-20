import { z } from "zod";
import { errorResponseSchema } from "../../shared/errors/error-response.schema.js";
import {
  cobrancaResponseSchema,
  estadiaExtraResponseSchema
} from "../financeiro/financeiro.schemas.js";
import { estadiaResponseSchema } from "../estadias/estadias.schemas.js";

export const checkoutItemStatusSchema = z.enum(["Pendente", "Pago", "Cancelada"]);

export const checkoutBodySchema = z.object({
  motivoOverride: z.string().trim().min(1).optional()
});

export const checkoutParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const checkoutReceiptItemSchema = z.object({
  tipo: z.enum(["Mensalidade", "Extra"]),
  descricao: z.string(),
  valor: z.number(),
  status: checkoutItemStatusSchema
});

export const checkoutReceiptSchema = z.object({
  numero: z.string(),
  geradoEm: z.date(),
  avisoImpressao: z.string(),
  downloadUrl: z.string(),
  hospedeResponsavel: z.object({
    id: z.number().int().positive(),
    nomeCompleto: z.string(),
    cpf: z.string()
  }),
  flat: z.object({
    id: z.number().int().positive(),
    numero: z.string()
  }),
  periodo: z.object({
    dataInicio: z.date(),
    dataFimPrevista: z.date(),
    dataFimEfetiva: z.date()
  }),
  totais: z.object({
    totalCobrado: z.number(),
    totalPago: z.number(),
    totalPendente: z.number()
  }),
  itens: z.array(checkoutReceiptItemSchema)
});

export const checkoutResponseSchema = z.object({
  estadia: estadiaResponseSchema,
  resumoFinanceiro: z.object({
    totalCobrado: z.number(),
    totalPago: z.number(),
    totalPendente: z.number(),
    cobrancasPendentes: z.array(cobrancaResponseSchema),
    extrasPendentes: z.array(estadiaExtraResponseSchema)
  }),
  override: z.object({
    aplicado: z.boolean(),
    motivo: z.string().nullable(),
    autorizadoPor: z
      .object({
        id: z.number().int().positive(),
        nomeCompleto: z.string(),
        perfil: z.enum(["Admin", "Recepcionista"])
      })
      .nullable()
  }),
  recibo: checkoutReceiptSchema,
  avisoImpressao: z.string()
});

export const checkoutsErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema
};

export type CheckoutBody = z.infer<typeof checkoutBodySchema>;
