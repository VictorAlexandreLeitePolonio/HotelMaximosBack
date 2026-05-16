import type { Prisma, PrismaClient } from "@prisma/client";
import type { UserRecord, UsersListInput, UsersRepository } from "./users.service.js";

export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(input: UsersListInput): Promise<{ data: UserRecord[]; total: number }> {
    const where: Prisma.UsuarioWhereInput = {};

    if (input.search?.trim()) {
      const search = input.search.trim();
      where.OR = [
        { login: { contains: search, mode: "insensitive" } },
        { nomeCompleto: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ];
    }

    if (input.perfil) {
      where.perfil = input.perfil;
    }

    if (input.ativo !== undefined) {
      where.ativo = input.ativo;
    }

    const orderBy: Prisma.UsuarioOrderByWithRelationInput = {
      [input.sortField ?? "criadoEm"]: input.sortOrder ?? "desc"
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.usuario.findMany({
        where,
        orderBy,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.usuario.count({ where })
    ]);

    return { data, total };
  }

  async findById(id: number) {
    return this.prisma.usuario.findUnique({
      where: { id }
    });
  }

  async findByNormalizedLogin(loginNormalizado: string) {
    return this.prisma.usuario.findUnique({
      where: { loginNormalizado }
    });
  }

  async countActiveAdminsExcept(id?: number) {
    return this.prisma.usuario.count({
      where: {
        perfil: "Admin",
        ativo: true,
        ...(id ? { id: { not: id } } : {})
      }
    });
  }

  async create(data: Omit<UserRecord, "id" | "criadoEm" | "atualizadoEm">) {
    return this.prisma.usuario.create({
      data
    });
  }

  async update(id: number, data: Partial<Omit<UserRecord, "id" | "criadoEm">>) {
    return this.prisma.usuario.update({
      where: { id },
      data
    });
  }
}
