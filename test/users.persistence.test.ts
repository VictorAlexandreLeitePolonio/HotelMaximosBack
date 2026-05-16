import { describe, expect, it, vi } from "vitest";
import { hashRefreshToken } from "../src/modules/auth/refresh-token.helpers.js";
import { normalizeLogin } from "../src/modules/users/users.helpers.js";
import { seedDevelopmentAdmin } from "../src/modules/users/users.seed.js";

describe("user persistence helpers", () => {
  it("normalizes login by trimming and lowercasing for case-insensitive uniqueness", () => {
    expect(normalizeLogin("  Admin.Local  ")).toBe("admin.local");
  });
});

describe("development admin seed", () => {
  it("creates the local admin only in development when the database has no users", async () => {
    const prisma = {
      usuario: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({})
      }
    };

    await seedDevelopmentAdmin(prisma, "development");

    expect(prisma.usuario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        login: "admin",
        loginNormalizado: "admin",
        nomeCompleto: "Administrador Local",
        email: null,
        perfil: "Admin",
        ativo: true,
        deveAlterarSenha: true
      })
    });
    expect(prisma.usuario.create.mock.calls[0][0].data.senhaHash).not.toBe("Admin123!");
  });

  it("does not create the local admin outside development", async () => {
    const prisma = {
      usuario: {
        count: vi.fn(),
        create: vi.fn()
      }
    };

    await seedDevelopmentAdmin(prisma, "production");

    expect(prisma.usuario.count).not.toHaveBeenCalled();
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });
});

describe("refresh token persistence helpers", () => {
  it("hashes raw refresh tokens before persistence", () => {
    const rawToken = "raw-refresh-token";
    const tokenHash = hashRefreshToken(rawToken);

    expect(tokenHash).not.toBe(rawToken);
    expect(tokenHash).toHaveLength(64);
    expect(hashRefreshToken(rawToken)).toBe(tokenHash);
  });
});
