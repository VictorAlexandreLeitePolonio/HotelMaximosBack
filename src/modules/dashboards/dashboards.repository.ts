import { Prisma, TipoHistoricoFlat, type PrismaClient } from "@prisma/client";
import type {
  DashboardCleaningWarningRecord,
  DashboardFinancialSnapshot,
  DashboardOperationalSnapshot,
  DashboardPaymentSummaryRecord,
  DashboardReservationWarningRecord,
  DashboardStayWarningRecord,
  DashboardUserRecord,
  DashboardsRepository,
  FlatHistoryRecord,
  FlatSummaryRecord,
  ReservationNoShowRecord
} from "./dashboards.service.js";

const flatHistoryInclude = {
  usuario: {
    select: {
      id: true,
      login: true,
      nomeCompleto: true,
      perfil: true
    }
  }
} satisfies Prisma.HistoricoFlatInclude;

type FlatHistoryRow = Prisma.HistoricoFlatGetPayload<{ include: typeof flatHistoryInclude }>;

export class PrismaDashboardsRepository implements DashboardsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async loadOperationalSnapshot(input: {
    startOfOperationalDay: Date;
    endOfOperationalDay: Date;
    stayExpiryLimit: Date;
  }): Promise<DashboardOperationalSnapshot> {
    const [
      flatStatusCounts,
      estadiasAtivas,
      checkInsHoje,
      reservasRequerRealocacao,
      limpezasAbertas,
      checkInsAtrasados,
      estadiasVencendo,
      limpezasComAviso
    ] = await Promise.all([
      this.prisma.flat.groupBy({
        by: ["statusOperacional"],
        _count: {
          _all: true
        }
      }),
      this.prisma.estadia.count({
        where: {
          status: "Ativa"
        }
      }),
      this.prisma.reserva.count({
        where: {
          status: "Confirmada",
          estadia: {
            is: null
          },
          dataInicio: {
            gte: input.startOfOperationalDay,
            lte: input.endOfOperationalDay
          }
        }
      }),
      this.prisma.reserva.count({
        where: {
          status: "RequerRealocacao"
        }
      }),
      this.prisma.limpeza.count({
        where: {
          concluidaEm: null
        }
      }),
      this.prisma.reserva.findMany({
        where: {
          status: "Confirmada",
          estadia: {
            is: null
          },
          dataInicio: {
            lt: input.startOfOperationalDay
          }
        },
        select: {
          id: true,
          flatId: true,
          dataInicio: true,
          flat: {
            select: {
              numero: true
            }
          },
          hospedeResponsavel: {
            select: {
              nomeCompleto: true
            }
          }
        },
        orderBy: {
          dataInicio: "asc"
        }
      }),
      this.prisma.estadia.findMany({
        where: {
          status: "Ativa",
          dataFimPrevista: {
            lte: input.stayExpiryLimit
          }
        },
        select: {
          id: true,
          flatId: true,
          dataFimPrevista: true,
          flat: {
            select: {
              numero: true
            }
          },
          hospedeResponsavel: {
            select: {
              nomeCompleto: true
            }
          }
        },
        orderBy: {
          dataFimPrevista: "asc"
        }
      }),
      this.prisma.limpeza.findMany({
        where: {
          concluidaEm: null,
          status: {
            in: ["Pendente", "Atrasada", "Suspensa"]
          }
        },
        select: {
          id: true,
          flatId: true,
          tipo: true,
          status: true,
          dataProgramada: true,
          atrasaEm: true,
          flat: {
            select: {
              numero: true
            }
          }
        },
        orderBy: [{ status: "desc" }, { atrasaEm: "asc" }]
      })
    ]);

    return {
      flatsPorStatus: Object.fromEntries(
        flatStatusCounts.map((item) => [item.statusOperacional, item._count._all])
      ),
      estadiasAtivas,
      checkInsHoje,
      reservasRequerRealocacao,
      limpezasAbertas,
      checkInsAtrasados: checkInsAtrasados.map<DashboardReservationWarningRecord>((item) => ({
        reservaId: item.id,
        flatId: item.flatId,
        flatNumero: item.flat.numero,
        hospedeResponsavelNome: item.hospedeResponsavel.nomeCompleto,
        dataInicio: item.dataInicio
      })),
      estadiasVencendo: estadiasVencendo.map<DashboardStayWarningRecord>((item) => ({
        estadiaId: item.id,
        flatId: item.flatId,
        flatNumero: item.flat.numero,
        hospedeResponsavelNome: item.hospedeResponsavel.nomeCompleto,
        dataFimPrevista: item.dataFimPrevista
      })),
      limpezasComAviso: limpezasComAviso.map<DashboardCleaningWarningRecord>((item) => ({
        limpezaId: item.id,
        flatId: item.flatId,
        flatNumero: item.flat.numero,
        tipo: item.tipo,
        status: item.status,
        dataProgramada: item.dataProgramada,
        atrasaEm: item.atrasaEm
      }))
    };
  }

  async loadFinancialSnapshot(input: {
    startOfOperationalDay: Date;
    endOfOperationalDay: Date;
  }): Promise<DashboardFinancialSnapshot> {
    const [
      cobrancasPendentes,
      extrasPendentes,
      pagamentosHoje,
      totalCaixasAbertos,
      totalCaixasFechadosHoje
    ] = await Promise.all([
      this.prisma.cobranca.aggregate({
        where: {
          status: "Pendente"
        },
        _count: {
          _all: true
        },
        _sum: {
          valor: true
        }
      }),
      this.prisma.estadiaExtra.aggregate({
        where: {
          status: "Pendente"
        },
        _count: {
          _all: true
        },
        _sum: {
          valorTotal: true
        }
      }),
      this.prisma.pagamento.findMany({
        where: {
          criadoEm: {
            gte: input.startOfOperationalDay,
            lte: input.endOfOperationalDay
          }
        },
        select: {
          formaPagamento: true,
          valor: true
        }
      }),
      this.prisma.caixa.count({
        where: {
          status: "Aberto"
        }
      }),
      this.prisma.caixa.count({
        where: {
          status: "Fechado",
          fechadoEm: {
            gte: input.startOfOperationalDay,
            lte: input.endOfOperationalDay
          }
        }
      })
    ]);

    const pagamentosPorForma = pagamentosHoje.reduce<Record<string, DashboardPaymentSummaryRecord>>(
      (acc, item) => {
        const current = acc[item.formaPagamento] ?? {
          formaPagamento: item.formaPagamento,
          quantidade: 0,
          valor: 0
        };

        current.quantidade += 1;
        current.valor = normalizeMoney(current.valor + Number(item.valor));
        acc[item.formaPagamento] = current;
        return acc;
      },
      {}
    );

    return {
      totalCobrancasPendentes: cobrancasPendentes._count._all,
      valorCobrancasPendentes: Number(cobrancasPendentes._sum.valor ?? 0),
      totalExtrasPendentes: extrasPendentes._count._all,
      valorExtrasPendentes: Number(extrasPendentes._sum.valorTotal ?? 0),
      totalPagamentosHoje: pagamentosHoje.length,
      valorPagamentosHoje: normalizeMoney(
        pagamentosHoje.reduce((total, item) => total + Number(item.valor), 0)
      ),
      totalCaixasAbertos,
      totalCaixasFechadosHoje,
      pagamentosHojePorForma: Object.values(pagamentosPorForma).sort((left, right) =>
        left.formaPagamento.localeCompare(right.formaPagamento)
      )
    };
  }

  async findReservationForNoShow(id: number): Promise<ReservationNoShowRecord | null> {
    const reserva = await this.prisma.reserva.findUnique({
      where: {
        id
      },
      select: {
        id: true,
        flatId: true,
        status: true,
        dataInicio: true,
        dataFim: true,
        estadia: {
          select: {
            id: true
          }
        }
      }
    });

    if (!reserva) {
      return null;
    }

    return {
      id: reserva.id,
      flatId: reserva.flatId,
      status: reserva.status,
      dataInicio: reserva.dataInicio,
      dataFim: reserva.dataFim,
      estadiaId: reserva.estadia?.id ?? null
    };
  }

  async markReservationAsNoShow(data: {
    reservaId: number;
    usuario: { id: number; nomeCompleto: string; perfil: "Admin" | "Recepcionista" };
    motivo: string;
    observacoes: string | null;
    marcadoEm: Date;
  }): Promise<{ reserva: ReservationNoShowRecord; historico: FlatHistoryRecord }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const reserva = await tx.reserva.update({
        where: {
          id: data.reservaId
        },
        data: {
          status: "NoShow"
        },
        select: {
          id: true,
          flatId: true,
          status: true,
          dataInicio: true,
          dataFim: true
        }
      });

      const historico = (await tx.historicoFlat.create({
        data: {
          flatId: reserva.flatId,
          usuarioId: data.usuario.id,
          tipo: TipoHistoricoFlat.NoShowManual,
          descricao: "Reserva marcada manualmente como no-show.",
          metadata: {
            reservaId: reserva.id,
            motivo: data.motivo,
            observacoes: data.observacoes,
            usuarioNome: data.usuario.nomeCompleto,
            usuarioPerfil: data.usuario.perfil,
            marcadoEm: data.marcadoEm.toISOString()
          }
        },
        include: flatHistoryInclude
      })) as FlatHistoryRow;

      return {
        reserva: {
          id: reserva.id,
          flatId: reserva.flatId,
          status: reserva.status,
          dataInicio: reserva.dataInicio,
          dataFim: reserva.dataFim,
          estadiaId: null
        },
        historico: toFlatHistoryRecord(historico)
      };
    });

    return result;
  }

  async findFlatById(id: number): Promise<FlatSummaryRecord | null> {
    const flat = await this.prisma.flat.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        statusOperacional: true
      }
    });

    return flat;
  }

  async listFlatHistory(input: {
    flatId: number;
    page: number;
    pageSize: number;
  }): Promise<{ data: FlatHistoryRecord[]; total: number }> {
    const where: Prisma.HistoricoFlatWhereInput = {
      flatId: input.flatId
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.historicoFlat.findMany({
        where,
        include: flatHistoryInclude,
        orderBy: {
          criadoEm: "desc"
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.historicoFlat.count({ where })
    ]);

    return {
      data: data.map(toFlatHistoryRecord),
      total
    };
  }

  async createOperationalObservation(data: {
    flatId: number;
    usuario: { id: number; login: string; nomeCompleto: string; perfil: "Admin" | "Recepcionista" };
    descricao: string;
    observacoes: string | null;
    criadoEm: Date;
  }): Promise<FlatHistoryRecord> {
    const historico = (await this.prisma.historicoFlat.create({
      data: {
        flatId: data.flatId,
        usuarioId: data.usuario.id,
        tipo: TipoHistoricoFlat.ObservacaoOperacional,
        descricao: data.descricao,
        metadata: {
          observacoes: data.observacoes,
          usuarioNome: data.usuario.nomeCompleto,
          usuarioLogin: data.usuario.login,
          usuarioPerfil: data.usuario.perfil,
          criadoEm: data.criadoEm.toISOString()
        }
      },
      include: flatHistoryInclude
    })) as FlatHistoryRow;

    return toFlatHistoryRecord(historico);
  }

  async findFlatHistoryEntry(flatId: number, historyId: number): Promise<FlatHistoryRecord | null> {
    const historico = await this.prisma.historicoFlat.findFirst({
      where: {
        id: historyId,
        flatId
      },
      include: flatHistoryInclude
    });

    return historico ? toFlatHistoryRecord(historico) : null;
  }

  async createOperationalObservationCorrection(data: {
    flatId: number;
    historyId: number;
    usuario: { id: number; login: string; nomeCompleto: string; perfil: "Admin" | "Recepcionista" };
    descricaoCorrigida: string;
    motivo: string;
    observacoes: string | null;
    criadoEm: Date;
    historicoOriginal: FlatHistoryRecord;
  }): Promise<FlatHistoryRecord> {
    const historico = (await this.prisma.historicoFlat.create({
      data: {
        flatId: data.flatId,
        usuarioId: data.usuario.id,
        tipo: TipoHistoricoFlat.ObservacaoOperacionalCorrigida,
        descricao: "Observacao operacional corrigida administrativamente.",
        metadata: {
          historicoOriginalId: data.historyId,
          descricaoOriginal: data.historicoOriginal.descricao,
          descricaoCorrigida: data.descricaoCorrigida,
          motivo: data.motivo,
          observacoes: data.observacoes,
          usuarioNome: data.usuario.nomeCompleto,
          usuarioLogin: data.usuario.login,
          usuarioPerfil: data.usuario.perfil,
          criadoEm: data.criadoEm.toISOString()
        }
      },
      include: flatHistoryInclude
    })) as FlatHistoryRow;

    return toFlatHistoryRecord(historico);
  }

  async createOperationalObservationCancellation(data: {
    flatId: number;
    historyId: number;
    usuario: { id: number; login: string; nomeCompleto: string; perfil: "Admin" | "Recepcionista" };
    motivo: string;
    observacoes: string | null;
    criadoEm: Date;
    historicoOriginal: FlatHistoryRecord;
  }): Promise<FlatHistoryRecord> {
    const historico = (await this.prisma.historicoFlat.create({
      data: {
        flatId: data.flatId,
        usuarioId: data.usuario.id,
        tipo: TipoHistoricoFlat.ObservacaoOperacionalCancelada,
        descricao: "Observacao operacional cancelada administrativamente.",
        metadata: {
          historicoOriginalId: data.historyId,
          descricaoOriginal: data.historicoOriginal.descricao,
          motivo: data.motivo,
          observacoes: data.observacoes,
          usuarioNome: data.usuario.nomeCompleto,
          usuarioLogin: data.usuario.login,
          usuarioPerfil: data.usuario.perfil,
          criadoEm: data.criadoEm.toISOString()
        }
      },
      include: flatHistoryInclude
    })) as FlatHistoryRow;

    return toFlatHistoryRecord(historico);
  }
}

function toFlatHistoryRecord(row: FlatHistoryRow): FlatHistoryRecord {
  return {
    id: row.id,
    flatId: row.flatId,
    estadiaId: row.estadiaId,
    usuario: row.usuario ? toDashboardUserRecord(row.usuario) : null,
    tipo: row.tipo,
    descricao: row.descricao,
    metadata: isRecord(row.metadata) ? row.metadata : null,
    criadoEm: row.criadoEm
  };
}

function toDashboardUserRecord(row: {
  id: number;
  login: string;
  nomeCompleto: string;
  perfil: "Admin" | "Recepcionista";
}): DashboardUserRecord {
  return row;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMoney(value: number) {
  return Number(value.toFixed(2));
}
