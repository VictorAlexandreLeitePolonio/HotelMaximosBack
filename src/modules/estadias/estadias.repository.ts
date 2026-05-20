import type {
  CaixaRecord,
  CheckInDoDiaRecord,
  CheckInResultRecord,
  CobrancaRecord,
  CreateCheckInFromReservationPayload,
  CreateDirectCheckInPayload,
  EstadiaRecord,
  EstadiasRepository,
  GrupoCheckIn,
  PagamentoRecord,
  RenewStayPayload,
  TransferFlatPayload
} from "./estadias.service.js";
import type { ActiveStaysListInput } from "./estadias.service.js";

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
} as const;

const estadiaInclude = {
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
} as const;

type ReservaRow = any;
type EstadiaRow = any;
type FlatRow = any;
type CobrancaRow = any;
type PagamentoRow = any;
type PrismaDb = any;

export class PrismaEstadiasRepository implements EstadiasRepository {
  constructor(private readonly prisma: any) {}

  async listCheckInDoDia(input: {
    page: number;
    pageSize: number;
    grupo?: GrupoCheckIn;
    inicioDoDia: Date;
    fimDoDia: Date;
  }): Promise<{ data: CheckInDoDiaRecord[]; total: number }> {
    const where = this.buildCheckInDoDiaWhere(input);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.reserva.findMany({
        where,
        include: reservaInclude,
        orderBy: {
          dataInicio: "asc"
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.reserva.count({ where })
    ]);

    return {
      data: data.map((reserva: any) => ({
        reserva: toReservaRecord(reserva),
        grupoCheckIn: reserva.dataInicio < input.inicioDoDia ? "Atrasado" : "Hoje"
      })),
      total
    };
  }

  async listActive(input: ActiveStaysListInput): Promise<{ data: EstadiaRecord[]; total: number }> {
    const where: Record<string, unknown> = {
      status: "Ativa"
    };

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

    const orderBy = {
      [input.sortField ?? "dataInicio"]: input.sortOrder ?? "asc"
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.estadia.findMany({
        where,
        include: estadiaInclude,
        orderBy,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.estadia.count({ where })
    ]);

    return {
      data: data.map(toEstadiaRecord),
      total
    };
  }

  async findReservaById(id: number) {
    return this.fetchReservaById(this.prisma, id);
  }

  async findEstadiaById(id: number) {
    return this.fetchEstadiaById(this.prisma, id);
  }

  async findEstadiaByReservaId(reservaId: number) {
    const estadia = await this.prisma.estadia.findFirst({
      where: {
        reservaId
      },
      include: estadiaInclude
    });

    return estadia ? toEstadiaRecord(estadia) : null;
  }

  async findFlatById(id: number) {
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

  async findHospedeResponsavelById(id: number) {
    return this.prisma.hospedeResponsavel.findUnique({
      where: { id },
      select: {
        id: true,
        nomeCompleto: true,
        cpf: true,
        ativo: true
      }
    });
  }

  async findAcompanhantesByIds(responsavelId: number, ids: number[]) {
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

  async findOpenCaixaByUsuarioId(usuarioId: number) {
    const caixa = await this.prisma.caixa.findFirst({
      where: {
        usuarioId,
        status: "Aberto",
        fechadoEm: null
      }
    });

    return caixa ? toCaixaRecord(caixa) : null;
  }

  async hasActiveStayForFlat(flatId: number, ignoreEstadiaId?: number) {
    const count = await this.prisma.estadia.count({
      where: {
        flatId,
        status: "Ativa",
        ...(ignoreEstadiaId
          ? {
              NOT: {
                id: ignoreEstadiaId
              }
            }
          : {})
      }
    });

    return count > 0;
  }

  async hasConflictingReservation(
    flatId: number,
    dataInicio: Date,
    dataFim: Date,
    ignoreReservaId?: number
  ) {
    const count = await this.prisma.reserva.count({
      where: {
        flatId,
        status: "Confirmada",
        dataInicio: {
          lt: dataFim
        },
        dataFim: {
          gt: dataInicio
        },
        ...(ignoreReservaId
          ? {
              NOT: {
                id: ignoreReservaId
              }
            }
          : {})
      }
    });

    return count > 0;
  }

  async createCheckInFromReservation(
    data: CreateCheckInFromReservationPayload
  ): Promise<CheckInResultRecord> {
    const ids = await this.prisma.$transaction(async (tx: any) => {
      const estadia = await tx.estadia.create({
        data: {
          reservaId: data.reservaId,
          flatId: data.flatId,
          subcategoriaId: data.subcategoriaId,
          hospedeResponsavelId: data.hospedeResponsavelId,
          dataInicio: data.dataInicio,
          dataFimPrevista: data.dataFimPrevista,
          status: "Ativa",
          quantidadeHospedes: data.quantidadeHospedes,
          cafeContratado: data.cafeContratado,
          valorBaseContratado: data.valorBaseContratado,
          valorCafePorPessoa: data.valorCafePorPessoa,
          valorCafeContratado: data.valorCafeContratado,
          valorTotalContratado: data.valorTotalContratado,
          observacoes: data.observacoes,
          ...(data.acompanhanteIds.length > 0
            ? {
                hospedes: {
                  createMany: {
                    data: data.acompanhanteIds.map((acompanhanteId) => ({
                      acompanhanteId
                    }))
                  }
                }
              }
            : {})
        }
      });

      const cobranca = await tx.cobranca.create({
        data: {
          estadiaId: estadia.id,
          competenciaInicio: data.dataInicio,
          competenciaFim: data.competenciaFim,
          valor: data.valorTotalContratado,
          status: "Paga",
          liquidadaEm: data.dataInicio
        }
      });

      const pagamento = await tx.pagamento.create({
        data: {
          cobrancaId: cobranca.id,
          usuarioId: data.usuarioId,
          caixaId: data.caixaId,
          formaPagamento: data.formaPagamento,
          valor: data.valorTotalContratado,
          comprovante: data.comprovante
        }
      });

      await tx.flat.update({
        where: { id: data.flatId },
        data: {
          statusOperacional: "Ocupado"
        }
      });

      await tx.historicoFlat.create({
        data: {
          flatId: data.flatId,
          estadiaId: estadia.id,
          usuarioId: data.usuarioId,
          tipo: "CheckIn",
          descricao: "Check-in realizado a partir de reserva existente.",
          metadata: {
            reservaId: data.reservaId
          }
        }
      });

      return {
        reservaId: data.reservaId,
        estadiaId: estadia.id,
        cobrancaId: cobranca.id,
        pagamentoId: pagamento.id
      };
    });

    return this.loadCheckInResult(ids);
  }

  async createDirectCheckIn(data: CreateDirectCheckInPayload): Promise<CheckInResultRecord> {
    const ids = await this.prisma.$transaction(async (tx: any) => {
      const reserva = await tx.reserva.create({
        data: {
          flatId: data.flatId,
          subcategoriaId: data.subcategoriaId,
          hospedeResponsavelId: data.hospedeResponsavelId,
          dataInicio: data.dataInicio,
          dataFim: data.dataFimPrevista,
          status: "Confirmada",
          quantidadeHospedes: data.quantidadeHospedes,
          cafeContratado: data.cafeContratado,
          valorBaseContratado: data.valorBaseContratado,
          valorCafePorPessoa: data.valorCafePorPessoa,
          valorCafeContratado: data.valorCafeContratado,
          valorTotalContratado: data.valorTotalContratado,
          observacoes: data.observacoes,
          ...(data.acompanhanteIds.length > 0
            ? {
                hospedes: {
                  createMany: {
                    data: data.acompanhanteIds.map((acompanhanteId) => ({
                      acompanhanteId
                    }))
                  }
                }
              }
            : {})
        }
      });

      const estadia = await tx.estadia.create({
        data: {
          reservaId: reserva.id,
          flatId: data.flatId,
          subcategoriaId: data.subcategoriaId,
          hospedeResponsavelId: data.hospedeResponsavelId,
          dataInicio: data.dataInicio,
          dataFimPrevista: data.dataFimPrevista,
          status: "Ativa",
          quantidadeHospedes: data.quantidadeHospedes,
          cafeContratado: data.cafeContratado,
          valorBaseContratado: data.valorBaseContratado,
          valorCafePorPessoa: data.valorCafePorPessoa,
          valorCafeContratado: data.valorCafeContratado,
          valorTotalContratado: data.valorTotalContratado,
          observacoes: data.observacoes,
          ...(data.acompanhanteIds.length > 0
            ? {
                hospedes: {
                  createMany: {
                    data: data.acompanhanteIds.map((acompanhanteId) => ({
                      acompanhanteId
                    }))
                  }
                }
              }
            : {})
        }
      });

      const cobranca = await tx.cobranca.create({
        data: {
          estadiaId: estadia.id,
          competenciaInicio: data.dataInicio,
          competenciaFim: data.competenciaFim,
          valor: data.valorTotalContratado,
          status: "Paga",
          liquidadaEm: data.dataInicio
        }
      });

      const pagamento = await tx.pagamento.create({
        data: {
          cobrancaId: cobranca.id,
          usuarioId: data.usuarioId,
          caixaId: data.caixaId,
          formaPagamento: data.formaPagamento,
          valor: data.valorTotalContratado,
          comprovante: data.comprovante
        }
      });

      await tx.flat.update({
        where: { id: data.flatId },
        data: {
          statusOperacional: "Ocupado"
        }
      });

      await tx.historicoFlat.create({
        data: {
          flatId: data.flatId,
          estadiaId: estadia.id,
          usuarioId: data.usuarioId,
          tipo: "CheckIn",
          descricao: "Check-in direto realizado sem reserva previa.",
          metadata: {
            reservaId: reserva.id,
            origem: "CheckInDireto"
          }
        }
      });

      return {
        reservaId: reserva.id,
        estadiaId: estadia.id,
        cobrancaId: cobranca.id,
        pagamentoId: pagamento.id
      };
    });

    return this.loadCheckInResult(ids);
  }

  async transferFlat(data: TransferFlatPayload) {
    const estadia = await this.prisma.$transaction(async (tx: any) => {
      await tx.estadia.update({
        where: {
          id: data.estadiaId
        },
        data: {
          flatId: data.novoFlatId
        }
      });

      await tx.flat.update({
        where: {
          id: data.flatAnteriorId
        },
        data: {
          statusOperacional: "Livre"
        }
      });

      await tx.flat.update({
        where: {
          id: data.novoFlatId
        },
        data: {
          statusOperacional: "Ocupado"
        }
      });

      await tx.historicoFlat.createMany({
        data: [
          {
            flatId: data.flatAnteriorId,
            estadiaId: data.estadiaId,
            usuarioId: data.usuarioId,
            tipo: "TransferenciaSaida",
            descricao: "Estadia transferida para outro flat.",
            metadata: {
              novoFlatId: data.novoFlatId,
              observacoes: data.observacoes
            }
          },
          {
            flatId: data.novoFlatId,
            estadiaId: data.estadiaId,
            usuarioId: data.usuarioId,
            tipo: "TransferenciaEntrada",
            descricao: "Estadia recebida por transferencia de flat.",
            metadata: {
              flatAnteriorId: data.flatAnteriorId,
              observacoes: data.observacoes
            }
          }
        ]
      });

      const updated = await tx.estadia.findUnique({
        where: {
          id: data.estadiaId
        },
        include: estadiaInclude
      });

      if (!updated) {
        throw new Error("Estadia nao encontrada apos transferencia.");
      }

      return updated;
    });

    return toEstadiaRecord(estadia);
  }

  async renewStay(data: RenewStayPayload) {
    const estadia = await this.prisma.$transaction(async (tx: any) => {
      await tx.estadia.update({
        where: {
          id: data.estadiaId
        },
        data: {
          dataFimPrevista: data.novaDataFimPrevista
        }
      });

      await tx.historicoFlat.create({
        data: {
          flatId: (
            await tx.estadia.findUniqueOrThrow({
              where: {
                id: data.estadiaId
              },
              select: {
                flatId: true
              }
            })
          ).flatId,
          estadiaId: data.estadiaId,
          usuarioId: data.usuarioId,
          tipo: "Renovacao",
          descricao: "Estadia renovada com nova data fim prevista.",
          metadata: {
            dataFimAnterior: data.dataFimAnterior.toISOString(),
            novaDataFimPrevista: data.novaDataFimPrevista.toISOString(),
            observacoes: data.observacoes
          }
        }
      });

      const updated = await tx.estadia.findUnique({
        where: {
          id: data.estadiaId
        },
        include: estadiaInclude
      });

      if (!updated) {
        throw new Error("Estadia nao encontrada apos renovacao.");
      }

      return updated;
    });

    return toEstadiaRecord(estadia);
  }

  private buildCheckInDoDiaWhere(input: {
    grupo?: GrupoCheckIn;
    inicioDoDia: Date;
    fimDoDia: Date;
  }): Record<string, unknown> {
    const where: Record<string, unknown> = {
      status: "Confirmada",
      estadia: {
        is: null
      }
    };

    if (input.grupo === "Hoje") {
      where.dataInicio = {
        gte: input.inicioDoDia,
        lte: input.fimDoDia
      };
    }

    if (input.grupo === "Atrasado") {
      where.dataInicio = {
        lt: input.inicioDoDia
      };
    }

    if (!input.grupo) {
      where.OR = [
        {
          dataInicio: {
            gte: input.inicioDoDia,
            lte: input.fimDoDia
          }
        },
        {
          dataInicio: {
            lt: input.inicioDoDia
          }
        }
      ];
    }

    return where;
  }

  private async loadCheckInResult(ids: {
    reservaId: number;
    estadiaId: number;
    cobrancaId: number;
    pagamentoId: number;
  }): Promise<CheckInResultRecord> {
    const [reserva, estadia, cobranca, pagamento] = await Promise.all([
      this.fetchReservaById(this.prisma, ids.reservaId),
      this.fetchEstadiaById(this.prisma, ids.estadiaId),
      this.fetchCobrancaById(this.prisma, ids.cobrancaId),
      this.fetchPagamentoById(this.prisma, ids.pagamentoId)
    ]);

    if (!reserva || !estadia || !cobranca || !pagamento) {
      throw new Error("Falha ao recarregar resultado do check-in.");
    }

    return {
      reserva,
      estadia,
      cobranca,
      pagamento
    };
  }

  private async fetchReservaById(db: PrismaDb, id: number) {
    const reserva = await db.reserva.findUnique({
      where: { id },
      include: reservaInclude
    });

    return reserva ? toReservaRecord(reserva) : null;
  }

  private async fetchEstadiaById(db: PrismaDb, id: number) {
    const estadia = await db.estadia.findUnique({
      where: { id },
      include: estadiaInclude
    });

    return estadia ? toEstadiaRecord(estadia) : null;
  }

  private async fetchCobrancaById(db: PrismaDb, id: number) {
    const cobranca = await db.cobranca.findUnique({
      where: { id }
    });

    return cobranca ? toCobrancaRecord(cobranca) : null;
  }

  private async fetchPagamentoById(db: PrismaDb, id: number) {
    const pagamento = await db.pagamento.findUnique({
      where: { id }
    });

    return pagamento ? toPagamentoRecord(pagamento) : null;
  }
}

function toReservaRecord(row: ReservaRow) {
  return {
    id: row.id,
    flatId: row.flatId,
    flat: toFlatRecord(row.flat),
    subcategoriaId: row.subcategoriaId,
    subcategoria: {
      id: row.subcategoria.id,
      nome: row.subcategoria.nome,
      precoBase: toNumber(row.subcategoria.precoBase),
      capacidadeMaxima: row.subcategoria.capacidadeMaxima
    },
    hospedeResponsavelId: row.hospedeResponsavelId,
    hospedeResponsavel: row.hospedeResponsavel,
    acompanhantes: row.hospedes.map((item: any) => item.acompanhante),
    dataInicio: row.dataInicio,
    dataFim: row.dataFim,
    status: row.status,
    quantidadeHospedes: row.quantidadeHospedes,
    cafeContratado: row.cafeContratado,
    valorBaseContratado: toNumber(row.valorBaseContratado),
    valorCafePorPessoa: toNumber(row.valorCafePorPessoa),
    valorCafeContratado: toNumber(row.valorCafeContratado),
    valorTotalContratado: toNumber(row.valorTotalContratado),
    observacoes: row.observacoes,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
  };
}

function toEstadiaRecord(row: EstadiaRow): EstadiaRecord {
  return {
    id: row.id,
    reservaId: row.reservaId,
    flatId: row.flatId,
    flat: toFlatRecord(row.flat),
    subcategoriaId: row.subcategoriaId,
    subcategoria: {
      id: row.subcategoria.id,
      nome: row.subcategoria.nome,
      precoBase: toNumber(row.subcategoria.precoBase),
      capacidadeMaxima: row.subcategoria.capacidadeMaxima
    },
    hospedeResponsavelId: row.hospedeResponsavelId,
    hospedeResponsavel: row.hospedeResponsavel,
    acompanhantes: row.hospedes.map((item: any) => item.acompanhante),
    dataInicio: row.dataInicio,
    dataFimPrevista: row.dataFimPrevista,
    dataFimEfetiva: row.dataFimEfetiva,
    status: row.status,
    quantidadeHospedes: row.quantidadeHospedes,
    cafeContratado: row.cafeContratado,
    valorBaseContratado: toNumber(row.valorBaseContratado),
    valorCafePorPessoa: toNumber(row.valorCafePorPessoa),
    valorCafeContratado: toNumber(row.valorCafeContratado),
    valorTotalContratado: toNumber(row.valorTotalContratado),
    observacoes: row.observacoes,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
  };
}

function toFlatRecord(row: FlatRow) {
  return {
    id: row.id,
    numero: row.numero,
    statusOperacional: row.statusOperacional,
    ativo: row.ativo,
    subcategoriaId: row.subcategoriaId,
    subcategoria: {
      id: row.subcategoria.id,
      nome: row.subcategoria.nome,
      precoBase: toNumber(row.subcategoria.precoBase),
      capacidadeMaxima: row.subcategoria.capacidadeMaxima
    }
  };
}

function toCaixaRecord(row: any): CaixaRecord {
  return {
    id: row.id,
    usuarioId: row.usuarioId,
    status: row.status,
    abertoEm: row.abertoEm,
    fechadoEm: row.fechadoEm,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
  };
}

function toCobrancaRecord(row: CobrancaRow): CobrancaRecord {
  return {
    id: row.id,
    estadiaId: row.estadiaId,
    competenciaInicio: row.competenciaInicio,
    competenciaFim: row.competenciaFim,
    valor: toNumber(row.valor),
    status: row.status,
    geradaEm: row.geradaEm,
    liquidadaEm: row.liquidadaEm,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
  };
}

function toPagamentoRecord(row: PagamentoRow): PagamentoRecord {
  return {
    id: row.id,
    cobrancaId: row.cobrancaId,
    usuarioId: row.usuarioId,
    caixaId: row.caixaId,
    formaPagamento: row.formaPagamento,
    valor: toNumber(row.valor),
    comprovante: row.comprovante,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
  };
}

function toNumber(value: any) {
  return Number(value);
}
