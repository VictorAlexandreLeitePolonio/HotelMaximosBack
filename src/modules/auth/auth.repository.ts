import type { PrismaClient } from "@prisma/client";
import type { AuthRepository } from "./auth.service.js";

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByNormalizedLogin(loginNormalizado: string) {
    return this.prisma.usuario.findUnique({
      where: { loginNormalizado }
    });
  }

  async findActiveUserById(id: number) {
    return this.prisma.usuario.findFirst({
      where: {
        id,
        ativo: true
      }
    });
  }

  async findRefreshTokenByHash(tokenHash: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { usuario: true }
    });
  }

  async createRefreshToken(data: {
    tokenHash: string;
    usuarioId: number;
    familiaSessaoId: string;
    expiraEm: Date;
  }) {
    await this.prisma.refreshToken.create({
      data
    });
  }

  async revokeRefreshToken(id: number, substituidoPorTokenHash?: string) {
    await this.prisma.refreshToken.update({
      where: { id },
      data: {
        revogadoEm: new Date(),
        substituidoPorTokenHash: substituidoPorTokenHash ?? null
      }
    });
  }

  async revokeActiveRefreshTokensByFamily(familiaSessaoId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        familiaSessaoId,
        revogadoEm: null
      },
      data: {
        revogadoEm: new Date()
      }
    });
  }

  async updatePassword(usuarioId: number, senhaHash: string) {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        senhaHash,
        deveAlterarSenha: false
      }
    });
  }
}
