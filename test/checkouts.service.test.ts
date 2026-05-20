import { describe, expect, it } from "vitest";
import {
  CheckoutsService,
  type CheckoutContextRecord,
  type CheckoutsRepository,
  type FinalizeCheckoutPayload
} from "../src/modules/checkouts/checkouts.service.js";
import type { AuthUserRecord } from "../src/modules/auth/auth.service.js";
import type { CobrancaRecord, EstadiaExtraRecord } from "../src/modules/financeiro/financeiro.service.js";
import type { EstadiaRecord } from "../src/modules/estadias/estadias.service.js";

class FakeCheckoutsRepository implements CheckoutsRepository {
  context: CheckoutContextRecord | null = null;
  lastFinalizePayload: FinalizeCheckoutPayload | null = null;

  async findByEstadiaId(id: number) {
    if (!this.context || this.context.estadia.id !== id) {
      return null;
    }

    return this.context;
  }

  async finalizeCheckout(data: FinalizeCheckoutPayload) {
    if (!this.context) {
      throw new Error("Contexto fake nao configurado.");
    }

    this.lastFinalizePayload = data;
    this.context.estadia.status = "Encerrada";
    this.context.estadia.dataFimEfetiva = data.dataCheckout;
    this.context.estadia.atualizadoEm = data.dataCheckout;
    this.context.estadia.flat.statusOperacional = "AguardandoLimpeza";

    return this.context;
  }
}

function createService() {
  const repository = new FakeCheckoutsRepository();
  const service = new CheckoutsService(repository);

  return {
    repository,
    service
  };
}

function createAdminUser(): AuthUserRecord {
  return {
    id: 10,
    login: "admin",
    loginNormalizado: "admin",
    nomeCompleto: "Administrador Local",
    email: "admin@hotelmaximos.local",
    senhaHash: "hash",
    perfil: "Admin",
    ativo: true,
    deveAlterarSenha: false
  };
}

function createRecepcionistaUser(): AuthUserRecord {
  return {
    id: 20,
    login: "recepcao",
    loginNormalizado: "recepcao",
    nomeCompleto: "Recepcao Local",
    email: "recepcao@hotelmaximos.local",
    senhaHash: "hash",
    perfil: "Recepcionista",
    ativo: true,
    deveAlterarSenha: false
  };
}

function createCheckoutContext(
  overrides?: Partial<CheckoutContextRecord> & {
    estadia?: Partial<EstadiaRecord>;
    cobrancas?: CobrancaRecord[];
    extras?: EstadiaExtraRecord[];
  }
): CheckoutContextRecord {
  const estadia = createStay(overrides?.estadia);

  return {
    estadia,
    cobrancas:
      overrides?.cobrancas ??
      [
        createCharge({
          estadiaId: estadia.id,
          valor: 900,
          status: "Paga",
          pagamentos: [createPayment({ valor: 900 })]
        })
      ],
    extras: overrides?.extras ?? []
  };
}

function createStay(overrides?: Partial<EstadiaRecord>): EstadiaRecord {
  return {
    id: 1,
    reservaId: 1,
    flatId: 1,
    flat: {
      id: 1,
      numero: "101",
      statusOperacional: "Ocupado"
    },
    subcategoriaId: 2,
    subcategoria: {
      id: 2,
      nome: "Suite",
      precoBase: 900,
      capacidadeMaxima: 2
    },
    hospedeResponsavelId: 3,
    hospedeResponsavel: {
      id: 3,
      nomeCompleto: "Hospede Principal",
      cpf: "123.456.789-00"
    },
    acompanhantes: [],
    dataInicio: new Date("2026-05-01T12:00:00.000Z"),
    dataFimPrevista: new Date("2026-05-31T12:00:00.000Z"),
    dataFimEfetiva: null,
    status: "Ativa",
    quantidadeHospedes: 1,
    cafeContratado: false,
    valorBaseContratado: 900,
    valorCafePorPessoa: 0,
    valorCafeContratado: 0,
    valorTotalContratado: 900,
    observacoes: null,
    criadoEm: new Date("2026-05-01T12:00:00.000Z"),
    atualizadoEm: new Date("2026-05-01T12:00:00.000Z"),
    ...overrides
  };
}

function createPayment(overrides?: Partial<CobrancaRecord["pagamentos"][number]>) {
  return {
    id: 1,
    cobrancaId: 1,
    usuarioId: 10,
    caixaId: 1,
    formaPagamento: "Dinheiro" as const,
    valor: 900,
    comprovante: null,
    criadoEm: new Date("2026-05-01T12:00:00.000Z"),
    atualizadoEm: new Date("2026-05-01T12:00:00.000Z"),
    ...overrides
  };
}

function createCharge(overrides?: Partial<CobrancaRecord>): CobrancaRecord {
  return {
    id: 1,
    estadiaId: 1,
    origem: "Mensalidade",
    estadiaExtraId: null,
    competenciaInicio: new Date("2026-05-01T12:00:00.000Z"),
    competenciaFim: new Date("2026-05-31T12:00:00.000Z"),
    valor: 900,
    status: "Paga",
    geradaEm: new Date("2026-05-01T12:00:00.000Z"),
    liquidadaEm: new Date("2026-05-01T12:00:00.000Z"),
    criadoEm: new Date("2026-05-01T12:00:00.000Z"),
    atualizadoEm: new Date("2026-05-01T12:00:00.000Z"),
    pagamentos: [createPayment()],
    ...overrides
  };
}

function createExtra(overrides?: Partial<EstadiaExtraRecord>): EstadiaExtraRecord {
  const cobranca = createCharge({
    id: 2,
    origem: "Extra",
    estadiaExtraId: 1,
    valor: 120,
    status: "Pendente",
    liquidadaEm: null,
    pagamentos: []
  });

  return {
    id: 1,
    estadiaId: 1,
    tipoExtraId: 5,
    tipoExtra: {
      id: 5,
      nome: "Frigobar",
      ativo: true
    },
    descricaoSnapshot: "Frigobar",
    valorUnitario: 120,
    quantidade: 1,
    valorTotal: 120,
    status: "Pendente",
    pagoEm: null,
    criadoEm: new Date("2026-05-02T12:00:00.000Z"),
    atualizadoEm: new Date("2026-05-02T12:00:00.000Z"),
    cobranca,
    ...overrides
  };
}

describe("CheckoutsService", () => {
  it("blocks recepcionista checkout when there is pending debt", async () => {
    const { repository, service } = createService();

    repository.context = createCheckoutContext({
      cobrancas: [
        createCharge({
          status: "Pendente",
          liquidadaEm: null,
          pagamentos: []
        })
      ]
    });

    await expect(service.checkout(1, createRecepcionistaUser(), {})).rejects.toMatchObject({
      code: "CHECKOUT_003",
      statusCode: 403
    });
  });

  it("requires override reason for admin checkout with pending debt", async () => {
    const { repository, service } = createService();

    repository.context = createCheckoutContext({
      cobrancas: [
        createCharge({
          status: "Pendente",
          liquidadaEm: null,
          pagamentos: []
        })
      ]
    });

    await expect(service.checkout(1, createAdminUser(), {})).rejects.toMatchObject({
      code: "CHECKOUT_004",
      statusCode: 400
    });
  });

  it("allows admin override, closes the stay and moves the flat to cleaning", async () => {
    const { repository, service } = createService();

    repository.context = createCheckoutContext({
      cobrancas: [
        createCharge({
          id: 1,
          status: "Paga",
          pagamentos: [createPayment({ valor: 900 })]
        }),
        createCharge({
          id: 2,
          origem: "Extra",
          estadiaExtraId: 1,
          valor: 120,
          status: "Pendente",
          liquidadaEm: null,
          pagamentos: []
        })
      ],
      extras: [createExtra()]
    });

    const result = await service.checkout(1, createAdminUser(), {
      motivoOverride: "Debito residual alinhado com o hospede."
    });

    expect(result.estadia.status).toBe("Encerrada");
    expect(result.estadia.flat.statusOperacional).toBe("AguardandoLimpeza");
    expect(result.override.aplicado).toBe(true);
    expect(result.override.motivo).toBe("Debito residual alinhado com o hospede.");
    expect(result.resumoFinanceiro.totalPendente).toBe(120);
    expect(result.recibo.downloadUrl).toBe("/api/estadias/1/checkout/recibo");
    expect(repository.lastFinalizePayload?.motivoOverride).toBe(
      "Debito residual alinhado com o hospede."
    );
  });

  it("allows regular checkout with no pending debt and no override", async () => {
    const { repository, service } = createService();

    repository.context = createCheckoutContext();

    const result = await service.checkout(1, createRecepcionistaUser(), {});

    expect(result.override.aplicado).toBe(false);
    expect(result.resumoFinanceiro.totalPendente).toBe(0);
    expect(result.estadia.dataFimEfetiva).not.toBeNull();
  });

  it("generates receipt pdf only after stay is closed", async () => {
    const { repository, service } = createService();

    repository.context = createCheckoutContext({
      estadia: {
        status: "Encerrada",
        dataFimEfetiva: new Date("2026-05-20T12:30:00.000Z")
      }
    });

    const receipt = await service.generateReceiptPdf(1);

    expect(receipt.fileName).toContain("recibo-checkout-estadia-1");
    expect(receipt.buffer.byteLength).toBeGreaterThan(0);
  });
});
