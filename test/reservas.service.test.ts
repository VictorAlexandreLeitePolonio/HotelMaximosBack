import { describe, expect, it } from "vitest";
import {
  ReservasService,
  type CreateReservaPayload,
  type DisponibilidadeFlatRecord,
  type DisponibilidadeInput,
  type ReservaAcompanhanteRecord,
  type ReservaFlatRecord,
  type ReservaHospedeResponsavelRecord,
  type ReservaRecord,
  type ReservasListInput,
  type ReservasRepository
} from "../src/modules/reservas/reservas.service.js";

class FakeReservasRepository implements ReservasRepository {
  reservas: ReservaRecord[] = [];
  flats: ReservaFlatRecord[] = [];
  responsaveis: ReservaHospedeResponsavelRecord[] = [];
  acompanhantes: ReservaAcompanhanteRecord[] = [];

  async list() {
    return {
      data: this.reservas,
      total: this.reservas.length
    };
  }

  async findById(id: number) {
    return this.reservas.find((item) => item.id === id) ?? null;
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

  async hasConflictingReservation(flatId: number, dataInicio: Date, dataFim: Date) {
    return this.reservas.some(
      (item) =>
        item.flatId === flatId &&
        item.status === "Confirmada" &&
        item.dataInicio < dataFim &&
        item.dataFim > dataInicio
    );
  }

  async hasFutureReservationForFlat(flatId: number, now: Date) {
    return this.reservas.some(
      (item) => item.flatId === flatId && item.status === "Confirmada" && item.dataInicio >= now
    );
  }

  async listAvailability(input: DisponibilidadeInput) {
    const data: DisponibilidadeFlatRecord[] = this.flats.map((flat) => ({
      ...flat,
      bloqueadoPorReserva: this.reservas.some(
        (reserva) =>
          reserva.flatId === flat.id &&
          reserva.status === "Confirmada" &&
          reserva.dataInicio < input.dataFim &&
          reserva.dataFim > input.dataInicio
      )
    }));

    return {
      data,
      total: data.length
    };
  }

  async create(data: CreateReservaPayload) {
    const flat = await this.findFlatById(data.flatId);
    const responsavel = await this.findHospedeResponsavelById(data.hospedeResponsavelId);

    if (!flat || !responsavel) {
      throw new Error("Dependencia fake nao encontrada.");
    }

    const reserva: ReservaRecord = {
      id: this.reservas.length + 1,
      flatId: data.flatId,
      flat,
      subcategoriaId: data.subcategoriaId,
      subcategoria: flat.subcategoria,
      hospedeResponsavelId: data.hospedeResponsavelId,
      hospedeResponsavel: responsavel,
      acompanhantes: this.acompanhantes.filter((item) => data.acompanhanteIds.includes(item.id)),
      dataInicio: data.dataInicio,
      dataFim: data.dataFim,
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
    return reserva;
  }
}

function createRepository() {
  const repository = new FakeReservasRepository();
  repository.flats.push(createFlat());
  repository.responsaveis.push({
    id: 1,
    nomeCompleto: "Maria Silva",
    cpf: "12345678901",
    ativo: true
  });
  repository.acompanhantes.push({
    id: 1,
    hospedeResponsavelId: 1,
    nomeCompleto: "Joao Silva",
    documento: "RG123",
    menorDeIdade: false
  });
  return repository;
}

function createFlat(overrides: Partial<ReservaFlatRecord> = {}): ReservaFlatRecord {
  return {
    id: 1,
    numero: "101",
    statusOperacional: "Livre",
    ativo: true,
    subcategoriaId: 1,
    subcategoria: {
      id: 1,
      nome: "Luxo",
      precoBase: 300,
      capacidadeMaxima: 2
    },
    ...overrides
  };
}

function baseInput() {
  return {
    flatId: 1,
    hospedeResponsavelId: 1,
    acompanhanteIds: [1],
    dataInicio: new Date("2026-06-01T12:00:00.000Z"),
    dataFim: new Date("2026-06-30T12:00:00.000Z"),
    cafeContratado: true,
    valorCafePorPessoa: 25
  };
}

describe("ReservasService", () => {
  it("creates reservation with responsible guest, companions and contracted price snapshot", async () => {
    const repository = createRepository();

    const result = await new ReservasService(repository).create(baseInput());

    expect(result).toMatchObject({
      flatId: 1,
      hospedeResponsavelId: 1,
      quantidadeHospedes: 2,
      cafeContratado: true,
      valorBaseContratado: 300,
      valorCafePorPessoa: 25,
      valorCafeContratado: 50,
      valorTotalContratado: 350
    });
    expect(result.acompanhantes).toHaveLength(1);
  });

  it("keeps reservation snapshot when subcategory price changes later", async () => {
    const repository = createRepository();
    const service = new ReservasService(repository);

    const result = await service.create(baseInput());
    repository.flats[0].subcategoria.precoBase = 500;

    expect(result.valorBaseContratado).toBe(300);
    expect(repository.reservas[0].valorTotalContratado).toBe(350);
  });

  it("rejects overlapping reservation for the same flat with RESERVA_006", async () => {
    const repository = createRepository();
    const service = new ReservasService(repository);
    await service.create(baseInput());

    await expect(
      service.create({
        ...baseInput(),
        acompanhanteIds: [],
        dataInicio: new Date("2026-06-15T12:00:00.000Z"),
        dataFim: new Date("2026-07-01T12:00:00.000Z")
      })
    ).rejects.toMatchObject({
      code: "RESERVA_006",
      statusCode: 409
    });
  });

  it("allows adjacent reservation when previous reservation ends at the next start", async () => {
    const repository = createRepository();
    const service = new ReservasService(repository);
    await service.create(baseInput());

    const result = await service.create({
      ...baseInput(),
      acompanhanteIds: [],
      dataInicio: new Date("2026-06-30T12:00:00.000Z"),
      dataFim: new Date("2026-07-30T12:00:00.000Z")
    });

    expect(result.id).toBe(2);
  });

  it("returns availability blocked by real reservation interval", async () => {
    const repository = createRepository();
    const service = new ReservasService(repository);
    await service.create(baseInput());

    const result = await service.listAvailability({
      page: 1,
      pageSize: 10,
      dataInicio: new Date("2026-06-10T12:00:00.000Z"),
      dataFim: new Date("2026-06-20T12:00:00.000Z")
    });

    expect(result.data[0]).toMatchObject({
      id: 1,
      statusDisponibilidade: "Reservado",
      disponivel: false
    });
  });

  it("rejects reservation when guest count exceeds subcategory capacity", async () => {
    const repository = createRepository();
    repository.flats[0].subcategoria.capacidadeMaxima = 1;

    await expect(new ReservasService(repository).create(baseInput())).rejects.toMatchObject({
      code: "RESERVA_007",
      statusCode: 400
    });
  });
});
