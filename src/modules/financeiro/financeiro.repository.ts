import type {
  CaixaRecord,
  ChargePaymentResultRecord,
  CobrancaRecord,
  CreateMonthlyChargePayload,
  CreateStayExtraPayload,
  EstadiaExtraRecord,
  EstadiaFinanceiroRecord,
  ExtraMutationResultRecord,
  ExtraTypesListInput,
  FinanceiroRepository,
  PagamentoRecord,
  PayChargePayload,
  TipoExtraRecord
} from "./financeiro.service.js";

const chargeInclude = {
  pagamentos: {
    orderBy: {
      criadoEm: "asc"
    }
  }
} as const;

const extraInclude = {
  tipoExtra: {
    select: {
      id: true,
      nome: true,
      ativo: true
    }
  },
  cobranca: {
    include: chargeInclude
  }
} as const;

type PrismaDb = any;
type TipoExtraRow = any;
type CobrancaRow = any;
type PagamentoRow = any;
type EstadiaExtraRow = any;

export class PrismaFinanceiroRepository implements FinanceiroRepository {
  constructor(private readonly prisma: any) {}

  async findEstadiaById(id: number) {
    const estadia = await this.prisma.estadia.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        dataInicio: true,
        dataFimPrevista: true,
        dataFimEfetiva: true,
        valorTotalContratado: true
      }
    });

    return estadia ? toEstadiaFinanceiroRecord(estadia) : null;
  }

  async listCobrancasByEstadiaId(estadiaId: number) {
    const charges = await this.prisma.cobranca.findMany({
      where: { estadiaId },
      include: chargeInclude,
      orderBy: {
        competenciaInicio: "asc"
      }
    });

    return charges.map(toCobrancaRecord);
  }

  async listExtrasByEstadiaId(estadiaId: number) {
    const extras = await this.prisma.estadiaExtra.findMany({
      where: { estadiaId },
      include: extraInclude,
      orderBy: {
        criadoEm: "asc"
      }
    });

    return extras.map(toEstadiaExtraRecord);
  }

  async listTiposExtra(input: ExtraTypesListInput) {
    const where: Record<string, unknown> = {};

    if (input.search?.trim()) {
      where.nome = {
        contains: input.search.trim(),
        mode: "insensitive"
      };
    }

    if (input.ativo !== undefined) {
      where.ativo = input.ativo;
    }

    const orderBy = {
      [input.sortField ?? "nome"]: input.sortOrder ?? "asc"
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.tipoExtra.findMany({
        where,
        orderBy,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.tipoExtra.count({ where })
    ]);

    return {
      data: data.map(toTipoExtraRecord),
      total
    };
  }

  async findTipoExtraById(id: number) {
    const extraType = await this.prisma.tipoExtra.findUnique({
      where: { id }
    });

    return extraType ? toTipoExtraRecord(extraType) : null;
  }

  async findTipoExtraByNormalizedName(nomeNormalizado: string) {
    const extraType = await this.prisma.tipoExtra.findUnique({
      where: {
        nomeNormalizado
      }
    });

    return extraType ? toTipoExtraRecord(extraType) : null;
  }

  async createTipoExtra(data: Omit<TipoExtraRecord, "id" | "criadoEm" | "atualizadoEm">) {
    return toTipoExtraRecord(
      await this.prisma.tipoExtra.create({
        data: {
          nome: data.nome,
          nomeNormalizado: data.nomeNormalizado,
          valorPadrao: data.valorPadrao,
          ativo: data.ativo
        }
      })
    );
  }

  async updateTipoExtra(id: number, data: Partial<Omit<TipoExtraRecord, "id" | "criadoEm">>) {
    return toTipoExtraRecord(
      await this.prisma.tipoExtra.update({
        where: { id },
        data
      })
    );
  }

  async findOpenCaixaByUsuarioId(usuarioId: number) {
    const caixa = await this.prisma.caixa.findFirst({
      where: {
        usuarioId,
        status: "Aberto"
      },
      orderBy: {
        abertoEm: "desc"
      }
    });

    return caixa ? toCaixaRecord(caixa) : null;
  }

  async findCobrancaById(id: number) {
    const charge = await this.prisma.cobranca.findUnique({
      where: { id },
      include: chargeInclude
    });

    return charge ? toCobrancaRecord(charge) : null;
  }

  async createMonthlyCharge(data: CreateMonthlyChargePayload) {
    const charge = await this.prisma.cobranca.create({
      data: {
        estadiaId: data.estadiaId,
        origem: "Mensalidade",
        competenciaInicio: data.competenciaInicio,
        competenciaFim: data.competenciaFim,
        valor: data.valor,
        status: "Pendente"
      },
      include: chargeInclude
    });

    return toCobrancaRecord(charge);
  }

  async payCharge(data: PayChargePayload): Promise<ChargePaymentResultRecord> {
    return this.prisma.$transaction(async (tx: PrismaDb) => {
      const currentCharge = await tx.cobranca.findUnique({
        where: { id: data.cobrancaId },
        select: {
          id: true,
          estadiaExtraId: true
        }
      });

      const payment = await tx.pagamento.create({
        data: {
          cobrancaId: data.cobrancaId,
          usuarioId: data.usuarioId,
          caixaId: data.caixaId,
          formaPagamento: data.formaPagamento,
          valor: data.valor,
          comprovante: data.comprovante
        }
      });

      await tx.cobranca.update({
        where: { id: data.cobrancaId },
        data: {
          status: "Paga",
          liquidadaEm: new Date()
        }
      });

      if (currentCharge?.estadiaExtraId) {
        await tx.estadiaExtra.update({
          where: {
            id: currentCharge.estadiaExtraId
          },
          data: {
            status: "Pago",
            pagoEm: new Date()
          }
        });
      }

      const [charge, extra] = await Promise.all([
        this.fetchChargeById(tx, data.cobrancaId),
        currentCharge?.estadiaExtraId ? this.fetchExtraById(tx, currentCharge.estadiaExtraId) : null
      ]);

      return {
        cobranca: charge!,
        pagamento: toPagamentoRecord(payment),
        extra
      };
    });
  }

  async findExtraById(id: number) {
    return this.fetchExtraById(this.prisma, id);
  }

  async createStayExtra(data: CreateStayExtraPayload): Promise<ExtraMutationResultRecord> {
    return this.prisma.$transaction(async (tx: PrismaDb) => {
      const extra = await tx.estadiaExtra.create({
        data: {
          estadiaId: data.estadiaId,
          tipoExtraId: data.tipoExtraId,
          descricaoSnapshot: data.descricaoSnapshot,
          valorUnitario: data.valorUnitario,
          quantidade: data.quantidade,
          valorTotal: data.valorTotal,
          status: data.pagamento ? "Pago" : "Pendente",
          pagoEm: data.pagamento ? new Date() : null
        }
      });

      const charge = await tx.cobranca.create({
        data: {
          estadiaId: data.estadiaId,
          origem: "Extra",
          estadiaExtraId: extra.id,
          competenciaInicio: new Date(),
          competenciaFim: new Date(),
          valor: data.valorTotal,
          status: data.pagamento ? "Paga" : "Pendente",
          liquidadaEm: data.pagamento ? new Date() : null
        },
        include: chargeInclude
      });

      let payment: PagamentoRecord | null = null;

      if (data.pagamento) {
        payment = toPagamentoRecord(
          await tx.pagamento.create({
            data: {
              cobrancaId: charge.id,
              usuarioId: data.pagamento.usuarioId,
              caixaId: data.pagamento.caixaId,
              formaPagamento: data.pagamento.formaPagamento,
              valor: data.pagamento.valor,
              comprovante: data.pagamento.comprovante
            }
          })
        );
      }

      const updatedExtra = await this.fetchExtraById(tx, extra.id);

      return {
        extra: updatedExtra!,
        cobranca: toCobrancaRecord(charge),
        pagamento: payment
      };
    });
  }

  private async fetchChargeById(db: PrismaDb, id: number) {
    const charge = await db.cobranca.findUnique({
      where: { id },
      include: chargeInclude
    });

    return charge ? toCobrancaRecord(charge) : null;
  }

  private async fetchExtraById(db: PrismaDb, id: number) {
    const extra = await db.estadiaExtra.findUnique({
      where: { id },
      include: extraInclude
    });

    return extra ? toEstadiaExtraRecord(extra) : null;
  }
}

function toEstadiaFinanceiroRecord(row: any): EstadiaFinanceiroRecord {
  return {
    id: row.id,
    status: row.status,
    dataInicio: row.dataInicio,
    dataFimPrevista: row.dataFimPrevista,
    dataFimEfetiva: row.dataFimEfetiva,
    valorTotalContratado: Number(row.valorTotalContratado)
  };
}

function toTipoExtraRecord(row: TipoExtraRow): TipoExtraRecord {
  return {
    id: row.id,
    nome: row.nome,
    nomeNormalizado: row.nomeNormalizado,
    valorPadrao: Number(row.valorPadrao),
    ativo: row.ativo,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
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

function toPagamentoRecord(row: PagamentoRow): PagamentoRecord {
  return {
    id: row.id,
    cobrancaId: row.cobrancaId,
    usuarioId: row.usuarioId,
    caixaId: row.caixaId,
    formaPagamento: row.formaPagamento,
    valor: Number(row.valor),
    comprovante: row.comprovante,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
  };
}

function toCobrancaRecord(row: CobrancaRow): CobrancaRecord {
  return {
    id: row.id,
    estadiaId: row.estadiaId,
    origem: row.origem,
    estadiaExtraId: row.estadiaExtraId,
    competenciaInicio: row.competenciaInicio,
    competenciaFim: row.competenciaFim,
    valor: Number(row.valor),
    status: row.status,
    geradaEm: row.geradaEm,
    liquidadaEm: row.liquidadaEm,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
    pagamentos: row.pagamentos.map(toPagamentoRecord)
  };
}

function toEstadiaExtraRecord(row: EstadiaExtraRow): EstadiaExtraRecord {
  return {
    id: row.id,
    estadiaId: row.estadiaId,
    tipoExtraId: row.tipoExtraId,
    tipoExtra: {
      id: row.tipoExtra.id,
      nome: row.tipoExtra.nome,
      ativo: row.tipoExtra.ativo
    },
    descricaoSnapshot: row.descricaoSnapshot,
    valorUnitario: Number(row.valorUnitario),
    quantidade: row.quantidade,
    valorTotal: Number(row.valorTotal),
    status: row.status,
    pagoEm: row.pagoEm,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
    cobranca: row.cobranca ? toCobrancaRecord(row.cobranca) : null
  };
}
