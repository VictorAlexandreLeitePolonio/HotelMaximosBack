import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import { assertAdminUser, getAuthenticatedUser } from "../src/modules/auth/auth.guards.js";
import type { AuthRepository, AuthUserRecord } from "../src/modules/auth/auth.service.js";

function createRepository(user: AuthUserRecord | null): AuthRepository {
  return {
    findUserByNormalizedLogin: async () => null,
    findActiveUserById: async () => user,
    findRefreshTokenByHash: async () => null,
    createRefreshToken: async () => undefined,
    revokeRefreshToken: async () => undefined,
    revokeActiveRefreshTokensByFamily: async () => undefined,
    updatePassword: async () => undefined
  };
}

function createRequest(token: string): FastifyRequest {
  return {
    headers: {
      authorization: `Bearer ${token}`
    }
  } as FastifyRequest;
}

const adminUser: AuthUserRecord = {
  id: 1,
  login: "admin",
  loginNormalizado: "admin",
  nomeCompleto: "Administrador Local",
  email: null,
  senhaHash: "hash",
  perfil: "Admin",
  ativo: true,
  deveAlterarSenha: false
};

describe("auth guards", () => {
  it("revalidates authenticated user active state from backend state", async () => {
    const token = signAccessToken({ sub: "1", perfil: "Admin" });

    await expect(
      getAuthenticatedUser(createRequest(token), createRepository(null))
    ).rejects.toMatchObject({
      code: "AUTH_004",
      statusCode: 401
    });
  });

  it("allows Admin profile from trusted backend state", () => {
    expect(() => assertAdminUser(adminUser)).not.toThrow();
  });

  it("rejects stale non-Admin profile from trusted backend state with 403", () => {
    expect(() =>
      assertAdminUser({
        ...adminUser,
        perfil: "Recepcionista"
      })
    ).toThrow(expect.objectContaining({ code: "FORBIDDEN", statusCode: 403 }));
  });
});
