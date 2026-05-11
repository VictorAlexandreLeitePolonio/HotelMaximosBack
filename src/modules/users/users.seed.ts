import { hashPassword } from "../../shared/auth/password.js";
import { normalizeLogin } from "./users.helpers.js";

type SeedEnvironment = "development" | "test" | "production";

type SeedUsuarioClient = {
  usuario: {
    count: () => Promise<number>;
    create: (args: {
      data: {
        login: string;
        loginNormalizado: string;
        nomeCompleto: string;
        email: string | null;
        senhaHash: string;
        perfil: "Admin";
        ativo: true;
        deveAlterarSenha: true;
      };
    }) => Promise<unknown>;
  };
};

const DEVELOPMENT_ADMIN = {
  login: "admin",
  nomeCompleto: "Administrador Local",
  senha: "Admin123!"
};

// Local/MVP-only bootstrap. Replace with secure provisioning before production.
export async function seedDevelopmentAdmin(
  prisma: SeedUsuarioClient,
  environment: SeedEnvironment
): Promise<void> {
  if (environment !== "development") {
    return;
  }

  const usersCount = await prisma.usuario.count();

  if (usersCount > 0) {
    return;
  }

  await prisma.usuario.create({
    data: {
      login: DEVELOPMENT_ADMIN.login,
      loginNormalizado: normalizeLogin(DEVELOPMENT_ADMIN.login),
      nomeCompleto: DEVELOPMENT_ADMIN.nomeCompleto,
      email: null,
      senhaHash: await hashPassword(DEVELOPMENT_ADMIN.senha),
      perfil: "Admin",
      ativo: true,
      deveAlterarSenha: true
    }
  });
}
