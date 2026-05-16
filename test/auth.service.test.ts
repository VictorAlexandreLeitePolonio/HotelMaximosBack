import { describe, expect, it } from "vitest";
import { AppError } from "../src/shared/errors/app-error.js";
import { verifyPassword, hashPassword } from "../src/shared/auth/password.js";
import { AuthService, type AuthRepository, type AuthUserRecord } from "../src/modules/auth/auth.service.js";
import { hashRefreshToken } from "../src/modules/auth/refresh-token.helpers.js";

type StoredRefreshToken = {
  id: number;
  tokenHash: string;
  usuarioId: number;
  familiaSessaoId: string;
  expiraEm: Date;
  revogadoEm: Date | null;
  substituidoPorTokenHash: string | null;
  usuario: AuthUserRecord;
};

class FakeAuthRepository implements AuthRepository {
  users: AuthUserRecord[] = [];
  refreshTokens: StoredRefreshToken[] = [];

  async findUserByNormalizedLogin(loginNormalizado: string) {
    return this.users.find((user) => user.loginNormalizado === loginNormalizado) ?? null;
  }

  async findActiveUserById(id: number) {
    const user = this.users.find((item) => item.id === id && item.ativo);
    return user ?? null;
  }

  async findRefreshTokenByHash(tokenHash: string) {
    return this.refreshTokens.find((token) => token.tokenHash === tokenHash) ?? null;
  }

  async createRefreshToken(data: {
    tokenHash: string;
    usuarioId: number;
    familiaSessaoId: string;
    expiraEm: Date;
  }) {
    const usuario = this.users.find((user) => user.id === data.usuarioId);

    if (!usuario) {
      throw new Error("Usuario fake nao encontrado.");
    }

    this.refreshTokens.push({
      id: this.refreshTokens.length + 1,
      ...data,
      revogadoEm: null,
      substituidoPorTokenHash: null,
      usuario
    });
  }

  async revokeRefreshToken(id: number, substituidoPorTokenHash?: string) {
    const token = this.refreshTokens.find((item) => item.id === id);

    if (token) {
      token.revogadoEm = new Date();
      token.substituidoPorTokenHash = substituidoPorTokenHash ?? null;
    }
  }

  async revokeActiveRefreshTokensByFamily(familiaSessaoId: string) {
    this.refreshTokens
      .filter((token) => token.familiaSessaoId === familiaSessaoId && !token.revogadoEm)
      .forEach((token) => {
        token.revogadoEm = new Date();
      });
  }

  async updatePassword(usuarioId: number, senhaHash: string) {
    const user = this.users.find((item) => item.id === usuarioId);

    if (!user) {
      throw new Error("Usuario fake nao encontrado.");
    }

    user.senhaHash = senhaHash;
    user.deveAlterarSenha = false;
  }
}

async function createUser(overrides: Partial<AuthUserRecord> = {}): Promise<AuthUserRecord> {
  return {
    id: 1,
    login: "admin",
    loginNormalizado: "admin",
    nomeCompleto: "Administrador Local",
    email: null,
    senhaHash: await hashPassword("Admin123!"),
    perfil: "Admin",
    ativo: true,
    deveAlterarSenha: true,
    ...overrides
  };
}

describe("AuthService", () => {
  it("authenticates login and senha returning tokens and a safe user", async () => {
    const repository = new FakeAuthRepository();
    repository.users.push(await createUser());

    const result = await new AuthService(repository).login({
      login: " ADMIN ",
      senha: "Admin123!"
    });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user).toEqual({
      id: 1,
      login: "admin",
      nomeCompleto: "Administrador Local",
      email: null,
      perfil: "Admin",
      ativo: true,
      deveAlterarSenha: true
    });
    expect(repository.refreshTokens[0].tokenHash).toBe(hashRefreshToken(result.refreshToken));
    expect(repository.refreshTokens[0].tokenHash).not.toBe(result.refreshToken);
  });

  it("rejects invalid credentials with AUTH_002", async () => {
    const repository = new FakeAuthRepository();
    repository.users.push(await createUser());

    await expect(
      new AuthService(repository).login({ login: "admin", senha: "errada" })
    ).rejects.toMatchObject<AppError>({
      code: "AUTH_002",
      statusCode: 401
    });
  });

  it("rotates refresh tokens and revokes the old token", async () => {
    const repository = new FakeAuthRepository();
    repository.users.push(await createUser());
    const service = new AuthService(repository);
    const login = await service.login({ login: "admin", senha: "Admin123!" });

    const refreshed = await service.refresh({ refreshToken: login.refreshToken });

    expect(refreshed.refreshToken).not.toBe(login.refreshToken);
    expect(repository.refreshTokens[0].revogadoEm).toBeInstanceOf(Date);
    expect(repository.refreshTokens[0].substituidoPorTokenHash).toBe(
      hashRefreshToken(refreshed.refreshToken)
    );
  });

  it("rejects reused revoked refresh tokens and revokes the session family", async () => {
    const repository = new FakeAuthRepository();
    repository.users.push(await createUser());
    const service = new AuthService(repository);
    const login = await service.login({ login: "admin", senha: "Admin123!" });
    await service.refresh({ refreshToken: login.refreshToken });

    await expect(service.refresh({ refreshToken: login.refreshToken })).rejects.toMatchObject({
      code: "AUTH_004",
      statusCode: 401
    });
    expect(repository.refreshTokens.every((token) => token.revogadoEm)).toBe(true);
  });

  it("invalidates refresh token on logout", async () => {
    const repository = new FakeAuthRepository();
    repository.users.push(await createUser());
    const service = new AuthService(repository);
    const login = await service.login({ login: "admin", senha: "Admin123!" });

    await service.logout({ refreshToken: login.refreshToken });

    expect(repository.refreshTokens[0].revogadoEm).toBeInstanceOf(Date);
  });

  it("changes password after validating current password and strength", async () => {
    const repository = new FakeAuthRepository();
    repository.users.push(await createUser());

    await new AuthService(repository).changePassword(1, {
      senhaAtual: "Admin123!",
      novaSenha: "MinhaSenha123!"
    });

    expect(repository.users[0].deveAlterarSenha).toBe(false);
    await expect(verifyPassword("MinhaSenha123!", repository.users[0].senhaHash)).resolves.toBe(true);
  });
});
