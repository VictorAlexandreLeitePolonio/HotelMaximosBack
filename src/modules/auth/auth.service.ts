import { randomBytes, randomUUID } from "node:crypto";
import { AppError } from "../../shared/errors/app-error.js";
import { hashPassword, verifyPassword } from "../../shared/auth/password.js";
import { signAccessToken } from "../../shared/auth/jwt.js";
import { normalizeLogin } from "../users/users.helpers.js";
import { hashRefreshToken } from "./refresh-token.helpers.js";

export type PerfilUsuario = "Admin" | "Recepcionista";

export type AuthUserRecord = {
  id: number;
  login: string;
  loginNormalizado: string;
  nomeCompleto: string;
  email: string | null;
  senhaHash: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  deveAlterarSenha: boolean;
};

export type AuthRefreshTokenRecord = {
  id: number;
  tokenHash: string;
  usuarioId: number;
  familiaSessaoId: string;
  expiraEm: Date;
  revogadoEm: Date | null;
  substituidoPorTokenHash: string | null;
  usuario: AuthUserRecord;
};

export type AuthRepository = {
  findUserByNormalizedLogin(loginNormalizado: string): Promise<AuthUserRecord | null>;
  findActiveUserById(id: number): Promise<AuthUserRecord | null>;
  findRefreshTokenByHash(tokenHash: string): Promise<AuthRefreshTokenRecord | null>;
  createRefreshToken(data: {
    tokenHash: string;
    usuarioId: number;
    familiaSessaoId: string;
    expiraEm: Date;
  }): Promise<void>;
  revokeRefreshToken(id: number, substituidoPorTokenHash?: string): Promise<void>;
  revokeActiveRefreshTokensByFamily(familiaSessaoId: string): Promise<void>;
  updatePassword(usuarioId: number, senhaHash: string): Promise<void>;
};

export type SafeAuthUser = {
  id: number;
  login: string;
  nomeCompleto: string;
  email: string | null;
  perfil: PerfilUsuario;
  ativo: boolean;
  deveAlterarSenha: boolean;
};

type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: SafeAuthUser;
};

const ACCESS_TOKEN_MINUTES = 15;
const REFRESH_TOKEN_DAYS = 1;

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  async login(input: { login: string; senha: string }): Promise<AuthResult> {
    const user = await this.repository.findUserByNormalizedLogin(normalizeLogin(input.login));

    if (!user || !(await verifyPassword(input.senha, user.senhaHash))) {
      throw invalidCredentialsError();
    }

    if (!user.ativo) {
      throw inactiveUserError();
    }

    return this.issueSession(user);
  }

  async refresh(input: { refreshToken: string }): Promise<AuthResult> {
    const tokenHash = hashRefreshToken(input.refreshToken);
    const token = await this.repository.findRefreshTokenByHash(tokenHash);

    if (!token) {
      throw expiredSessionError();
    }

    if (token.revogadoEm) {
      await this.repository.revokeActiveRefreshTokensByFamily(token.familiaSessaoId);
      throw expiredSessionError();
    }

    if (token.expiraEm.getTime() <= Date.now()) {
      throw expiredSessionError();
    }

    if (!token.usuario.ativo) {
      throw inactiveUserError();
    }

    const session = await this.issueSession(token.usuario, token.familiaSessaoId);
    await this.repository.revokeRefreshToken(token.id, hashRefreshToken(session.refreshToken));

    return session;
  }

  async logout(input: { refreshToken: string }): Promise<void> {
    const token = await this.repository.findRefreshTokenByHash(hashRefreshToken(input.refreshToken));

    if (!token || token.revogadoEm) {
      throw expiredSessionError();
    }

    await this.repository.revokeRefreshToken(token.id);
  }

  async changePassword(
    usuarioId: number,
    input: { senhaAtual: string; novaSenha: string }
  ): Promise<void> {
    const user = await this.repository.findActiveUserById(usuarioId);

    if (!user) {
      throw expiredSessionError();
    }

    if (!(await verifyPassword(input.senhaAtual, user.senhaHash))) {
      throw currentPasswordError();
    }

    if (await verifyPassword(input.novaSenha, user.senhaHash)) {
      throw currentPasswordError("A nova senha deve ser diferente da senha atual.");
    }

    if (!isStrongPassword(input.novaSenha)) {
      throw currentPasswordError("A nova senha nao atende aos requisitos minimos.");
    }

    await this.repository.updatePassword(usuarioId, await hashPassword(input.novaSenha));
  }

  private async issueSession(
    user: AuthUserRecord,
    familiaSessaoId: string = randomUUID()
  ): Promise<AuthResult> {
    const refreshToken = randomBytes(32).toString("base64url");

    await this.repository.createRefreshToken({
      tokenHash: hashRefreshToken(refreshToken),
      usuarioId: user.id,
      familiaSessaoId,
      expiraEm: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000)
    });

    return {
      accessToken: signAccessToken({
        sub: String(user.id),
        perfil: user.perfil
      }),
      refreshToken,
      user: toSafeAuthUser(user)
    };
  }
}

export function toSafeAuthUser(user: AuthUserRecord): SafeAuthUser {
  return {
    id: user.id,
    login: user.login,
    nomeCompleto: user.nomeCompleto,
    email: user.email,
    perfil: user.perfil,
    ativo: user.ativo,
    deveAlterarSenha: user.deveAlterarSenha
  };
}

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function accessTokenMinutes(): number {
  return ACCESS_TOKEN_MINUTES;
}

function invalidCredentialsError(): AppError {
  return new AppError({
    code: "AUTH_002",
    message: "Login ou senha invalidos.",
    statusCode: 401
  });
}

function inactiveUserError(): AppError {
  return new AppError({
    code: "AUTH_003",
    message: "Usuario inativo. Procure um administrador.",
    statusCode: 401
  });
}

function expiredSessionError(): AppError {
  return new AppError({
    code: "AUTH_004",
    message: "Sessao expirada. Faca login novamente.",
    statusCode: 401
  });
}

function currentPasswordError(message = "Senha atual invalida."): AppError {
  return new AppError({
    code: "AUTH_001",
    message,
    statusCode: 400
  });
}
