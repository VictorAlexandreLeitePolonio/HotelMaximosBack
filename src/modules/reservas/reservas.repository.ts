import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  DisponibilidadeFlatRecord,
  DisponibilidadeInput,
  ReservaAcompanhanteRecord,
  ReservaFlatRecord,
  ReservaHospedeResponsavelRecord,
  ReservaRecord,
  ReservasListInput,
  ReservasRepository,
  CreateReservaPayload
} from "./reservas.service.js";

const reservaInclude = {
  flat: {
    select: {
      id: true,
      numero: true,
      statusOperacional: true,
      ativo: true,
      subcategoriaId: true,
      subcategoria: {
        select: {
          id: true,
          nome: true,
          precoBase: true,
          capacidadeMaxima: true
        }
      }
    }
  },
  subcategoria: {
    select: {
      id: true,
      nome: true,
      precoBase: true,
      capacidadeMaxima: true
    }
  },
  hospedeResponsavel: {
    select: {
      id: true,
      nomeCompleto: true,
      cpf: true,
      ativo: true
    }
  },
  hospedes: {
    include: {
      acompanhante: {
        select: {
          id: true,
          hospedeResponsavelId: true,
          nomeCompleto: true,
          documento: true,
          menorDeIdade: true
        }
      }
    }
  }
} satisfies Prisma.ReservaInclude;

type ReservaRow = Prisma.ReservaGetPayload<{ include: typeof reservaInclude }>;

type FlatRow = {
  id: number;
  numero: string;
  statusOperacional: "Livre" | "Reservado" | "Ocupado" | "AguardandoLimpeza" | "Manutencao";
  ativo: boolean;
  subcategoriaId: number;
  subcategoria: {
    id: number;
    nome: string;
    precoBase: Prisma.Decimal;
    capacidadeMaxima: number;
  };
};

export class PrismaReservasRepository implements ReservasRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(input: ReservasListInput): Promise<{ data: ReservaRecord[]; total: number }> {
    const where: Prisma.ReservaWhereInput = {};

    if (input.search?.trim()) {
      const search = input.search.trim();
      where.OR = [
        {
          flat: {
            numero: {
              contains: search,
              mode: "insensitive"
            }
          }
        },
        {
          hospedeResponsavel: {
            nomeCompleto: {
              contains: search,
              mode: "insensitive"
            }
          }
        },
        {
          hospedeResponsavel: {
            cpf: {
              contains: search,
              mode: "insensitive"
            }
          }
        }
      ];
    }

    if (input.flatId !== undefined) {
      where.flatId = input.flatId;
    }

    if (input.hospedeResponsavelId !== undefined) {
      where.hospedeResponsavelId = input.hospedeResponsavelId;
    }

    if (input.status) {
      where.status = input.status;
    }

    if (input.dataInicio || input.dataFim) {
      where.AND = [
        ...(input.dataInicio ? [{ dataFim: { gt: input.dataInicio } }] : []),
        ...(input.dataFim ? [{ dataInicio: { lt: input.dataFim } }] : [])
      ];
    }

    const orderBy: Prisma.ReservaOrderByWithRelationInput = {
      [input.sortField ?? "dataInicio"]: input.sortOrder ?? "asc"
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.reserva.findMany({
        where,
        include: reservaInclude,
        orderBy,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.reserva.count({ where })
    ]);

    return {
      data: data.map(toReservaRecord),
      total
    };
  }

  async findById(id: number): Promise<ReservaRecord | null> {
    const reserva = await this.prisma.reserva.findUnique({
      where: { id },
      include: reservaInclude
    });

    return reserva ? toReservaRecord(reserva) : null;
  }

  async findFlatById(id: number): Promise<ReservaFlatRecord | null> {
    const flat = await this.prisma.flat.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        statusOperacional: true,
        ativo: true,
        subcategoriaId: true,
        subcategoria: {
          select: {
            id: true,
            nome: true,
            precoBase: true,
            capacidadeMaxima: true
          }
        }
      }
    });

    return flat ? toFlatRecord(flat) : null;
  }

  async findHospedeResponsavelById(id: number): Promise<ReservaHospedeResponsavelRecord | null> {
    const responsavel = await this.prisma.hospedeResponsavel.findUnique({
      where: { id },
      select: {
        id: true,
        nomeCompleto: true,
        cpf: true,
        ativo: true
      }
    });

    return responsavel;
  }

  async findAcompanhantesByIds(
    responsavelId: number,
    ids: number[]
  ): Promise<ReservaAcompanhanteRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.prisma.hospedeAcompanhante.findMany({
      where: {
        id: {
          in: ids
        },
        hospedeResponsavelId: responsavelId
      },
      select: {
        id: true,
        hospedeResponsavelId: true,
        nomeCompleto: true,
        documento: true,
        menorDeIdade: true
      }
    });
  }

  async hasConflictingReservation(flatId: number, dataInicio: Date, dataFim: Date): Promise<boolean> {
    const count = await this.prisma.reserva.count({
      where: {
        flatId,
        status: "Confirmada",
        dataInicio: {
          lt: dataFim
        },
        dataFim: {
          gt: dataInicio
        }
      }
    });

    return count > 0;
  }

  async hasFutureReservationForFlat(flatId: number, now: Date): Promise<boolean> {
    const count = await this.prisma.reserva.count({
      where: {
        flatId,
        status: "Confirmada",
        dataInicio: {
          gte: now
        }
      }
    });

    return count > 0;
  }

  async listAvailability(input: DisponibilidadeInput): Promise<{ data: DisponibilidadeFlatRecord[]; total: number }> {
    const where: Prisma.FlatWhereInput = {
      ativo: true
    };

    if (input.categoriaId !== undefined) {
      where.categoriaId = input.categoriaId;
    }

    if (input.subcategoriaId !== undefined) {
      where.subcategoriaId = input.subcategoriaId;
    }

    const [flats, total] = await this.prisma.$transaction([
      this.prisma.flat.findMany({
        where,
        orderBy: {
          numero: "asc"
        },
        select: {
          id: true,
          numero: true,
          statusOperacional: true,
          ativo: true,
          subcategoriaId: true,
          subcategoria: {
            select: {
              id: true,
              nome: true,
              precoBase: true,
              capacidadeMaxima: true
            }
          }
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.flat.count({ where })
    ]);

    const flatIds = flats.map((flat) => flat.id);
    const reservas = flatIds.length
      ? await this.prisma.reserva.findMany({
          where: {
            flatId: {
              in: flatIds
            },
            status: "Confirmada",
            dataInicio: {
              lt: input.dataFim
            },
            dataFim: {
              gt: input.dataInicio
            }
          },
          select: {
            flatId: true
          }
        })
      : [];
    const blockedFlatIds = new Set(reservas.map((reserva) => reserva.flatId));

    return {
      data: flats.map((flat) => ({
        ...toFlatRecord(flat),
        bloqueadoPorReserva: blockedFlatIds.has(flat.id)
      })),
      total
    };
  }

  async create(data: CreateReservaPayload): Promise<ReservaRecord> {
    const reserva = await this.prisma.reserva.create({
      data: {
        flatId: data.flatId,
        subcategoriaId: data.subcategoriaId,
        hospedeResponsavelId: data.hospedeResponsavelId,
        dataInicio: data.dataInicio,
        dataFim: data.dataFim,
        quantidadeHospedes: data.quantidadeHospedes,
        cafeContratado: data.cafeContratado,
        valorBaseContratado: new Prisma.Decimal(data.valorBaseContratado),
        valorCafePorPessoa: new Prisma.Decimal(data.valorCafePorPessoa),
        valorCafeContratado: new Prisma.Decimal(data.valorCafeContratado),
        valorTotalContratado: new Prisma.Decimal(data.valorTotalContratado),
        observacoes: data.observacoes,
        hospedes: {
          create: data.acompanhanteIds.map((acompanhanteId) => ({
            acompanhante: {
              connect: {
                id: acompanhanteId
              }
            }
          }))
        }
      },
      include: reservaInclude
    });

    return toReservaRecord(reserva);
  }
}

function toReservaRecord(row: ReservaRow): ReservaRecord {
  return {
    id: row.id,
    flatId: row.flatId,
    flat: toFlatRecord(row.flat),
    subcategoriaId: row.subcategoriaId,
    subcategoria: toSubcategoriaRecord(row.subcategoria),
    hospedeResponsavelId: row.hospedeResponsavelId,
    hospedeResponsavel: row.hospedeResponsavel,
    acompanhantes: row.hospedes.map((hospede) => hospede.acompanhante),
    dataInicio: row.dataInicio,
    dataFim: row.dataFim,
    status: row.status,
    quantidadeHospedes: row.quantidadeHospedes,
    cafeContratado: row.cafeContratado,
    valorBaseContratado: row.valorBaseContratado.toNumber(),
    valorCafePorPessoa: row.valorCafePorPessoa.toNumber(),
    valorCafeContratado: row.valorCafeContratado.toNumber(),
    valorTotalContratado: row.valorTotalContratado.toNumber(),
    observacoes: row.observacoes,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
  };
}

function toFlatRecord(row: FlatRow): ReservaFlatRecord {
  return {
    id: row.id,
    numero: row.numero,
    statusOperacional: row.statusOperacional,
    ativo: row.ativo,
    subcategoriaId: row.subcategoriaId,
    subcategoria: toSubcategoriaRecord(row.subcategoria)
  };
}

function toSubcategoriaRecord(row: {
  id: number;
  nome: string;
  precoBase: Prisma.Decimal;
  capacidadeMaxima: number;
}) {
  return {
    id: row.id,
    nome: row.nome,
    precoBase: row.precoBase.toNumber(),
    capacidadeMaxima: row.capacidadeMaxima
  };
}
