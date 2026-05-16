import { z } from "zod";
import { paginatedResponseSchema, paginationQuerySchema } from "../../shared/pagination/pagination.schema.js";

const precoBaseSchema = z.coerce.number().finite().min(0);

export const categoriaResponseSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string(),
  ativo: z.boolean(),
  criadoEm: z.date(),
  atualizadoEm: z.date()
});

export const subcategoriaResponseSchema = z.object({
  id: z.number().int().positive(),
  categoriaId: z.number().int().positive(),
  categoriaNome: z.string(),
  nome: z.string(),
  precoBase: z.number(),
  capacidadeMaxima: z.number().int().positive(),
  ativo: z.boolean(),
  criadoEm: z.date(),
  atualizadoEm: z.date()
});

export const categoriasListResponseSchema = paginatedResponseSchema(categoriaResponseSchema);
export const subcategoriasListResponseSchema = paginatedResponseSchema(subcategoriaResponseSchema);

export const categoriaParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const categoriaBodySchema = z.object({
  nome: z.string().trim().min(1)
});

export const updateCategoriaBodySchema = categoriaBodySchema.partial();

export const categoriasListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  ativo: z
    .preprocess((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    }, z.boolean())
    .optional(),
  sortField: z.enum(["nome", "criadoEm", "atualizadoEm"]).default("nome"),
  sortOrder: z.enum(["asc", "desc"]).default("asc")
});

export const subcategoriaBodySchema = z.object({
  categoriaId: z.number().int().positive(),
  nome: z.string().trim().min(1),
  precoBase: precoBaseSchema,
  capacidadeMaxima: z.coerce.number().int().positive()
});

export const updateSubcategoriaBodySchema = subcategoriaBodySchema.partial();

export const subcategoriasListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  categoriaId: z.coerce.number().int().positive().optional(),
  ativo: z
    .preprocess((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    }, z.boolean())
    .optional(),
  sortField: z.enum(["nome", "precoBase", "capacidadeMaxima", "criadoEm", "atualizadoEm"]).default("nome"),
  sortOrder: z.enum(["asc", "desc"]).default("asc")
});

export type CategoriaBody = z.infer<typeof categoriaBodySchema>;
export type UpdateCategoriaBody = z.infer<typeof updateCategoriaBodySchema>;
export type CategoriasListQuery = z.infer<typeof categoriasListQuerySchema>;
export type SubcategoriaBody = z.infer<typeof subcategoriaBodySchema>;
export type UpdateSubcategoriaBody = z.infer<typeof updateSubcategoriaBodySchema>;
export type SubcategoriasListQuery = z.infer<typeof subcategoriasListQuerySchema>;
