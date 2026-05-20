import { describe, expect, it } from "vitest";
import {
  FinanceiroService,
  type CaixaRecord,
  type ChargePaymentResultRecord,
  type CobrancaRecord,
  type CreateMonthlyChargePayload,
  type CreateStayExtraPayload,
  type EstadiaExtraRecord,
  type EstadiaFinanceiroRecord,
  type ExtraMutationResultRecord,
  type ExtraTypesListInput,
  type FinanceiroRepository,
  type PagamentoRecord,
  type PayChargePayload,
  type TipoExtraRecord
} from "../src/modules/financeiro/financeiro.service.js";

class FakeFinanceiroRepository implements FinanceiroRepository {
  estadias: EstadiaFinanceiroRecord[] = [];
  caixas: CaixaRecord[] = [];
  tiposExtra: TipoExtraRecord[] = [];
  cobrancas: CobrancaRecord[] = [];
  extras: EstadiaExtraRecord[] = [];
  pagamentos: PagamentoRecord[] = [];

  async findEstadiaById(id: number) {
    return this.estadias.find((item) => item.id === id) ?? null;
  }

  async listCobrancasByEstadiaId(estadiaId: number) {
    return this.cobrancas.filter((item) => item.estadiaId === estadiaId);
  }

  async listExtrasByEstadiaId(estadiaId: number) {
    return this.extras.filter((item) => item.estadiaId === estadiaId);
  }

  async listTiposExtra(input: ExtraTypesListInput) {
    let data = [...this.tiposExtra];

    if (input.search?.trim()) {
      const search = input.search.trim().toLowerCase();
      data = data.filter((item) => item.nome.toLowerCase().includes(search));
    }

    if (input.ativo !== undefined) {
      data = data.filter((item) => item.ativo === input.ativo);
    }

    return {
      data,
      total: data.length
    };
  }

  async findTipoExtraById(id: number) {
    return this.tiposExtra.find((item) => item.id === id) ?? null;
  }

  async findTipoExtraByNormalizedName(nomeNormalizado: string) {
    return this.tiposExtra.find((item) => item.nomeNormalizado === nomeNormalizado) ?? null;
  }

  async createTipoExtra(data: Omit<TipoExtraRecord, "id" | "criadoEm" | "atualizadoEm">) {
    const record: TipoExtraRecord = {
      id: this.tiposExtra.length + 1,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      ...data
    };

    this.tiposExtra.push(record);
    return record;
  }

  async updateTipoExtra(id: number, data: Partial<Omit<TipoExtraRecord, "id" | "criadoEm">>) {
    const current = this.tiposExtra.find((item) => item.id === id);

    if (!current) {
      throw new Error("Tipo extra fake não encontrado.");
    }

    Object.assign(current, data, { atualizadoEm: new Date() });
    return current;
  }

  async findOpenCaixaByUsuarioId(usuarioId: number) {
    return this.caixas.find((item) => item.usuarioId === usuarioId && item.status === "Aberto") ?? null;
  }

  async findCobrancaById(id: number) {
    return this.cobrancas.find((item) => item.id === id) ?? null;
  }

  async createMonthlyCharge(data: CreateMonthlyChargePayload) {
    const charge = createCharge({
      id: this.cobrancas.length + 1,
      estadiaId: data.estadiaId,
      origem: "Mensalidade",
      competenciaInicio: data.competenciaInicio,
      competenciaFim: data.competenciaFim,
      valor: data.valor
    });

    this.cobrancas.push(charge);
    return charge;
  }

  async payCharge(data: PayChargePayload): Promise<ChargePaymentResultRecord> {
    const charge = this.cobrancas.find((item) => item.id === data.cobrancaId);

    if (!charge) {
      throw new Error("Cobrança fake não encontrada.");
    }

    const payment: PagamentoRecord = {
      id: this.pagamentos.length + 1,
      cobrancaId: charge.id,
      usuarioId: data.usuarioId,
      caixaId: data.caixaId,
      formaPagamento: data.formaPagamento,
      valor: data.valor,
      comprovante: data.comprovante,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };

    this.pagamentos.push(payment);
    charge.pagamentos.push(payment);
    charge.status = "Paga";
    charge.liquidadaEm = new Date();
    charge.atualizadoEm = new Date();

    const extra =
      charge.estadiaExtraId !== null
        ? this.extras.find((item) => item.id === charge.estadiaExtraId) ?? null
        : null;

    if (extra) {
      extra.status = "Pago";
      extra.pagoEm = new Date();
      extra.atualizadoEm = new Date();
      extra.cobranca = charge;
    }

    return {
      cobranca: charge,
      pagamento: payment,
      extra
    };
  }

  async findExtraById(id: number) {
    return this.extras.find((item) => item.id === id) ?? null;
  }

  async createStayExtra(data: CreateStayExtraPayload): Promise<ExtraMutationResultRecord> {
    const tipoExtra = this.tiposExtra.find((item) => item.id === data.tipoExtraId);

    if (!tipoExtra) {
      throw new Error("Tipo extra fake não encontrado.");
    }

    const charge = createCharge({
      id: this.cobrancas.length + 1,
      estadiaId: data.estadiaId,
      origem: "Extra",
      estadiaExtraId: this.extras.length + 1,
      competenciaInicio: new Date("2026-05-19T12:00:00.000Z"),
      competenciaFim: new Date("2026-05-19T12:00:00.000Z"),
      valor: data.valorTotal,
      status: data.pagamento ? "Paga" : "Pendente",
      liquidadaEm: data.pagamento ? new Date() : null
    });

    const extra: EstadiaExtraRecord = {
      id: this.extras.length + 1,
      estadiaId: data.estadiaId,
      tipoExtraId: data.tipoExtraId,
      tipoExtra: {
        id: tipoExtra.id,
        nome: tipoExtra.nome,
        ativo: tipoExtra.ativo
      },
      descricaoSnapshot: data.descricaoSnapshot,
      valorUnitario: data.valorUnitario,
      quantidade: data.quantidade,
      valorTotal: data.valorTotal,
      status: data.pagamento ? "Pago" : "Pendente",
      pagoEm: data.pagamento ? new Date() : null,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      cobranca: charge
    };

    let payment: PagamentoRecord | null = null;

    if (data.pagamento) {
      payment = {
        id: this.pagamentos.length + 1,
        cobrancaId: charge.id,
        usuarioId: data.pagamento.usuarioId,
        caixaId: data.pagamento.caixaId,
        formaPagamento: data.pagamento.formaPagamento,
        valor: data.pagamento.valor,
        comprovante: data.pagamento.comprovante,
        criadoEm: new Date(),
        atualizadoEm: new Date()
      };

      this.pagamentos.push(payment);
      charge.pagamentos.push(payment);
    }

    this.cobrancas.push(charge);
    this.extras.push(extra);

    return {
      extra,
      cobranca: charge,
      pagamento: payment
    };
  }
}

function createService() {
  const repository = new FakeFinanceiroRepository();
  const service = new FinanceiroService(repository);

  return {
    repository,
    service
  };
}

function createStay(overrides: Partial<EstadiaFinanceiroRecord> = {}): EstadiaFinanceiroRecord {
  return {
    id: 1,
    status: "Ativa",
    dataInicio: new Date("2026-01-01T00:00:00.000Z"),
    dataFimPrevista: new Date("2026-03-02T00:00:00.000Z"),
    dataFimEfetiva: null,
    valorTotalContratado: 900,
    ...overrides
  };
}

function createOpenCashRegister(usuarioId = 10): CaixaRecord {
  return {
    id: 1,
    usuarioId,
    status: "Aberto",
    abertoEm: new Date(),
    fechadoEm: null,
    criadoEm: new Date(),
    atualizadoEm: new Date()
  };
}

function createExtraType(overrides: Partial<TipoExtraRecord> = {}): TipoExtraRecord {
  return {
    id: 1,
    nome: "Lavanderia",
    nomeNormalizado: "lavanderia",
    valorPadrao: 35,
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...overrides
  };
}

function createCharge(overrides: Partial<CobrancaRecord> = {}): CobrancaRecord {
  return {
    id: 1,
    estadiaId: 1,
    origem: "Mensalidade",
    estadiaExtraId: null,
    competenciaInicio: new Date("2026-01-01T00:00:00.000Z"),
    competenciaFim: new Date("2026-01-31T00:00:00.000Z"),
    valor: 900,
    status: "Pendente",
    geradaEm: new Date(),
    liquidadaEm: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    pagamentos: [],
    ...overrides
  };
}

describe("financeiro service", () => {
  it("generates only the current competence when the stay ended early after the next cycle started", async () => {
    const { repository, service } = createService();
    repository.estadias.push(
      createStay({
        status: "Encerrada",
        dataFimEfetiva: new Date("2026-02-15T00:00:00.000Z")
      })
    );
    repository.cobrancas.push(
      createCharge({
        competenciaInicio: new Date("2026-01-01T00:00:00.000Z"),
        competenciaFim: new Date("2026-01-31T00:00:00.000Z"),
        status: "Paga"
      })
    );

    const result = await service.generateMonthlyCharges(1, {
      referenceDate: new Date("2026-04-01T00:00:00.000Z")
    });

    expect(result.cobrancasGeradas).toHaveLength(1);
    expect(result.cobrancasGeradas[0]).toMatchObject({
      competenciaInicio: new Date("2026-01-31T00:00:00.000Z"),
      competenciaFim: new Date("2026-03-02T00:00:00.000Z"),
      valor: 900
    });
  });

  it("blocks payment without an open cash register", async () => {
    const { repository, service } = createService();
    repository.cobrancas.push(createCharge());

    await expect(
      service.payCharge(1, 10, {
        formaPagamento: "Dinheiro",
        valorPago: 900
      })
    ).rejects.toMatchObject({
      code: "FINANCEIRO_003"
    });
  });

  it("creates a pending extra with its own pending charge", async () => {
    const { repository, service } = createService();
    repository.estadias.push(createStay());
    repository.tiposExtra.push(createExtraType());

    const result = await service.createStayExtra(1, 10, {
      tipoExtraId: 1,
      quantidade: 2
    });

    expect(result.extra).toMatchObject({
      descricaoSnapshot: "Lavanderia",
      quantidade: 2,
      valorUnitario: 35,
      valorTotal: 70,
      status: "Pendente"
    });
    expect(result.cobranca).toMatchObject({
      origem: "Extra",
      valor: 70,
      status: "Pendente"
    });
    expect(result.pagamento).toBeNull();
  });

  it("creates and pays the extra immediately when payment data is provided", async () => {
    const { repository, service } = createService();
    repository.estadias.push(createStay());
    repository.caixas.push(createOpenCashRegister(10));
    repository.tiposExtra.push(createExtraType());

    const result = await service.createStayExtra(1, 10, {
      tipoExtraId: 1,
      pagarAgora: true,
      formaPagamento: "Pix",
      valorPago: 35,
      comprovante: "storage/comprovantes/pix-123.png"
    });

    expect(result.extra.status).toBe("Pago");
    expect(result.cobranca.status).toBe("Paga");
    expect(result.pagamento).toMatchObject({
      formaPagamento: "Pix",
      valor: 35,
      comprovante: "storage/comprovantes/pix-123.png"
    });
  });

  it("blocks extra payment without a proof for non-cash methods", async () => {
    const { repository, service } = createService();
    repository.caixas.push(createOpenCashRegister(10));
    repository.extras.push({
      id: 1,
      estadiaId: 1,
      tipoExtraId: 1,
      tipoExtra: {
        id: 1,
        nome: "Lavanderia",
        ativo: true
      },
      descricaoSnapshot: "Lavanderia",
      valorUnitario: 35,
      quantidade: 1,
      valorTotal: 35,
      status: "Pendente",
      pagoEm: null,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      cobranca: createCharge({
        id: 3,
        origem: "Extra",
        estadiaExtraId: 1,
        valor: 35
      })
    });
    repository.cobrancas.push(repository.extras[0].cobranca!);

    await expect(
      service.payExtra(1, 10, {
        formaPagamento: "Pix",
        valorPago: 35
      })
    ).rejects.toMatchObject({
      code: "FINANCEIRO_004"
    });
  });

  it("rejects duplicate extra type names after normalization", async () => {
    const { repository, service } = createService();
    repository.tiposExtra.push(createExtraType());

    await expect(
      service.createExtraType({
        nome: "  LAVANDERIA  ",
        valorPadrao: 40
      })
    ).rejects.toMatchObject({
      code: "FINANCEIRO_009"
    });
  });
});
