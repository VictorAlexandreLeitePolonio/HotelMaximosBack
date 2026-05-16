import { AppError } from "../../shared/errors/app-error.js";
import type { FlatStatus } from "../flats/flats.service.js";

export type ReservaStatus = "Confirmada" | "Cancelada" | "NoShow";

export type ReservaSubcategoriaRecord = {
  id: number;
  nome: string;
  precoBase: number;
  capacidadeMaxima: number;
};

export type ReservaFlatRecord = {
  id: number;
  numero: string;
  statusOperacional: FlatStatus;
  ativo: boolean;
  subcategoriaId: number;
  subcategoria: ReservaSubcategoriaRecord;
};

export type ReservaHospedeResponsavelRecord = {
  id: number;
  nomeCompleto: string;
  cpf: string;
  ativo: boolean;
};

export type ReservaAcompanhanteRecord = {
  id: number;
  hospedeResponsavelId: number;
  nomeCompleto: string;
  documento: string | null;
  menorDeIdade: boolean;
};

export type ReservaRecord = {
  id: number;
  flatId: number;
  flat: ReservaFlatRecord;
  subcategoriaId: number;
  subcategoria: ReservaSubcategoriaRecord;
  hospedeResponsavelId: number;
  hospedeResponsavel: ReservaHospedeResponsavelRecord;
  acompanhantes: ReservaAcompanhanteRecord[];
  dataInicio: Date;
  dataFim: Date;
  status: ReservaStatus;
  quantidadeHospedes: number;
  cafeContratado: boolean;
  valorBaseContratado: number;
  valorCafePorPessoa: number;
  valorCafeContratado: number;
  valorTotalContratado: number;
  observacoes: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type CreateReservaInput = {
  flatId: number;
  hospedeResponsavelId: number;
  acompanhanteIds?: number[];
  dataInicio: Date;
  dataFim: Date;
  cafeContratado: boolean;
  valorCafePorPessoa?: number;
  observacoes?: string;
};

export type ReservasListInput = {
  page: number;
  pageSize: number;
  search?: string;
  flatId?: number;
  hospedeResponsavelId?: number;
  status?: ReservaStatus;
  dataInicio?: Date;
  dataFim?: Date;
  sortField?: "dataInicio" | "dataFim" | "criadoEm" | "atualizadoEm";
  sortOrder?: "asc" | "desc";
};

export type DisponibilidadeInput = {
  page: number;
  pageSize: number;
  dataInicio: Date;
  dataFim: Date;
  categoriaId?: number;
  subcategoriaId?: number;
};

export type CreateReservaPayload = {
  flatId: number;
  subcategoriaId: number;
  hospedeResponsavelId: number;
  acompanhanteIds: number[];
  dataInicio: Date;
  dataFim: Date;
  quantidadeHospedes: number;
  cafeContratado: boolean;
  valorBaseContratado: number;
  valorCafePorPessoa: number;
  valorCafeContratado: number;
  valorTotalContratado: number;
  observacoes: string | null;
};

export type DisponibilidadeFlatRecord = ReservaFlatRecord & {
  bloqueadoPorReserva: boolean;
};

export type ReservasRepository = {
  list(input: ReservasListInput): Promise<{ data: ReservaRecord[]; total: number }>;
  findById(id: number): Promise<ReservaRecord | null>;
  findFlatById(id: number): Promise<ReservaFlatRecord | null>;
  findHospedeResponsavelById(id: number): Promise<ReservaHospedeResponsavelRecord | null>;
  findAcompanhantesByIds(responsavelId: number, ids: number[]): Promise<ReservaAcompanhanteRecord[]>;
  hasConflictingReservation(flatId: number, dataInicio: Date, dataFim: Date): Promise<boolean>;
  hasFutureReservationForFlat(flatId: number, now: Date): Promise<boolean>;
  listAvailability(input: DisponibilidadeInput): Promise<{ data: DisponibilidadeFlatRecord[]; total: number }>;
  create(data: CreateReservaPayload): Promise<ReservaRecord>;
};

const OPERATIONAL_BLOCKING_STATUSES: FlatStatus[] = ["Ocupado", "AguardandoLimpeza", "Manutencao"];

export class ReservasService {
  constructor(private readonly repository: ReservasRepository) {}

  async list(input: ReservasListInput) {
    const { data, total } = await this.repository.list(input);

    return {
      data: data.map(toReservaResponse),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize)
      }
    };
  }

  async getById(id: number) {
    const reserva = await this.repository.findById(id);

    if (!reserva) {
      throw reservaNotFoundError();
    }

    return toReservaResponse(reserva);
  }

  async create(input: CreateReservaInput) {
    const dataInicio = normalizeDate(input.dataInicio);
    const dataFim = normalizeDate(input.dataFim);

    if (dataInicio >= dataFim) {
      throw invalidPeriodError();
    }

    const [flat, responsavel] = await Promise.all([
      this.repository.findFlatById(input.flatId),
      this.repository.findHospedeResponsavelById(input.hospedeResponsavelId)
    ]);

    if (!flat || !flat.ativo) {
      throw flatNotAvailableError();
    }

    if (OPERATIONAL_BLOCKING_STATUSES.includes(flat.statusOperacional)) {
      throw flatNotAvailableError();
    }

    if (!responsavel || !responsavel.ativo) {
      throw responsavelNotFoundError();
    }

    const acompanhanteIds = uniqueIds(input.acompanhanteIds ?? []);
    const acompanhantes = await this.repository.findAcompanhantesByIds(responsavel.id, acompanhanteIds);

    if (acompanhantes.length !== acompanhanteIds.length) {
      throw invalidAcompanhantesError();
    }

    const quantidadeHospedes = 1 + acompanhantes.length;

    if (quantidadeHospedes > flat.subcategoria.capacidadeMaxima) {
      throw capacityExceededError();
    }

    if (await this.repository.hasConflictingReservation(flat.id, dataInicio, dataFim)) {
      throw conflictError();
    }

    const cafeContratado = input.cafeContratado;
    const valorCafePorPessoa = cafeContratado ? normalizeMoney(input.valorCafePorPessoa ?? 0) : 0;
    const valorBaseContratado = normalizeMoney(flat.subcategoria.precoBase);
    const valorCafeContratado = normalizeMoney(valorCafePorPessoa * quantidadeHospedes);
    const valorTotalContratado = normalizeMoney(valorBaseContratado + valorCafeContratado);

    return toReservaResponse(
      await this.repository.create({
        flatId: flat.id,
        subcategoriaId: flat.subcategoriaId,
        hospedeResponsavelId: responsavel.id,
        acompanhanteIds,
        dataInicio,
        dataFim,
        quantidadeHospedes,
        cafeContratado,
        valorBaseContratado,
        valorCafePorPessoa,
        valorCafeContratado,
        valorTotalContratado,
        observacoes: normalizeOptionalText(input.observacoes)
      })
    );
  }

  async listAvailability(input: DisponibilidadeInput) {
    const dataInicio = normalizeDate(input.dataInicio);
    const dataFim = normalizeDate(input.dataFim);

    if (dataInicio >= dataFim) {
      throw invalidPeriodError();
    }

    const { data, total } = await this.repository.listAvailability({
      ...input,
      dataInicio,
      dataFim
    });

    return {
      data: data.map((flat) => ({
        id: flat.id,
        numero: flat.numero,
        subcategoriaId: flat.subcategoriaId,
        subcategoria: flat.subcategoria,
        statusOperacional: flat.statusOperacional,
        statusDisponibilidade: flat.bloqueadoPorReserva ? "Reservado" : flat.statusOperacional,
        disponivel:
          flat.ativo &&
          !flat.bloqueadoPorReserva &&
          !OPERATIONAL_BLOCKING_STATUSES.includes(flat.statusOperacional)
      })),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize)
      }
    };
  }

  async hasFutureReservationForFlat(flatId: number, now = new Date()) {
    return this.repository.hasFutureReservationForFlat(flatId, now);
  }
}

export function toReservaResponse(reserva: ReservaRecord) {
  return {
    id: reserva.id,
    flatId: reserva.flatId,
    flat: {
      id: reserva.flat.id,
      numero: reserva.flat.numero,
      statusOperacional: reserva.flat.statusOperacional
    },
    subcategoriaId: reserva.subcategoriaId,
    subcategoria: {
      id: reserva.subcategoria.id,
      nome: reserva.subcategoria.nome,
      precoBase: reserva.subcategoria.precoBase,
      capacidadeMaxima: reserva.subcategoria.capacidadeMaxima
    },
    hospedeResponsavelId: reserva.hospedeResponsavelId,
    hospedeResponsavel: {
      id: reserva.hospedeResponsavel.id,
      nomeCompleto: reserva.hospedeResponsavel.nomeCompleto,
      cpf: reserva.hospedeResponsavel.cpf
    },
    acompanhantes: reserva.acompanhantes.map((acompanhante) => ({
      id: acompanhante.id,
      nomeCompleto: acompanhante.nomeCompleto,
      documento: acompanhante.documento,
      menorDeIdade: acompanhante.menorDeIdade
    })),
    dataInicio: reserva.dataInicio,
    dataFim: reserva.dataFim,
    status: reserva.status,
    quantidadeHospedes: reserva.quantidadeHospedes,
    cafeContratado: reserva.cafeContratado,
    valorBaseContratado: reserva.valorBaseContratado,
    valorCafePorPessoa: reserva.valorCafePorPessoa,
    valorCafeContratado: reserva.valorCafeContratado,
    valorTotalContratado: reserva.valorTotalContratado,
    observacoes: reserva.observacoes,
    criadoEm: reserva.criadoEm,
    atualizadoEm: reserva.atualizadoEm
  };
}

function normalizeDate(value: Date): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw invalidPeriodError();
  }

  return date;
}

function normalizeMoney(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw invalidMoneyError();
  }

  return Math.round(value * 100) / 100;
}

function uniqueIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

function normalizeOptionalText(value?: string): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function reservaNotFoundError(): AppError {
  return new AppError({
    code: "RESERVA_001",
    message: "Reserva nao encontrada.",
    statusCode: 404
  });
}

function invalidPeriodError(): AppError {
  return new AppError({
    code: "RESERVA_002",
    message: "Periodo da reserva invalido.",
    statusCode: 400
  });
}

function flatNotAvailableError(): AppError {
  return new AppError({
    code: "RESERVA_003",
    message: "Flat indisponivel para reserva.",
    statusCode: 400
  });
}

function responsavelNotFoundError(): AppError {
  return new AppError({
    code: "RESERVA_004",
    message: "Hospede responsavel nao encontrado ou inativo.",
    statusCode: 404
  });
}

function invalidAcompanhantesError(): AppError {
  return new AppError({
    code: "RESERVA_005",
    message: "Acompanhantes invalidos para o hospede responsavel informado.",
    statusCode: 400
  });
}

function conflictError(): AppError {
  return new AppError({
    code: "RESERVA_006",
    message: "Ja existe reserva confirmada para este flat no periodo informado.",
    statusCode: 409
  });
}

function capacityExceededError(): AppError {
  return new AppError({
    code: "RESERVA_007",
    message: "Quantidade de hospedes excede a capacidade maxima da subcategoria.",
    statusCode: 400
  });
}

function invalidMoneyError(): AppError {
  return new AppError({
    code: "RESERVA_008",
    message: "Valor de cafe invalido.",
    statusCode: 400
  });
}
