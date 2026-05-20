import { describe, expect, it } from "vitest";
import {
  LimpezasService,
  type CheckoutCleaningCandidateRecord,
  type CleaningListInput,
  type CleaningRecord,
  type CleaningStatus,
  type CleaningType,
  type CleaningUserRecord,
  type CompleteCleaningPayload,
  type CreateCleaningInput,
  type LimpezasRepository,
  type WeeklyCleaningStayRecord
} from "../src/modules/limpezas/limpezas.service.js";

class FakeLimpezasRepository implements LimpezasRepository {
  activeStays: WeeklyCleaningStayRecord[] = [];
  checkoutCandidates: CheckoutCleaningCandidateRecord[] = [];
  cleanings: CleaningRecord[] = [];

  async listActiveStaysForWeeklyGeneration() {
    return this.activeStays;
  }

  async listCheckoutCleaningCandidates() {
    return this.checkoutCandidates;
  }

  async findExistingGenerationKeys(keys: string[]) {
    return this.cleanings
      .filter((item) => keys.includes(item.chaveGeracao))
      .map((item) => item.chaveGeracao);
  }

  async createMany(cleanings: CreateCleaningInput[]) {
    for (const cleaning of cleanings) {
      const flat = this.findFlat(cleaning.flatId);
      this.cleanings.push({
        id: this.cleanings.length + 1,
        chaveGeracao: cleaning.chaveGeracao,
        flatId: cleaning.flatId,
        flat,
        estadiaId: cleaning.estadiaId,
        tipo: cleaning.tipo,
        status: cleaning.status,
        dataProgramada: cleaning.dataProgramada,
        atrasaEm: cleaning.atrasaEm,
        concluidaEm: null,
        usuarioConclusaoId: null,
        usuarioConclusao: null,
        observacoesConclusao: null,
        criadoEm: cleaning.dataProgramada,
        atualizadoEm: cleaning.dataProgramada
      });
    }
  }

  async listOpenCleanings() {
    return this.cleanings.filter((item) => item.concluidaEm === null);
  }

  async updateStatuses(changes: Array<{ id: number; status: CleaningStatus }>) {
    for (const change of changes) {
      const cleaning = this.cleanings.find((item) => item.id === change.id);

      if (cleaning) {
        cleaning.status = change.status;
      }
    }
  }

  async list(input: CleaningListInput) {
    let data = [...this.cleanings];

    if (input.tipo) {
      data = data.filter((item) => item.tipo === input.tipo);
    }

    if (input.status) {
      data = data.filter((item) => item.status === input.status);
    }

    if (input.flatId !== undefined) {
      data = data.filter((item) => item.flatId === input.flatId);
    }

    data.sort((left, right) =>
      input.sortOrder === "asc"
        ? left.dataProgramada.getTime() - right.dataProgramada.getTime()
        : right.dataProgramada.getTime() - left.dataProgramada.getTime()
    );

    return {
      data: data.slice((input.page - 1) * input.pageSize, input.page * input.pageSize),
      total: data.length
    };
  }

  async findById(id: number) {
    return this.cleanings.find((item) => item.id === id) ?? null;
  }

  async complete(id: number, payload: CompleteCleaningPayload) {
    const cleaning = this.cleanings.find((item) => item.id === id);

    if (!cleaning) {
      throw new Error("Limpeza fake nao encontrada.");
    }

    cleaning.status = "Concluida";
    cleaning.concluidaEm = payload.concluidaEm;
    cleaning.usuarioConclusaoId = payload.usuarioConclusaoId;
    cleaning.usuarioConclusao = createUser({ id: payload.usuarioConclusaoId });
    cleaning.observacoesConclusao = payload.observacoesConclusao;
    cleaning.atualizadoEm = payload.concluidaEm;

    if (payload.nextFlatStatus) {
      cleaning.flat.statusOperacional = payload.nextFlatStatus;
    }

    return cleaning;
  }

  private findFlat(flatId: number) {
    return (
      this.activeStays.find((item) => item.flatId === flatId)?.flat ??
      this.checkoutCandidates.find((item) => item.flatId === flatId)?.flat ??
      createFlat(flatId)
    );
  }
}

function createUser(overrides: Partial<CleaningUserRecord> = {}): CleaningUserRecord {
  return {
    id: 10,
    login: "recepcao",
    nomeCompleto: "Recepcao Hotel",
    perfil: "Recepcionista",
    ...overrides
  };
}

function createFlat(id: number, overrides: Partial<CleaningRecord["flat"]> = {}) {
  return {
    id,
    numero: String(100 + id),
    statusOperacional: "Ocupado" as const,
    ...overrides
  };
}

function createActiveStay(overrides: Partial<WeeklyCleaningStayRecord> = {}): WeeklyCleaningStayRecord {
  return {
    estadiaId: 1,
    flatId: 1,
    flat: createFlat(1, { statusOperacional: "Ocupado" }),
    dataInicio: new Date("2026-05-20T15:00:00.000Z"),
    ...overrides
  };
}

function createCheckoutCandidate(
  overrides: Partial<CheckoutCleaningCandidateRecord> = {}
): CheckoutCleaningCandidateRecord {
  return {
    estadiaId: 2,
    flatId: 2,
    flat: createFlat(2, { statusOperacional: "AguardandoLimpeza" }),
    dataCheckout: new Date("2026-05-24T12:00:00.000Z"),
    ...overrides
  };
}

function createCleaning(overrides: Partial<CleaningRecord> = {}): CleaningRecord {
  return {
    id: 1,
    chaveGeracao: "weekly:1:2026-05-22",
    flatId: 1,
    flat: createFlat(1, { statusOperacional: "Ocupado" }),
    estadiaId: 1,
    tipo: "Semanal",
    status: "Pendente",
    dataProgramada: new Date("2026-05-22T03:00:00.000Z"),
    atrasaEm: new Date("2026-05-24T03:00:00.000Z"),
    concluidaEm: null,
    usuarioConclusaoId: null,
    usuarioConclusao: null,
    observacoesConclusao: null,
    criadoEm: new Date("2026-05-22T03:00:00.000Z"),
    atualizadoEm: new Date("2026-05-22T03:00:00.000Z"),
    ...overrides
  };
}

describe("LimpezasService", () => {
  it("gera limpeza semanal na sexta para estadia ativa", async () => {
    const repository = new FakeLimpezasRepository();
    const service = new LimpezasService(repository);

    repository.activeStays = [createActiveStay()];

    const result = await service.list(
      {
        page: 1,
        pageSize: 10
      },
      new Date("2026-05-22T12:00:00.000Z")
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.tipo).toBe<CleaningType>("Semanal");
    expect(result.data[0]?.status).toBe<CleaningStatus>("Pendente");
    expect(result.data[0]?.dataProgramada.toISOString()).toBe("2026-05-22T03:00:00.000Z");
    expect(result.data[0]?.atrasaEm.toISOString()).toBe("2026-05-24T03:00:00.000Z");
  });

  it("marca limpeza semanal como atrasada apos domingo 00:00 em Sao Paulo", async () => {
    const repository = new FakeLimpezasRepository();
    const service = new LimpezasService(repository);

    repository.cleanings = [
      createCleaning({
        atrasaEm: new Date("2026-05-24T03:00:00.000Z")
      })
    ];

    const result = await service.list(
      {
        page: 1,
        pageSize: 10
      },
      new Date("2026-05-24T03:01:00.000Z")
    );

    expect(result.data[0]?.status).toBe<CleaningStatus>("Atrasada");
  });

  it("gera limpeza de checkout para flat aguardando limpeza", async () => {
    const repository = new FakeLimpezasRepository();
    const service = new LimpezasService(repository);

    repository.checkoutCandidates = [createCheckoutCandidate()];

    const result = await service.list(
      {
        page: 1,
        pageSize: 10
      },
      new Date("2026-05-24T12:10:00.000Z")
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.tipo).toBe<CleaningType>("Checkout");
    expect(result.data[0]?.flat.statusOperacional).toBe("AguardandoLimpeza");
  });

  it("conclui limpeza de checkout e libera o flat para livre", async () => {
    const repository = new FakeLimpezasRepository();
    const service = new LimpezasService(repository);

    repository.cleanings = [
      createCleaning({
        id: 7,
        chaveGeracao: "checkout:7",
        flatId: 7,
        flat: createFlat(7, { statusOperacional: "AguardandoLimpeza" }),
        estadiaId: 7,
        tipo: "Checkout",
        dataProgramada: new Date("2026-05-24T12:00:00.000Z"),
        atrasaEm: new Date("2026-05-25T12:00:00.000Z")
      })
    ];

    const result = await service.complete(
      7,
      createUser(),
      {
        observacoes: "Limpeza finalizada pela recepcao."
      },
      new Date("2026-05-24T18:00:00.000Z")
    );

    expect(result.status).toBe<CleaningStatus>("Concluida");
    expect(result.flat.statusOperacional).toBe("Livre");
    expect(result.observacoesConclusao).toBe("Limpeza finalizada pela recepcao.");
  });
});
