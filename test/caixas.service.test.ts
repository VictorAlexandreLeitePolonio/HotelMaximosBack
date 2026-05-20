import { describe, expect, it } from "vitest";
import {
  CaixasService,
  type CashBreakdownValue,
  type CashRegisterAdjustmentRecord,
  type CashRegisterPaymentRecord,
  type CashRegisterRecord,
  type CashRegisterUserRecord,
  type CashRegistersRepository,
  type ClosedCashRegistersListInput
} from "../src/modules/caixas/caixas.service.js";

class FakeCaixasRepository implements CashRegistersRepository {
  caixas: CashRegisterRecord[] = [];
  adjustments: CashRegisterAdjustmentRecord[] = [];

  async findOpenByUsuarioId(usuarioId: number) {
    return this.caixas.find((item) => item.usuarioId === usuarioId && item.status === "Aberto") ?? null;
  }

  async create(data: { usuarioId: number; turno: string }) {
    const user = createUser({ id: data.usuarioId });
    const caixa = createCashRegister({
      id: this.caixas.length + 1,
      usuarioId: data.usuarioId,
      usuario: user,
      turno: data.turno
    });

    this.caixas.push(caixa);
    return caixa;
  }

  async findById(id: number) {
    return this.caixas.find((item) => item.id === id) ?? null;
  }

  async close(
    id: number,
    data: {
      valoresConferidos: CashBreakdownValue[];
      resumoCalculado: CashBreakdownValue[];
      observacoesFechamento: string | null;
    }
  ) {
    const caixa = this.caixas.find((item) => item.id === id);

    if (!caixa) {
      throw new Error("Caixa fake nao encontrado.");
    }

    caixa.status = "Fechado";
    caixa.fechadoEm = new Date("2026-05-20T21:00:00.000Z");
    caixa.observacoesFechamento = data.observacoesFechamento;
    caixa.valoresConferidos = data.valoresConferidos;
    caixa.resumoCalculado = data.resumoCalculado;
    caixa.atualizadoEm = new Date("2026-05-20T21:00:00.000Z");

    return caixa;
  }

  async listClosed(input: ClosedCashRegistersListInput) {
    const data = this.caixas.filter((item) => item.status === "Fechado");
    const paginated = data.slice((input.page - 1) * input.pageSize, input.page * input.pageSize);

    return {
      data: paginated,
      total: data.length
    };
  }

  async createAdjustment(data: {
    caixaId: number;
    usuarioId: number;
    motivo: string;
    observacoes: string | null;
    valores: CashBreakdownValue[];
  }) {
    const caixa = this.caixas.find((item) => item.id === data.caixaId);

    if (!caixa) {
      throw new Error("Caixa fake nao encontrado.");
    }

    const adjustment: CashRegisterAdjustmentRecord = {
      id: this.adjustments.length + 1,
      caixaId: data.caixaId,
      usuarioId: data.usuarioId,
      usuario: createUser({ id: data.usuarioId, perfil: "Admin", login: "admin", nomeCompleto: "Admin Hotel" }),
      motivo: data.motivo,
      observacoes: data.observacoes,
      valores: data.valores,
      criadoEm: new Date("2026-05-20T22:00:00.000Z")
    };

    this.adjustments.push(adjustment);
    caixa.ajustes.push(adjustment);
    caixa.atualizadoEm = new Date("2026-05-20T22:00:00.000Z");

    return adjustment;
  }
}

function createUser(overrides: Partial<CashRegisterUserRecord> = {}): CashRegisterUserRecord {
  return {
    id: 10,
    login: "recepcao",
    nomeCompleto: "Recepcao Hotel",
    perfil: "Recepcionista",
    ...overrides
  };
}

function createPayment(overrides: Partial<CashRegisterPaymentRecord> = {}): CashRegisterPaymentRecord {
  return {
    id: 1,
    cobrancaId: 1,
    estadiaId: 1,
    estadiaExtraId: null,
    origemCobranca: "Mensalidade",
    usuarioId: 10,
    caixaId: 1,
    formaPagamento: "Dinheiro",
    valor: 100,
    comprovante: null,
    criadoEm: new Date("2026-05-20T08:00:00.000Z"),
    atualizadoEm: new Date("2026-05-20T08:00:00.000Z"),
    ...overrides
  };
}

function createCashRegister(overrides: Partial<CashRegisterRecord> = {}): CashRegisterRecord {
  const user = overrides.usuario ?? createUser({ id: overrides.usuarioId ?? 10 });

  return {
    id: 1,
    usuarioId: user.id,
    usuario: user,
    turno: "Manha",
    status: "Aberto",
    abertoEm: new Date("2026-05-20T08:00:00.000Z"),
    fechadoEm: null,
    observacoesFechamento: null,
    valoresConferidos: null,
    resumoCalculado: null,
    criadoEm: new Date("2026-05-20T08:00:00.000Z"),
    atualizadoEm: new Date("2026-05-20T08:00:00.000Z"),
    pagamentos: [],
    ajustes: [],
    ...overrides
  };
}

describe("CaixasService", () => {
  it("abre um caixa e bloqueia uma segunda abertura para o mesmo usuario", async () => {
    const repository = new FakeCaixasRepository();
    const service = new CaixasService(repository);
    const user = createUser();

    const opened = await service.openCashRegister(user, {
      turno: "Manha"
    });

    expect(opened.turno).toBe("Manha");
    expect(opened.status).toBe("Aberto");

    await expect(
      service.openCashRegister(user, {
        turno: "Tarde"
      })
    ).rejects.toMatchObject({
      code: "CAIXA_001"
    });
  });

  it("fecha o proprio caixa e calcula divergencia por forma de pagamento", async () => {
    const repository = new FakeCaixasRepository();
    const service = new CaixasService(repository);
    const user = createUser();

    repository.caixas.push(
      createCashRegister({
        pagamentos: [
          createPayment({
            id: 1,
            formaPagamento: "Dinheiro",
            valor: 100
          }),
          createPayment({
            id: 2,
            formaPagamento: "Pix",
            valor: 50
          })
        ]
      })
    );

    const result = await service.closeCashRegister(user, 1, {
      valoresConferidos: [
        { formaPagamento: "Dinheiro", valor: 90 },
        { formaPagamento: "Pix", valor: 50 }
      ],
      observacoes: "Conferencia do turno da manha"
    });

    expect(result.status).toBe("Fechado");
    expect(result.observacoesFechamento).toBe("Conferencia do turno da manha");
    expect(result.resumoFechamento).not.toBeNull();
    expect(result.resumoFechamento?.totalCalculado).toBe(150);
    expect(result.resumoFechamento?.totalConferido).toBe(140);
    expect(result.resumoFechamento?.diferencaTotal).toBe(-10);
  });

  it("bloqueia fechamento de caixa de outro usuario", async () => {
    const repository = new FakeCaixasRepository();
    const service = new CaixasService(repository);

    repository.caixas.push(
      createCashRegister({
        usuarioId: 20,
        usuario: createUser({ id: 20, login: "recepcao-noite", nomeCompleto: "Recepcao Noite" })
      })
    );

    await expect(
      service.closeCashRegister(createUser(), 1, {
        valoresConferidos: []
      })
    ).rejects.toMatchObject({
      code: "CAIXA_004"
    });
  });

  it("cria ajuste administrativo sem alterar os pagamentos originais", async () => {
    const repository = new FakeCaixasRepository();
    const service = new CaixasService(repository);
    const admin = createUser({
      id: 1,
      perfil: "Admin",
      login: "admin",
      nomeCompleto: "Admin Hotel"
    });

    repository.caixas.push(
      createCashRegister({
        status: "Fechado",
        fechadoEm: new Date("2026-05-20T21:00:00.000Z"),
        pagamentos: [
          createPayment({
            id: 1,
            formaPagamento: "Dinheiro",
            valor: 100
          })
        ],
        valoresConferidos: [{ formaPagamento: "Dinheiro", valor: 100 }],
        resumoCalculado: [{ formaPagamento: "Dinheiro", valor: 100 }]
      })
    );

    const result = await service.createAdjustment(admin, 1, {
      motivo: "Retirada administrativa",
      valores: [{ formaPagamento: "Dinheiro", valor: -15 }]
    });

    expect(result.pagamentos).toHaveLength(1);
    expect(result.ajustes).toHaveLength(1);
    expect(result.resumoFechamento?.totalCalculado).toBe(100);
    expect(result.resumoFechamento?.totalAjustes).toBe(-15);
    expect(result.resumoFechamento?.totalFinal).toBe(85);
  });

  it("gera o PDF do fechamento de um caixa encerrado", async () => {
    const repository = new FakeCaixasRepository();
    const service = new CaixasService(repository);
    const admin = createUser({
      id: 1,
      perfil: "Admin",
      login: "admin",
      nomeCompleto: "Admin Hotel"
    });

    repository.caixas.push(
      createCashRegister({
        status: "Fechado",
        fechadoEm: new Date("2026-05-20T21:00:00.000Z"),
        pagamentos: [
          createPayment({
            id: 1,
            formaPagamento: "Dinheiro",
            valor: 100
          })
        ],
        valoresConferidos: [{ formaPagamento: "Dinheiro", valor: 100 }],
        resumoCalculado: [{ formaPagamento: "Dinheiro", valor: 100 }]
      })
    );

    const pdf = await service.generateClosingPdf(admin, 1);

    expect(pdf.fileName).toContain("caixa-1-2026-05-20");
    expect(pdf.buffer.byteLength).toBeGreaterThan(100);
  });
});
