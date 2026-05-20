import { describe, expect, it } from "vitest";
import {
  EstadiasService,
  type CaixaRecord,
  type CheckInDoDiaRecord,
  type CheckInResultRecord,
  type CobrancaRecord,
  type CreateCheckInFromReservationPayload,
  type CreateDirectCheckInPayload,
  type EstadiaRecord,
  type EstadiasRepository,
  type PagamentoRecord,
  type RenewStayPayload,
  type TransferFlatPayload
} from "../src/modules/estadias/estadias.service.js";
import type {
  ReservaAcompanhanteRecord,
  ReservaFlatRecord,
  ReservaHospedeResponsavelRecord,
  ReservaRecord
} from "../src/modules/reservas/reservas.service.js";

class FakeEstadiasRepository implements EstadiasRepository {
  reservas: ReservaRecord[] = [];
  estadias: EstadiaRecord[] = [];
  flats: ReservaFlatRecord[] = [];
  responsaveis: ReservaHospedeResponsavelRecord[] = [];
  acompanhantes: ReservaAcompanhanteRecord[] = [];
  caixas: CaixaRecord[] = [];
  cobrancas: CobrancaRecord[] = [];
  pagamentos: PagamentoRecord[] = [];
  checkInResults: CheckInResultRecord[] = [];
  transferHistory: TransferFlatPayload[] = [];
  renewalHistory: RenewStayPayload[] = [];

  async listCheckInDoDia(input: {
    page: number;
    pageSize: number;
    grupo?: "Hoje" | "Atrasado";
    inicioDoDia: Date;
    fimDoDia: Date;
  }) {
    const data: CheckInDoDiaRecord[] = this.reservas
      .filter((reserva) => reserva.status === "Confirmada")
      .filter((reserva) => !this.estadias.some((estadia) => estadia.reservaId === reserva.id))
      .filter((reserva) => {
        if (input.grupo === "Hoje") {
          return reserva.dataInicio >= input.inicioDoDia && reserva.dataInicio <= input.fimDoDia;
        }

        if (input.grupo === "Atrasado") {
          return reserva.dataInicio < input.inicioDoDia;
        }

        return reserva.dataInicio <= input.fimDoDia;
      })
      .map((reserva) => ({
        reserva,
        grupoCheckIn: reserva.dataInicio < input.inicioDoDia ? "Atrasado" : "Hoje"
      }));

    return {
      data,
      total: data.length
    };
  }

  async listActive(_input: {
    page: number;
    pageSize: number;
    search?: string;
    flatId?: number;
    hospedeResponsavelId?: number;
    sortField?: "dataInicio" | "dataFimPrevista" | "criadoEm" | "atualizadoEm";
    sortOrder?: "asc" | "desc";
  }) {
    return {
      data: this.estadias.filter((estadia) => estadia.status === "Ativa"),
      total: this.estadias.filter((estadia) => estadia.status === "Ativa").length
    };
  }

  async findReservaById(id: number) {
    return this.reservas.find((item) => item.id === id) ?? null;
  }

  async findEstadiaById(id: number) {
    return this.estadias.find((item) => item.id === id) ?? null;
  }

  async findEstadiaByReservaId(reservaId: number) {
    return this.estadias.find((item) => item.reservaId === reservaId) ?? null;
  }

  async findFlatById(id: number) {
    return this.flats.find((item) => item.id === id) ?? null;
  }

  async findHospedeResponsavelById(id: number) {
    return this.responsaveis.find((item) => item.id === id) ?? null;
  }

  async findAcompanhantesByIds(responsavelId: number, ids: number[]) {
    return this.acompanhantes.filter(
      (item) => item.hospedeResponsavelId === responsavelId && ids.includes(item.id)
    );
  }

  async findOpenCaixaByUsuarioId(usuarioId: number) {
    return this.caixas.find((item) => item.usuarioId === usuarioId && item.status === "Aberto") ?? null;
  }

  async hasActiveStayForFlat(flatId: number, ignoreEstadiaId?: number) {
    return this.estadias.some(
      (item) => item.flatId === flatId && item.status === "Ativa" && item.id !== ignoreEstadiaId
    );
  }

  async hasConflictingReservation(
    flatId: number,
    dataInicio: Date,
    dataFim: Date,
    ignoreReservaId?: number
  ) {
    return this.reservas.some(
      (item) =>
        item.flatId === flatId &&
        item.status === "Confirmada" &&
        item.id !== ignoreReservaId &&
        item.dataInicio < dataFim &&
        item.dataFim > dataInicio
    );
  }

  async createCheckInFromReservation(data: CreateCheckInFromReservationPayload) {
    const reserva = this.reservas.find((item) => item.id === data.reservaId);

    if (!reserva) {
      throw new Error("Reserva fake nao encontrada.");
    }

    const flat = this.requireFlat(data.flatId);
    const responsavel = this.requireResponsavel(data.hospedeResponsavelId);
    const acompanhantes = this.findAcompanhantesByIdsSync(data.hospedeResponsavelId, data.acompanhanteIds);

    const estadia: EstadiaRecord = {
      id: this.estadias.length + 1,
      reservaId: data.reservaId,
      flatId: data.flatId,
      flat,
      subcategoriaId: data.subcategoriaId,
      subcategoria: reserva.subcategoria,
      hospedeResponsavelId: data.hospedeResponsavelId,
      hospedeResponsavel: responsavel,
      acompanhantes,
      dataInicio: data.dataInicio,
      dataFimPrevista: data.dataFimPrevista,
      dataFimEfetiva: null,
      status: "Ativa",
      quantidadeHospedes: data.quantidadeHospedes,
      cafeContratado: data.cafeContratado,
      valorBaseContratado: data.valorBaseContratado,
      valorCafePorPessoa: data.valorCafePorPessoa,
      valorCafeContratado: data.valorCafeContratado,
      valorTotalContratado: data.valorTotalContratado,
      observacoes: data.observacoes,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };

    const cobranca: CobrancaRecord = {
      id: this.cobrancas.length + 1,
      estadiaId: estadia.id,
      competenciaInicio: data.dataInicio,
      competenciaFim: data.competenciaFim,
      valor: data.valorTotalContratado,
      status: "Paga",
      geradaEm: new Date(),
      liquidadaEm: data.dataInicio,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };

    const pagamento: PagamentoRecord = {
      id: this.pagamentos.length + 1,
      cobrancaId: cobranca.id,
      usuarioId: data.usuarioId,
      caixaId: data.caixaId,
      formaPagamento: data.formaPagamento,
      valor: data.valorTotalContratado,
      comprovante: data.comprovante,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };

    this.estadias.push(estadia);
    this.cobrancas.push(cobranca);
    this.pagamentos.push(pagamento);
    this.requireFlat(data.flatId).statusOperacional = "Ocupado";

    return {
      reserva,
      estadia,
      cobranca,
      pagamento
    };
  }

  async createDirectCheckIn(data: CreateDirectCheckInPayload) {
    const flat = this.requireFlat(data.flatId);
    const responsavel = this.requireResponsavel(data.hospedeResponsavelId);
    const acompanhantes = this.findAcompanhantesByIdsSync(data.hospedeResponsavelId, data.acompanhanteIds);

    const reserva: ReservaRecord = {
      id: this.reservas.length + 1,
      flatId: data.flatId,
      flat,
      subcategoriaId: data.subcategoriaId,
      subcategoria: flat.subcategoria,
      hospedeResponsavelId: data.hospedeResponsavelId,
      hospedeResponsavel: responsavel,
      acompanhantes,
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
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };

    this.reservas.push(reserva);

    return this.createCheckInFromReservation({
      ...data,
      reservaId: reserva.id
    });
  }

  async transferFlat(data: TransferFlatPayload) {
    const estadia = await this.findEstadiaById(data.estadiaId);

    if (!estadia) {
      throw new Error("Estadia fake nao encontrada.");
    }

    this.requireFlat(data.flatAnteriorId).statusOperacional = "Livre";
    const novoFlat = this.requireFlat(data.novoFlatId);
    novoFlat.statusOperacional = "Ocupado";
    estadia.flatId = data.novoFlatId;
    estadia.flat = novoFlat;
    estadia.atualizadoEm = new Date();
    this.transferHistory.push(data);

    return estadia;
  }

  async renewStay(data: RenewStayPayload) {
    const estadia = await this.findEstadiaById(data.estadiaId);

    if (!estadia) {
      throw new Error("Estadia fake nao encontrada.");
    }

    estadia.dataFimPrevista = data.novaDataFimPrevista;
    estadia.atualizadoEm = new Date();
    this.renewalHistory.push(data);

    return estadia;
  }

  private requireFlat(id: number) {
    const flat = this.flats.find((item) => item.id === id);

    if (!flat) {
      throw new Error("Flat fake nao encontrado.");
    }

    return flat;
  }

  private requireResponsavel(id: number) {
    const responsavel = this.responsaveis.find((item) => item.id === id);

    if (!responsavel) {
      throw new Error("Responsavel fake nao encontrado.");
    }

    return responsavel;
  }

  private findAcompanhantesByIdsSync(responsavelId: number, ids: number[]) {
    return this.acompanhantes.filter(
      (item) => item.hospedeResponsavelId === responsavelId && ids.includes(item.id)
    );
  }
}

function createFlat(id: number, overrides: Partial<ReservaFlatRecord> = {}): ReservaFlatRecord {
  return {
    id,
    numero: `10${id}`,
    statusOperacional: "Livre",
    ativo: true,
    subcategoriaId: 1,
    subcategoria: {
      id: 1,
      nome: "Luxo",
      precoBase: 300,
      capacidadeMaxima: 3
    },
    ...overrides
  };
}

function createResponsavel(id = 1): ReservaHospedeResponsavelRecord {
  return {
    id,
    nomeCompleto: "Maria Hospede",
    cpf: "12345678900",
    ativo: true
  };
}

function createAcompanhante(id = 1): ReservaAcompanhanteRecord {
  return {
    id,
    hospedeResponsavelId: 1,
    nomeCompleto: "Joao Acompanhante",
    documento: "RG 1",
    menorDeIdade: false
  };
}

function createReserva(flat: ReservaFlatRecord, dataInicio: Date, dataFim: Date): ReservaRecord {
  return {
    id: 1,
    flatId: flat.id,
    flat,
    subcategoriaId: flat.subcategoriaId,
    subcategoria: flat.subcategoria,
    hospedeResponsavelId: 1,
    hospedeResponsavel: createResponsavel(),
    acompanhantes: [createAcompanhante()],
    dataInicio,
    dataFim,
    status: "Confirmada",
    quantidadeHospedes: 2,
    cafeContratado: true,
    valorBaseContratado: 300,
    valorCafePorPessoa: 25,
    valorCafeContratado: 50,
    valorTotalContratado: 350,
    observacoes: "Observacao inicial",
    criadoEm: new Date(),
    atualizadoEm: new Date()
  };
}

function createCaixaAberto(usuarioId = 99): CaixaRecord {
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

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

describe("EstadiasService", () => {
  it("realiza check-in a partir de reserva com prazo padrao de 30 dias e primeira cobranca paga", async () => {
    const repository = new FakeEstadiasRepository();
    const flat = createFlat(1);
    repository.flats.push(flat);
    repository.reservas.push(createReserva(flat, new Date("2026-05-19T10:00:00.000Z"), new Date("2026-06-18T10:00:00.000Z")));
    repository.responsaveis.push(createResponsavel());
    repository.acompanhantes.push(createAcompanhante());
    repository.caixas.push(createCaixaAberto());

    const result = await new EstadiasService(repository).checkInFromReservation(1, 99, {
      dataInicioEfetiva: new Date("2026-05-20T12:00:00.000Z"),
      formaPagamento: "Pix",
      valorPago: 350,
      comprovante: "pix-123"
    });

    expect(result.estadia.dataFimPrevista).toEqual(new Date("2026-06-19T12:00:00.000Z"));
    expect(result.cobranca.status).toBe("Paga");
    expect(result.pagamento.valor).toBe(350);
    expect(repository.flats[0].statusOperacional).toBe("Ocupado");
    expect(repository.estadias).toHaveLength(1);
  });

  it("bloqueia check-in quando o usuario nao possui caixa aberto", async () => {
    const repository = new FakeEstadiasRepository();
    const flat = createFlat(1);
    repository.flats.push(flat);
    repository.reservas.push(createReserva(flat, new Date("2026-05-19T10:00:00.000Z"), new Date("2026-06-18T10:00:00.000Z")));

    await expect(
      new EstadiasService(repository).checkInFromReservation(1, 99, {
        formaPagamento: "Dinheiro",
        valorPago: 350
      })
    ).rejects.toMatchObject({
      code: "ESTADIA_009",
      statusCode: 400
    });
  });

  it("realiza check-in direto criando reserva e estadia na mesma operacao", async () => {
    const repository = new FakeEstadiasRepository();
    repository.flats.push(createFlat(1));
    repository.responsaveis.push(createResponsavel());
    repository.acompanhantes.push(createAcompanhante());
    repository.caixas.push(createCaixaAberto());

    const result = await new EstadiasService(repository).directCheckIn(99, {
      flatId: 1,
      hospedeResponsavelId: 1,
      acompanhanteIds: [1],
      dataInicio: new Date("2026-05-21T09:00:00.000Z"),
      cafeContratado: true,
      valorCafePorPessoa: 25,
      formaPagamento: "Dinheiro",
      valorPago: 350
    });

    expect(result.reserva.id).toBe(1);
    expect(result.estadia.reservaId).toBe(1);
    expect(repository.reservas).toHaveLength(1);
    expect(repository.estadias).toHaveLength(1);
  });

  it("lista check-ins do dia classificando hoje e atrasado", async () => {
    const repository = new FakeEstadiasRepository();
    const flatHoje = createFlat(1);
    const flatAtrasado = createFlat(2, { numero: "102" });
    repository.flats.push(flatHoje, flatAtrasado);
    repository.reservas.push(
      createReserva(flatHoje, new Date("2026-05-20T08:00:00.000Z"), new Date("2026-06-19T08:00:00.000Z")),
      {
        ...createReserva(flatAtrasado, new Date("2026-05-18T08:00:00.000Z"), new Date("2026-06-17T08:00:00.000Z")),
        id: 2,
        flatId: 2,
        flat: flatAtrasado
      }
    );

    const result = await new EstadiasService(repository).listCheckInDoDia({
      page: 1,
      pageSize: 10,
      referenceDate: new Date("2026-05-20T12:00:00.000Z")
    });

    expect(result.data).toHaveLength(2);
    expect(result.data.map((item) => item.grupoCheckIn).sort()).toEqual(["Atrasado", "Hoje"]);
  });

  it("troca flat preservando valor contratado e registra a transferencia", async () => {
    const repository = new FakeEstadiasRepository();
    const flatAtual = createFlat(1, { statusOperacional: "Ocupado" });
    const flatNovo = createFlat(2, {
      numero: "202",
      subcategoriaId: 2,
      subcategoria: {
        id: 2,
        nome: "Premium",
        precoBase: 500,
        capacidadeMaxima: 4
      }
    });
    const reserva = createReserva(flatAtual, new Date("2026-05-19T10:00:00.000Z"), new Date("2026-06-18T10:00:00.000Z"));
    const estadia: EstadiaRecord = {
      id: 1,
      reservaId: reserva.id,
      flatId: flatAtual.id,
      flat: flatAtual,
      subcategoriaId: reserva.subcategoriaId,
      subcategoria: reserva.subcategoria,
      hospedeResponsavelId: reserva.hospedeResponsavelId,
      hospedeResponsavel: reserva.hospedeResponsavel,
      acompanhantes: reserva.acompanhantes,
      dataInicio: reserva.dataInicio,
      dataFimPrevista: reserva.dataFim,
      dataFimEfetiva: null,
      status: "Ativa",
      quantidadeHospedes: reserva.quantidadeHospedes,
      cafeContratado: reserva.cafeContratado,
      valorBaseContratado: reserva.valorBaseContratado,
      valorCafePorPessoa: reserva.valorCafePorPessoa,
      valorCafeContratado: reserva.valorCafeContratado,
      valorTotalContratado: reserva.valorTotalContratado,
      observacoes: reserva.observacoes,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };

    repository.flats.push(flatAtual, flatNovo);
    repository.estadias.push(estadia);

    const result = await new EstadiasService(repository).transferFlat(1, 99, {
      novoFlatId: 2,
      observacoes: "Upgrade operacional"
    });

    expect(result.flatId).toBe(2);
    expect(result.valorTotalContratado).toBe(350);
    expect(repository.transferHistory).toHaveLength(1);
    expect(repository.flats[0].statusOperacional).toBe("Livre");
    expect(repository.flats[1].statusOperacional).toBe("Ocupado");
  });

  it("renova a estadia apenas com data futura maior que a atual", async () => {
    const repository = new FakeEstadiasRepository();
    const flat = createFlat(1, { statusOperacional: "Ocupado" });
    const reserva = createReserva(flat, new Date("2026-05-19T10:00:00.000Z"), new Date("2026-06-18T10:00:00.000Z"));
    repository.flats.push(flat);
    repository.estadias.push({
      id: 1,
      reservaId: reserva.id,
      flatId: flat.id,
      flat,
      subcategoriaId: reserva.subcategoriaId,
      subcategoria: reserva.subcategoria,
      hospedeResponsavelId: reserva.hospedeResponsavelId,
      hospedeResponsavel: reserva.hospedeResponsavel,
      acompanhantes: reserva.acompanhantes,
      dataInicio: reserva.dataInicio,
      dataFimPrevista: reserva.dataFim,
      dataFimEfetiva: null,
      status: "Ativa",
      quantidadeHospedes: reserva.quantidadeHospedes,
      cafeContratado: reserva.cafeContratado,
      valorBaseContratado: reserva.valorBaseContratado,
      valorCafePorPessoa: reserva.valorCafePorPessoa,
      valorCafeContratado: reserva.valorCafeContratado,
      valorTotalContratado: reserva.valorTotalContratado,
      observacoes: reserva.observacoes,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    });

    const renewed = await new EstadiasService(repository).renewStay(1, 99, {
      dataFimPrevista: addDays(new Date("2026-06-18T10:00:00.000Z"), 15),
      observacoes: "Renovacao mensal"
    });

    expect(renewed.dataFimPrevista).toEqual(new Date("2026-07-03T10:00:00.000Z"));
    expect(repository.renewalHistory).toHaveLength(1);

    await expect(
      new EstadiasService(repository).renewStay(1, 99, {
        dataFimPrevista: new Date("2026-06-18T10:00:00.000Z")
      })
    ).rejects.toMatchObject({
      code: "ESTADIA_014",
      statusCode: 400
    });
  });
});
