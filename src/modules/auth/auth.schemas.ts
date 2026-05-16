import { z } from "zod";

export const safeAuthUserSchema = z.object({
  id: z.number().int().positive(),
  login: z.string(),
  nomeCompleto: z.string(),
  email: z.string().nullable(),
  perfil: z.enum(["Admin", "Recepcionista"]),
  ativo: z.boolean(),
  deveAlterarSenha: z.boolean()
});

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: safeAuthUserSchema
});

export const loginBodySchema = z.object({
  login: z.string().trim().min(1),
  senha: z.string().min(1)
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1)
});

export const logoutBodySchema = refreshBodySchema;

export const changePasswordBodySchema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z.string().min(8)
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type LogoutBody = z.infer<typeof logoutBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
