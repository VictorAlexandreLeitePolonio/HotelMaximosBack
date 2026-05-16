import { z } from "zod";
import { paginatedResponseSchema, paginationQuerySchema } from "../../shared/pagination/pagination.schema.js";

export const flatStatusSchema = z.enum([
  "Livre",
  "Reservado",
  "Ocupado",
  "AguardandoLimpeza",
  "Manutencao"
]);

export const flatCategoriaResumoSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string()
});

export const flatSubcategoriaResumoSchema = flatCategoriaResumoSchema.extend({
  precoBase: z.number(),
  capacidadeMaxima: z.number().int().positive()
});

export const flatResponseSchema = z.object({
  id: z.number().int().positive(),
  numero: z.string(),
  categoriaId: z.number().int().positive(),
  subcategoriaId: z.number().int().positive(),
  categoria: flatCategoriaResumoSchema,
  subcategoria: flatSubcategoriaResumoSchema,
  statusOperacional: flatStatusSchema,
  ativo: z.boolean(),
  criadoEm: z.date(),
  atualizadoEm: z.date()
});

export const flatsListResponseSchema = paginatedResponseSchema(flatResponseSchema);

export const flatParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const createFlatBodySchema = z.object({
  numero: z.string().trim().min(1),
  categoriaId: z.number().int().positive(),
  subcategoriaId: z.number().int().positive(),
  statusOperacional: flatStatusSchema.default("Livre")
});

export const updateFlatBodySchema = createFlatBodySchema.partial();

export const updateFlatStatusBodySchema = z.object({
  statusOperacional: flatStatusSchema
});

export const flatsListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  categoriaId: z.coerce.number().int().positive().optional(),
  subcategoriaId: z.coerce.number().int().positive().optional(),
  statusOperacional: flatStatusSchema.optional(),
  ativo: z
    .preprocess((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    }, z.boolean())
    .optional(),
  sortField: z.enum(["numero", "statusOperacional", "criadoEm", "atualizadoEm"]).default("numero"),
  sortOrder: z.enum(["asc", "desc"]).default("asc")
});

export type CreateFlatBody = z.infer<typeof createFlatBodySchema>;
export type UpdateFlatBody = z.infer<typeof updateFlatBodySchema>;
export type UpdateFlatStatusBody = z.infer<typeof updateFlatStatusBodySchema>;
export type FlatsListQuery = z.infer<typeof flatsListQuerySchema>;
