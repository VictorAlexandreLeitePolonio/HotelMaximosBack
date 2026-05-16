import { describe, expect, it } from "vitest";
import { UsersService, type UserRecord, type UsersRepository } from "../src/modules/users/users.service.js";
import { verifyPassword, hashPassword } from "../src/shared/auth/password.js";

class FakeUsersRepository implements UsersRepository {
  users: UserRecord[] = [];

  async list() {
    return {
      data: this.users,
      total: this.users.length
    };
  }

  async findById(id: number) {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async findByNormalizedLogin(loginNormalizado: string) {
    return this.users.find((user) => user.loginNormalizado === loginNormalizado) ?? null;
  }

  async countActiveAdminsExcept(id?: number) {
    return this.users.filter((user) => user.perfil === "Admin" && user.ativo && user.id !== id).length;
  }

  async create(data: Omit<UserRecord, "id" | "criadoEm" | "atualizadoEm">) {
    const user = {
      id: this.users.length + 1,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      ...data
    };
    this.users.push(user);
    return user;
  }

  async update(id: number, data: Partial<Omit<UserRecord, "id" | "criadoEm">>) {
    const user = await this.findById(id);

    if (!user) {
      throw new Error("Usuario fake nao encontrado.");
    }

    Object.assign(user, data, { atualizadoEm: new Date() });
    return user;
  }
}

async function createStoredUser(overrides: Partial<UserRecord> = {}): Promise<UserRecord> {
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
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...overrides
  };
}

describe("UsersService", () => {
  it("creates users with normalized login, default password and must-change-password flag", async () => {
    const repository = new FakeUsersRepository();
    const result = await new UsersService(repository).create({
      login: " Recepcao01 ",
      nomeCompleto: "Recepcao Turno Manha",
      email: "",
      perfil: "Recepcionista",
      senha: null
    });

    expect(result).toMatchObject({
      login: "Recepcao01",
      nomeCompleto: "Recepcao Turno Manha",
      email: null,
      perfil: "Recepcionista",
      ativo: true,
      deveAlterarSenha: true
    });
    expect(repository.users[0].loginNormalizado).toBe("recepcao01");
    await expect(verifyPassword("Admin123!", repository.users[0].senhaHash)).resolves.toBe(true);
  });

  it("rejects duplicate login case-insensitively with USER_001", async () => {
    const repository = new FakeUsersRepository();
    repository.users.push(await createStoredUser({ loginNormalizado: "admin" }));

    await expect(
      new UsersService(repository).create({
        login: " ADMIN ",
        nomeCompleto: "Outro Admin",
        email: null,
        perfil: "Admin",
        senha: "MinhaSenha123!"
      })
    ).rejects.toMatchObject({
      code: "USER_001",
      statusCode: 409
    });
  });

  it("updates only provided fields, clears email and marks password as must-change", async () => {
    const repository = new FakeUsersRepository();
    repository.users.push(
      await createStoredUser({
        email: "admin@hotel.com",
        deveAlterarSenha: false
      })
    );

    const result = await new UsersService(repository).update(1, {
      email: "",
      senha: "OutraSenha123!"
    });

    expect(result.email).toBeNull();
    expect(result.login).toBe("admin");
    expect(result.deveAlterarSenha).toBe(true);
    await expect(verifyPassword("OutraSenha123!", repository.users[0].senhaHash)).resolves.toBe(true);
  });

  it("blocks self-inactivation with USER_004", async () => {
    const repository = new FakeUsersRepository();
    repository.users.push(await createStoredUser());

    await expect(new UsersService(repository).setStatus(1, 1, false)).rejects.toMatchObject({
      code: "USER_004",
      statusCode: 400
    });
  });

  it("blocks inactivating the last active admin with USER_003", async () => {
    const repository = new FakeUsersRepository();
    repository.users.push(await createStoredUser());

    await expect(new UsersService(repository).setStatus(2, 1, false)).rejects.toMatchObject({
      code: "USER_003",
      statusCode: 400
    });
  });

  it("resets user password to the local default and marks must-change-password", async () => {
    const repository = new FakeUsersRepository();
    repository.users.push(
      await createStoredUser({
        deveAlterarSenha: false,
        senhaHash: await hashPassword("SenhaAtual123!")
      })
    );

    const result = await new UsersService(repository).resetPassword(1);

    expect(result.deveAlterarSenha).toBe(true);
    await expect(verifyPassword("Admin123!", repository.users[0].senhaHash)).resolves.toBe(true);
  });
});
