import { z } from "zod";
import {
  paginatedResponseSchema,
  paginationQuerySchema
} from "../../shared/pagination/pagination.schema.js";

export const acompanhanteBodySchema = z
  .object({
    id: z.number().int().positive().optional(),
    nomeCompleto: z.string().trim().min(1),
    documento: z.string().trim().optional(),
    menorDeIdade: z.boolean().default(false)
  })
  .superRefine((value, ctx) => {
    const documento = value.documento?.trim() ?? "";

    if (!value.menorDeIdade && documento.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documento"],
        message: "Documento e obrigatorio para acompanhantes maiores de idade."
      });
    }
  });

export const hospedeResponseSchema = z.object({
  id: z.number().int().positive(),
  nomeCompleto: z.string(),
  cpf: z.string(),
  email: z.string(),
  endereco: z.string(),
  telefone: z.string(),
  documento: z.string(),
  empresa: z.string().nullable(),
  ativo: z.boolean(),
  criadoEm: z.date(),
  atualizadoEm: z.date(),
  acompanhantes: z.array(
    z.object({
      id: z.number().int().positive(),
      nomeCompleto: z.string(),
      documento: z.string().nullable(),
      menorDeIdade: z.boolean(),
      criadoEm: z.date(),
      atualizadoEm: z.date()
    })
  )
});

export const hospedeListItemSchema = hospedeResponseSchema.omit({
  acompanhantes: true
}).extend({
  acompanhantesCount: z.number().int().nonnegative()
});

export const hospedesListResponseSchema = paginatedResponseSchema(hospedeListItemSchema);

export const hospedeParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const createHospedeBodySchema = z.object({
  nomeCompleto: z.string().trim().min(1),
  cpf: z.string().trim().min(1),
  email: z.string().trim().email(),
  endereco: z.string().trim().min(1),
  telefone: z.string().trim().min(1),
  documento: z.string().trim().min(1),
  empresa: z.string().trim().optional(),
  acompanhantes: z.array(acompanhanteBodySchema).default([])
});

export const updateHospedeBodySchema = createHospedeBodySchema.partial();

export const hospedesListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  cpf: z.string().optional(),
  ativo: z
    .preprocess((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    }, z.boolean())
    .optional(),
  sortField: z.enum(["nomeCompleto", "cpf", "email", "criadoEm", "atualizadoEm"]).default("criadoEm"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

export type CreateHospedeBody = z.infer<typeof createHospedeBodySchema>;
export type UpdateHospedeBody = z.infer<typeof updateHospedeBodySchema>;
export type HospedesListQuery = z.infer<typeof hospedesListQuerySchema>;
