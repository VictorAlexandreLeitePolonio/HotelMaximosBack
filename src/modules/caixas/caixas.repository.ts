import type {
  CashBreakdownValue,
  CashRegisterAdjustmentRecord,
  CashRegisterPaymentRecord,
  CashRegisterRecord,
  CashRegisterUserRecord,
  CashRegistersRepository,
  ClosedCashRegistersListInput
} from "./caixas.service.js";

const userSelect = {
  id: true,
  login: true,
  nomeCompleto: true,
  perfil: true
} as const;

const paymentInclude = {
  cobranca: {
    select: {
      estadiaId: true,
      estadiaExtraId: true,
      origem: true
    }
  }
} as const;

const adjustmentInclude = {
  usuario: {
    select: userSelect
  }
} as const;

const cashRegisterInclude = {
  usuario: {
    select: userSelect
  },
  pagamentos: {
    include: paymentInclude,
    orderBy: {
      criadoEm: "asc"
    }
  },
  ajustes: {
    include: adjustmentInclude,
    orderBy: {
      criadoEm: "asc"
    }
  }
} as const;

type PrismaDb = any;
type CashRegisterRow = any;
type AdjustmentRow = any;
type PaymentRow = any;

export class PrismaCaixasRepository implements CashRegistersRepository {
  constructor(private readonly prisma: any) {}

  async findOpenByUsuarioId(usuarioId: number) {
    const caixa = await this.prisma.caixa.findFirst({
      where: {
        usuarioId,
        status: "Aberto"
      },
      include: cashRegisterInclude,
      orderBy: {
        abertoEm: "desc"
      }
    });

    return caixa ? toCashRegisterRecord(caixa) : null;
  }

  async create(data: { usuarioId: number; turno: string }) {
    const caixa = await this.prisma.caixa.create({
      data: {
        usuarioId: data.usuarioId,
        turno: data.turno,
        status: "Aberto"
      },
      include: cashRegisterInclude
    });

    return toCashRegisterRecord(caixa);
  }

  async findById(id: number) {
    const caixa = await this.prisma.caixa.findUnique({
      where: { id },
      include: cashRegisterInclude
    });

    return caixa ? toCashRegisterRecord(caixa) : null;
  }

  async close(
    id: number,
    data: {
      valoresConferidos: CashBreakdownValue[];
      resumoCalculado: CashBreakdownValue[];
      observacoesFechamento: string | null;
    }
  ) {
    const caixa = await this.prisma.caixa.update({
      where: { id },
      data: {
        status: "Fechado",
        fechadoEm: new Date(),
        observacoesFechamento: data.observacoesFechamento,
        valoresConferidos: data.valoresConferidos,
        resumoCalculado: data.resumoCalculado
      },
      include: cashRegisterInclude
    });

    return toCashRegisterRecord(caixa);
  }

  async listClosed(input: ClosedCashRegistersListInput) {
    const where: Record<string, unknown> = {
      status: "Fechado"
    };

    if (input.usuarioId !== undefined) {
      where.usuarioId = input.usuarioId;
    }

    if (input.search?.trim()) {
      const search = input.search.trim();
      where.OR = [
        {
          turno: {
            contains: search,
            mode: "insensitive"
          }
        },
        {
          usuario: {
            nomeCompleto: {
              contains: search,
              mode: "insensitive"
            }
          }
        },
        {
          usuario: {
            login: {
              contains: search,
              mode: "insensitive"
            }
          }
        }
      ];
    }

    const orderBy = {
      fechadoEm: input.sortOrder ?? "desc"
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.caixa.findMany({
        where,
        include: cashRegisterInclude,
        orderBy,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.caixa.count({ where })
    ]);

    return {
      data: data.map(toCashRegisterRecord),
      total
    };
  }

  async createAdjustment(data: {
    caixaId: number;
    usuarioId: number;
    motivo: string;
    observacoes: string | null;
    valores: CashBreakdownValue[];
  }) {
    const adjustment = await this.prisma.ajusteCaixa.create({
      data: {
        caixaId: data.caixaId,
        usuarioId: data.usuarioId,
        motivo: data.motivo,
        observacoes: data.observacoes,
        valores: data.valores
      },
      include: adjustmentInclude
    });

    return toCashRegisterAdjustmentRecord(adjustment);
  }
}

function toCashRegisterRecord(row: CashRegisterRow): CashRegisterRecord {
  return {
    id: row.id,
    usuarioId: row.usuarioId,
    usuario: toCashRegisterUserRecord(row.usuario),
    turno: row.turno ?? null,
    status: row.status,
    abertoEm: row.abertoEm,
    fechadoEm: row.fechadoEm ?? null,
    observacoesFechamento: row.observacoesFechamento ?? null,
    valoresConferidos: toBreakdownValues(row.valoresConferidos),
    resumoCalculado: toBreakdownValues(row.resumoCalculado),
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
    pagamentos: row.pagamentos.map(toCashRegisterPaymentRecord),
    ajustes: row.ajustes.map(toCashRegisterAdjustmentRecord)
  };
}

function toCashRegisterUserRecord(row: any): CashRegisterUserRecord {
  return {
    id: row.id,
    login: row.login,
    nomeCompleto: row.nomeCompleto,
    perfil: row.perfil
  };
}

function toCashRegisterPaymentRecord(row: PaymentRow): CashRegisterPaymentRecord {
  return {
    id: row.id,
    cobrancaId: row.cobrancaId,
    estadiaId: row.cobranca.estadiaId,
    estadiaExtraId: row.cobranca.estadiaExtraId ?? null,
    origemCobranca: row.cobranca.origem,
    usuarioId: row.usuarioId,
    caixaId: row.caixaId,
    formaPagamento: row.formaPagamento,
    valor: Number(row.valor),
    comprovante: row.comprovante ?? null,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
  };
}

function toCashRegisterAdjustmentRecord(row: AdjustmentRow): CashRegisterAdjustmentRecord {
  return {
    id: row.id,
    caixaId: row.caixaId,
    usuarioId: row.usuarioId,
    usuario: toCashRegisterUserRecord(row.usuario),
    motivo: row.motivo,
    observacoes: row.observacoes ?? null,
    valores: toBreakdownValues(row.valores) ?? [],
    criadoEm: row.criadoEm
  };
}

function toBreakdownValues(value: unknown): CashBreakdownValue[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const typedItem = item as { formaPagamento?: string; valor?: number };

      if (typeof typedItem.formaPagamento !== "string" || typeof typedItem.valor !== "number") {
        return null;
      }

      return {
        formaPagamento: typedItem.formaPagamento as CashBreakdownValue["formaPagamento"],
        valor: Number(typedItem.valor)
      };
    })
    .filter((item): item is CashBreakdownValue => item !== null);

  return items;
}
