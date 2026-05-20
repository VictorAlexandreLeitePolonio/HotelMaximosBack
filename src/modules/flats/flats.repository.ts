import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  CategoriaResumoRecord,
  FlatMaintenanceCleaningRecord,
  FlatMaintenanceReservationRecord,
  FlatRecord,
  FlatsListInput,
  FlatsRepository,
  StartFlatMaintenanceInput,
  SubcategoriaResumoRecord
} from "./flats.service.js";

type PrismaDb = PrismaClient | Prisma.TransactionClient;

const flatInclude = {
  categoria: {
    select: {
      id: true,
      nome: true,
      ativo: true
    }
  },
  subcategoria: {
    select: {
      id: true,
      categoriaId: true,
      nome: true,
      precoBase: true,
      capacidadeMaxima: true,
      ativo: true
    }
  }
} satisfies Prisma.FlatInclude;

type FlatRow = Prisma.FlatGetPayload<{ include: typeof flatInclude }>;

function toCategoriaResumo(row: { id: number; nome: string; ativo: boolean }): CategoriaResumoRecord {
  return row;
}

function toSubcategoriaResumo(row: {
  id: number;
  categoriaId: number;
  nome: string;
  precoBase: Prisma.Decimal;
  capacidadeMaxima: number;
  ativo: boolean;
}): SubcategoriaResumoRecord {
  return {
    id: row.id,
    categoriaId: row.categoriaId,
    nome: row.nome,
    precoBase: row.precoBase.toNumber(),
    capacidadeMaxima: row.capacidadeMaxima,
    ativo: row.ativo
  };
}

function toFlatRecord(row: FlatRow): FlatRecord {
  return {
    id: row.id,
    numero: row.numero,
    numeroNormalizado: row.numeroNormalizado,
    categoriaId: row.categoriaId,
    subcategoriaId: row.subcategoriaId,
    categoria: toCategoriaResumo(row.categoria),
    subcategoria: toSubcategoriaResumo(row.subcategoria),
    statusOperacional: row.statusOperacional,
    ativo: row.ativo,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
  };
}

export class PrismaFlatsRepository implements FlatsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(input: FlatsListInput): Promise<{ data: FlatRecord[]; total: number }> {
    const where: Prisma.FlatWhereInput = {};

    if (input.search?.trim()) {
      where.numero = {
        contains: input.search.trim(),
        mode: "insensitive"
      };
    }

    if (input.categoriaId !== undefined) {
      where.categoriaId = input.categoriaId;
    }

    if (input.subcategoriaId !== undefined) {
      where.subcategoriaId = input.subcategoriaId;
    }

    if (input.statusOperacional) {
      where.statusOperacional = input.statusOperacional;
    }

    if (input.ativo !== undefined) {
      where.ativo = input.ativo;
    }

    const orderBy: Prisma.FlatOrderByWithRelationInput = {
      [input.sortField ?? "numero"]: input.sortOrder ?? "asc"
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.flat.findMany({
        where,
        orderBy,
        include: flatInclude,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.flat.count({ where })
    ]);

    return {
      data: data.map(toFlatRecord),
      total
    };
  }

  async findById(id: number) {
    return this.loadFlat(this.prisma, id);
  }

  async findByNormalizedNumber(numeroNormalizado: string) {
    const flat = await this.prisma.flat.findUnique({
      where: { numeroNormalizado },
      include: flatInclude
    });

    return flat ? toFlatRecord(flat) : null;
  }

  async findCategoryById(id: number) {
    const categoria = await this.prisma.categoriaFlat.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        ativo: true
      }
    });

    return categoria ? toCategoriaResumo(categoria) : null;
  }

  async findSubcategoryById(id: number) {
    const subcategoria = await this.prisma.subcategoriaFlat.findUnique({
      where: { id },
      select: {
        id: true,
        categoriaId: true,
        nome: true,
        precoBase: true,
        capacidadeMaxima: true,
        ativo: true
      }
    });

    return subcategoria ? toSubcategoriaResumo(subcategoria) : null;
  }

  async create(data: Omit<FlatRecord, "id" | "categoria" | "subcategoria" | "criadoEm" | "atualizadoEm">) {
    return toFlatRecord(
      await this.prisma.flat.create({
        data,
        include: flatInclude
      })
    );
  }

  async update(id: number, data: Partial<Omit<FlatRecord, "id" | "categoria" | "subcategoria" | "criadoEm">>) {
    return toFlatRecord(
      await this.prisma.flat.update({
        where: { id },
        data,
        include: flatInclude
      })
    );
  }

  async softDelete(id: number): Promise<void> {
    await this.prisma.flat.update({
      where: { id },
      data: {
        ativo: false
      }
    });
  }

  async hasFutureReservation(id: number, now: Date): Promise<boolean> {
    const count = await this.prisma.reserva.count({
      where: {
        flatId: id,
        status: "Confirmada",
        dataInicio: {
          gte: now
        }
      }
    });

    return count > 0;
  }

  async listPendingReservationsForMaintenance(
    flatId: number,
    now: Date
  ): Promise<FlatMaintenanceReservationRecord[]> {
    const reservas = await this.prisma.reserva.findMany({
      where: {
        flatId,
        status: "Confirmada",
        dataFim: {
          gt: now
        },
        estadia: {
          is: null
        }
      },
      select: {
        id: true,
        status: true
      },
      orderBy: {
        dataInicio: "asc"
      }
    });

    return reservas.map((reserva) => ({
      id: reserva.id,
      status: reserva.status
    }));
  }

  async listOpenCleaningsForFlat(flatId: number): Promise<FlatMaintenanceCleaningRecord[]> {
    const limpezas = await this.prisma.limpeza.findMany({
      where: {
        flatId,
        concluidaEm: null
      },
      select: {
        id: true,
        tipo: true,
        status: true,
        atrasaEm: true,
        concluidaEm: true
      },
      orderBy: {
        dataProgramada: "asc"
      }
    });

    return limpezas.map((limpeza) => ({
      id: limpeza.id,
      tipo: limpeza.tipo,
      status: limpeza.status,
      atrasaEm: limpeza.atrasaEm,
      concluidaEm: limpeza.concluidaEm
    }));
  }

  async startMaintenance(data: {
    flatId: number;
    usuario: { id: number; nomeCompleto: string; perfil: "Admin" | "Recepcionista" };
    statusAnterior: FlatRecord["statusOperacional"];
    motivo: string;
    observacoes: string | null;
    reservasAfetadas: FlatMaintenanceReservationRecord[];
    limpezasAfetadas: Array<{ id: number; status: FlatMaintenanceCleaningRecord["status"] }>;
    iniciadoEm: Date;
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.flat.update({
        where: {
          id: data.flatId
        },
        data: {
          statusOperacional: "Manutencao"
        }
      });

      if (data.reservasAfetadas.length > 0) {
        await tx.reserva.updateMany({
          where: {
            id: {
              in: data.reservasAfetadas.map((reserva) => reserva.id)
            }
          },
          data: {
            status: "RequerRealocacao"
          }
        });
      }

      if (data.limpezasAfetadas.length > 0) {
        await tx.limpeza.updateMany({
          where: {
            id: {
              in: data.limpezasAfetadas.map((limpeza) => limpeza.id)
            }
          },
          data: {
            status: "Suspensa"
          }
        });
      }

      await tx.historicoFlat.create({
        data: {
          flatId: data.flatId,
          usuarioId: data.usuario.id,
          tipo: "ManutencaoIniciada",
          descricao: "Flat bloqueado manualmente para manutencao.",
          metadata: {
            statusAnterior: data.statusAnterior,
            statusSeguinte: "Manutencao",
            motivo: data.motivo,
            observacoes: data.observacoes,
            reservasAfetadas: data.reservasAfetadas.map((reserva) => reserva.id),
            totalReservasAfetadas: data.reservasAfetadas.length,
            limpezasAfetadas: data.limpezasAfetadas,
            totalLimpezasAfetadas: data.limpezasAfetadas.length,
            usuarioNome: data.usuario.nomeCompleto,
            usuarioPerfil: data.usuario.perfil,
            iniciadoEm: data.iniciadoEm.toISOString()
          }
        }
      });
    });

    const flat = await this.loadFlat(this.prisma, data.flatId);

    if (!flat) {
      throw new Error("Falha ao recarregar o flat apos iniciar manutencao.");
    }

    return flat;
  }

  async releaseMaintenance(data: {
    flatId: number;
    usuario: { id: number; nomeCompleto: string; perfil: "Admin" | "Recepcionista" };
    observacoes: string | null;
    statusSeguinte: FlatRecord["statusOperacional"];
    limpezasAfetadas: Array<{ id: number; status: FlatMaintenanceCleaningRecord["status"] }>;
    liberadoEm: Date;
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.flat.update({
        where: {
          id: data.flatId
        },
        data: {
          statusOperacional: data.statusSeguinte
        }
      });

      for (const limpeza of data.limpezasAfetadas) {
        await tx.limpeza.update({
          where: {
            id: limpeza.id
          },
          data: {
            status: limpeza.status
          }
        });
      }

      await tx.historicoFlat.create({
        data: {
          flatId: data.flatId,
          usuarioId: data.usuario.id,
          tipo: "ManutencaoFinalizada",
          descricao: "Flat liberado manualmente da manutencao.",
          metadata: {
            statusAnterior: "Manutencao",
            statusSeguinte: data.statusSeguinte,
            observacoes: data.observacoes,
            limpezasAfetadas: data.limpezasAfetadas,
            totalLimpezasAfetadas: data.limpezasAfetadas.length,
            usuarioNome: data.usuario.nomeCompleto,
            usuarioPerfil: data.usuario.perfil,
            liberadoEm: data.liberadoEm.toISOString()
          }
        }
      });
    });

    const flat = await this.loadFlat(this.prisma, data.flatId);

    if (!flat) {
      throw new Error("Falha ao recarregar o flat apos liberar manutencao.");
    }

    return flat;
  }

  private async loadFlat(db: PrismaDb, id: number) {
    const flat = await db.flat.findUnique({
      where: { id },
      include: flatInclude
    });

    return flat ? toFlatRecord(flat) : null;
  }
}
