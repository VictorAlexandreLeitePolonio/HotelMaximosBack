import type {
  CheckoutCleaningCandidateRecord,
  CleaningRecord,
  CleaningStatus,
  CleaningType,
  CompleteCleaningPayload,
  CreateCleaningInput,
  LimpezasRepository,
  WeeklyCleaningStayRecord,
  CleaningListInput
} from "./limpezas.service.js";

const cleaningInclude = {
  flat: {
    select: {
      id: true,
      numero: true,
      statusOperacional: true
    }
  },
  usuarioConclusao: {
    select: {
      id: true,
      login: true,
      nomeCompleto: true,
      perfil: true
    }
  }
} as const;

export class PrismaLimpezasRepository implements LimpezasRepository {
  constructor(private readonly prisma: any) {}

  async listActiveStaysForWeeklyGeneration(): Promise<WeeklyCleaningStayRecord[]> {
    const estadias = await this.prisma.estadia.findMany({
      where: {
        status: "Ativa"
      },
      select: {
        id: true,
        flatId: true,
        dataInicio: true,
        flat: {
          select: {
            id: true,
            numero: true,
            statusOperacional: true
          }
        }
      }
    });

    return estadias.map((row: any) => ({
      estadiaId: row.id,
      flatId: row.flatId,
      flat: {
        id: row.flat.id,
        numero: row.flat.numero,
        statusOperacional: row.flat.statusOperacional
      },
      dataInicio: row.dataInicio
    }));
  }

  async listCheckoutCleaningCandidates(): Promise<CheckoutCleaningCandidateRecord[]> {
    const estadias = await this.prisma.estadia.findMany({
      where: {
        status: "Encerrada",
        dataFimEfetiva: {
          not: null
        },
        flat: {
          statusOperacional: {
            in: ["AguardandoLimpeza", "Manutencao"]
          }
        }
      },
      select: {
        id: true,
        flatId: true,
        dataFimEfetiva: true,
        flat: {
          select: {
            id: true,
            numero: true,
            statusOperacional: true
          }
        }
      }
    });

    return estadias.map((row: any) => ({
      estadiaId: row.id,
      flatId: row.flatId,
      flat: {
        id: row.flat.id,
        numero: row.flat.numero,
        statusOperacional: row.flat.statusOperacional
      },
      dataCheckout: row.dataFimEfetiva ?? new Date()
    }));
  }

  async findExistingGenerationKeys(keys: string[]) {
    if (keys.length === 0) {
      return [];
    }

    const cleanings = await this.prisma.limpeza.findMany({
      where: {
        chaveGeracao: {
          in: keys
        }
      },
      select: {
        chaveGeracao: true
      }
    });

    return cleanings.map((item: { chaveGeracao: string }) => item.chaveGeracao);
  }

  async createMany(cleanings: CreateCleaningInput[]) {
    if (cleanings.length === 0) {
      return;
    }

    await this.prisma.limpeza.createMany({
      data: cleanings
    });
  }

  async listOpenCleanings(): Promise<CleaningRecord[]> {
    const cleanings = await this.prisma.limpeza.findMany({
      where: {
        concluidaEm: null
      },
      include: cleaningInclude
    });

    return cleanings.map(toCleaningRecord);
  }

  async updateStatuses(changes: Array<{ id: number; status: CleaningStatus }>) {
    if (changes.length === 0) {
      return;
    }

    await this.prisma.$transaction(
      changes.map((item) =>
        this.prisma.limpeza.update({
          where: {
            id: item.id
          },
          data: {
            status: item.status
          }
        })
      )
    );
  }

  async list(input: CleaningListInput) {
    const where: Record<string, unknown> = {};

    if (input.tipo) {
      where.tipo = input.tipo;
    }

    if (input.status) {
      where.status = input.status;
    }

    if (input.flatId !== undefined) {
      where.flatId = input.flatId;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.limpeza.findMany({
        where,
        include: cleaningInclude,
        orderBy: {
          dataProgramada: input.sortOrder ?? "desc"
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.limpeza.count({ where })
    ]);

    return {
      data: data.map(toCleaningRecord),
      total
    };
  }

  async findById(id: number) {
    const cleaning = await this.prisma.limpeza.findUnique({
      where: {
        id
      },
      include: cleaningInclude
    });

    return cleaning ? toCleaningRecord(cleaning) : null;
  }

  async complete(id: number, payload: CompleteCleaningPayload) {
    await this.prisma.$transaction(async (tx: any) => {
      const cleaning = await tx.limpeza.findUniqueOrThrow({
        where: {
          id
        },
        select: {
          flatId: true
        }
      });

      await tx.limpeza.update({
        where: {
          id
        },
        data: {
          status: "Concluida",
          concluidaEm: payload.concluidaEm,
          usuarioConclusaoId: payload.usuarioConclusaoId,
          observacoesConclusao: payload.observacoesConclusao
        }
      });

      if (payload.nextFlatStatus) {
        await tx.flat.update({
          where: {
            id: cleaning.flatId
          },
          data: {
            statusOperacional: payload.nextFlatStatus
          }
        });
      }
    });

    const cleaning = await this.prisma.limpeza.findUnique({
      where: {
        id
      },
      include: cleaningInclude
    });

    if (!cleaning) {
      throw new Error("Falha ao recarregar a limpeza apos a conclusao.");
    }

    return toCleaningRecord(cleaning);
  }
}

function toCleaningRecord(row: any): CleaningRecord {
  return {
    id: row.id,
    chaveGeracao: row.chaveGeracao,
    flatId: row.flatId,
    flat: {
      id: row.flat.id,
      numero: row.flat.numero,
      statusOperacional: row.flat.statusOperacional
    },
    estadiaId: row.estadiaId,
    tipo: row.tipo as CleaningType,
    status: row.status as CleaningStatus,
    dataProgramada: row.dataProgramada,
    atrasaEm: row.atrasaEm,
    concluidaEm: row.concluidaEm,
    usuarioConclusaoId: row.usuarioConclusaoId,
    usuarioConclusao: row.usuarioConclusao
      ? {
          id: row.usuarioConclusao.id,
          login: row.usuarioConclusao.login,
          nomeCompleto: row.usuarioConclusao.nomeCompleto,
          perfil: row.usuarioConclusao.perfil
        }
      : null,
    observacoesConclusao: row.observacoesConclusao,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
  };
}
