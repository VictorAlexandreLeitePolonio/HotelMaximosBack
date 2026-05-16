import { AppError } from "../../shared/errors/app-error.js";
import { hashPassword } from "../../shared/auth/password.js";
import { normalizeLogin } from "./users.helpers.js";

export type UserProfile = "Admin" | "Recepcionista";

export type UserRecord = {
  id: number;
  login: string;
  loginNormalizado: string;
  nomeCompleto: string;
  email: string | null;
  senhaHash: string;
  perfil: UserProfile;
  ativo: boolean;
  deveAlterarSenha: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type SafeUser = Omit<UserRecord, "loginNormalizado" | "senhaHash">;

export type UsersListInput = {
  page: number;
  pageSize: number;
  search?: string;
  perfil?: UserProfile;
  ativo?: boolean;
  sortField?: "login" | "nomeCompleto" | "email" | "perfil" | "ativo" | "criadoEm" | "atualizadoEm";
  sortOrder?: "asc" | "desc";
};

export type UsersRepository = {
  list(input: UsersListInput): Promise<{ data: UserRecord[]; total: number }>;
  findById(id: number): Promise<UserRecord | null>;
  findByNormalizedLogin(loginNormalizado: string): Promise<UserRecord | null>;
  countActiveAdminsExcept(id?: number): Promise<number>;
  create(data: Omit<UserRecord, "id" | "criadoEm" | "atualizadoEm">): Promise<UserRecord>;
  update(id: number, data: Partial<Omit<UserRecord, "id" | "criadoEm">>): Promise<UserRecord>;
};

export type CreateUserInput = {
  login: string;
  nomeCompleto: string;
  email?: string | null;
  perfil: UserProfile;
  senha?: string | null;
};

export type UpdateUserInput = Partial<CreateUserInput>;

const DEFAULT_PASSWORD = "Admin123!";

export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  async list(input: UsersListInput) {
    const { data, total } = await this.repository.list(input);
    const totalPages = Math.ceil(total / input.pageSize);

    return {
      data: data.map(toSafeUser),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages
      }
    };
  }

  async getById(id: number): Promise<SafeUser> {
    const user = await this.repository.findById(id);

    if (!user) {
      throw userNotFoundError();
    }

    return toSafeUser(user);
  }

  async create(input: CreateUserInput): Promise<SafeUser> {
    const login = input.login.trim();
    const loginNormalizado = normalizeLogin(login);
    await this.ensureLoginAvailable(loginNormalizado);

    const user = await this.repository.create({
      login,
      loginNormalizado,
      nomeCompleto: input.nomeCompleto.trim(),
      email: normalizeNullableText(input.email),
      senhaHash: await hashPassword(input.senha?.trim() || DEFAULT_PASSWORD),
      perfil: input.perfil,
      ativo: true,
      deveAlterarSenha: true
    });

    return toSafeUser(user);
  }

  async update(id: number, input: UpdateUserInput): Promise<SafeUser> {
    const current = await this.repository.findById(id);

    if (!current) {
      throw userNotFoundError();
    }

    const data: Partial<Omit<UserRecord, "id" | "criadoEm">> = {};

    if (input.login !== undefined) {
      const login = input.login.trim();
      const loginNormalizado = normalizeLogin(login);
      await this.ensureLoginAvailable(loginNormalizado, id);
      data.login = login;
      data.loginNormalizado = loginNormalizado;
    }

    if (input.nomeCompleto !== undefined) {
      data.nomeCompleto = input.nomeCompleto.trim();
    }

    if (input.email !== undefined) {
      data.email = normalizeNullableText(input.email);
    }

    if (input.perfil !== undefined) {
      if (current.perfil === "Admin" && current.ativo && input.perfil !== "Admin") {
        await this.ensureAnotherActiveAdmin(id);
      }

      data.perfil = input.perfil;
    }

    if (input.senha !== undefined) {
      data.senhaHash = await hashPassword(input.senha?.trim() || DEFAULT_PASSWORD);
      data.deveAlterarSenha = true;
    }

    return toSafeUser(await this.repository.update(id, data));
  }

  async setStatus(requesterId: number, id: number, ativo: boolean): Promise<SafeUser> {
    const user = await this.repository.findById(id);

    if (!user) {
      throw userNotFoundError();
    }

    if (requesterId === id && !ativo) {
      throw selfInactivationError();
    }

    if (user.perfil === "Admin" && user.ativo && !ativo) {
      await this.ensureAnotherActiveAdmin(id);
    }

    return toSafeUser(await this.repository.update(id, { ativo }));
  }

  async resetPassword(id: number): Promise<SafeUser> {
    const user = await this.repository.findById(id);

    if (!user) {
      throw userNotFoundError();
    }

    return toSafeUser(
      await this.repository.update(id, {
        senhaHash: await hashPassword(DEFAULT_PASSWORD),
        deveAlterarSenha: true
      })
    );
  }

  private async ensureLoginAvailable(loginNormalizado: string, currentUserId?: number): Promise<void> {
    const existing = await this.repository.findByNormalizedLogin(loginNormalizado);

    if (existing && existing.id !== currentUserId) {
      throw duplicateLoginError();
    }
  }

  private async ensureAnotherActiveAdmin(currentAdminId: number): Promise<void> {
    const activeAdmins = await this.repository.countActiveAdminsExcept(currentAdminId);

    if (activeAdmins === 0) {
      throw lastAdminError();
    }
  }
}

export function toSafeUser(user: UserRecord): SafeUser {
  return {
    id: user.id,
    login: user.login,
    nomeCompleto: user.nomeCompleto,
    email: user.email,
    perfil: user.perfil,
    ativo: user.ativo,
    deveAlterarSenha: user.deveAlterarSenha,
    criadoEm: user.criadoEm,
    atualizadoEm: user.atualizadoEm
  };
}

function normalizeNullableText(value?: string | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function duplicateLoginError(): AppError {
  return new AppError({
    code: "USER_001",
    message: "Ja existe um usuario com este login.",
    statusCode: 409
  });
}

function userNotFoundError(): AppError {
  return new AppError({
    code: "USER_002",
    message: "Usuario nao encontrado.",
    statusCode: 404
  });
}

function lastAdminError(): AppError {
  return new AppError({
    code: "USER_003",
    message: "Nao e possivel remover ou inativar o ultimo administrador ativo.",
    statusCode: 400
  });
}

function selfInactivationError(): AppError {
  return new AppError({
    code: "USER_004",
    message: "Voce nao pode inativar seu proprio usuario.",
    statusCode: 400
  });
}
