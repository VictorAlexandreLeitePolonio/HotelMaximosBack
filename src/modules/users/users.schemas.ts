import { z } from "zod";
import { paginatedResponseSchema, paginationQuerySchema } from "../../shared/pagination/pagination.schema.js";

const perfilSchema = z.enum(["Admin", "Recepcionista"]);

export const userResponseSchema = z.object({
  id: z.number().int().positive(),
  login: z.string(),
  nomeCompleto: z.string(),
  email: z.string().nullable(),
  perfil: perfilSchema,
  ativo: z.boolean(),
  deveAlterarSenha: z.boolean(),
  criadoEm: z.date(),
  atualizadoEm: z.date()
});

export const usersListResponseSchema = paginatedResponseSchema(userResponseSchema);

export const usersListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  perfil: perfilSchema.optional(),
  ativo: z
    .preprocess((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    }, z.boolean())
    .optional(),
  sortField: z
    .enum(["login", "nomeCompleto", "email", "perfil", "ativo", "criadoEm", "atualizadoEm"])
    .default("criadoEm"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

export const userParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const createUserBodySchema = z.object({
  login: z.string().trim().min(1),
  nomeCompleto: z.string().trim().min(1),
  email: z.string().nullable().optional(),
  perfil: perfilSchema,
  senha: z.string().nullable().optional()
});

export const updateUserBodySchema = createUserBodySchema.partial();

export const updateUserStatusBodySchema = z.object({
  ativo: z.boolean()
});
