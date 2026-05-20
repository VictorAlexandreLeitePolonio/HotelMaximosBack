import { AppError } from "../../shared/errors/app-error.js";
import type { FlatStatus } from "../flats/flats.service.js";
import {
  toReservaResponse,
  type ReservaAcompanhanteRecord,
  type ReservaFlatRecord,
  type ReservaHospedeResponsavelRecord,
  type ReservaRecord,
  type ReservaSubcategoriaRecord
} from "../reservas/reservas.service.js";

export type StatusEstadia = "Ativa" | "Encerrada";
export type StatusCobranca = "Pendente" | "Paga" | "Cancelada";
export type FormaPagamento =
  | "Pix"
  | "Dinheiro"
  | "CartaoCredito"
  | "CartaoDebito"
  | "Transferencia";
export type CaixaStatus = "Aberto" | "Fechado";
export type TipoHistoricoFlat =
  | "CheckIn"
  | "TransferenciaSaida"
  | "TransferenciaEntrada"
  | "Renovacao";
export type GrupoCheckIn = "Hoje" | "Atrasado";

export type CaixaRecord = {
  id: number;
  usuarioId: number;
  status: CaixaStatus;
  abertoEm: Date;
  fechadoEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type CobrancaRecord = {
  id: number;
  estadiaId: number;
  competenciaInicio: Date;
  competenciaFim: Date;
  valor: number;
  status: StatusCobranca;
  geradaEm: Date;
  liquidadaEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type PagamentoRecord = {
  id: number;
  cobrancaId: number;
  usuarioId: number;
  caixaId: number;
  formaPagamento: FormaPagamento;
  valor: number;
  comprovante: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type HistoricoFlatRecord = {
  id: number;
  flatId: number;
  estadiaId: number | null;
  usuarioId: number | null;
  tipo: TipoHistoricoFlat;
  descricao: string;
  metadata: Record<string, unknown> | null;
  criadoEm: Date;
};

export type EstadiaRecord = {
  id: number;
  reservaId: number | null;
  flatId: number;
  flat: ReservaFlatRecord;
  subcategoriaId: number;
  subcategoria: ReservaSubcategoriaRecord;
  hospedeResponsavelId: number;
  hospedeResponsavel: ReservaHospedeResponsavelRecord;
  acompanhantes: ReservaAcompanhanteRecord[];
  dataInicio: Date;
  dataFimPrevista: Date;
  dataFimEfetiva: Date | null;
  status: StatusEstadia;
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

export type CheckInDoDiaRecord = {
  grupoCheckIn: GrupoCheckIn;
  reserva: ReservaRecord;
};

export type CheckInResultRecord = {
  reserva: ReservaRecord;
  estadia: EstadiaRecord;
  cobranca: CobrancaRecord;
  pagamento: PagamentoRecord;
};

export type CheckInFromReservationInput = {
  dataInicioEfetiva?: Date;
  dataFimPrevista?: Date;
  formaPagamento: FormaPagamento;
  valorPago: number;
  comprovante?: string;
  observacoes?: string;
};

export type DirectCheckInInput = {
  flatId: number;
  hospedeResponsavelId: number;
  acompanhanteIds?: number[];
  dataInicio?: Date;
  dataFimPrevista?: Date;
  cafeContratado: boolean;
  valorCafePorPessoa?: number;
  formaPagamento: FormaPagamento;
  valorPago: number;
  comprovante?: string;
  observacoes?: string;
};

export type CheckInDoDiaListInput = {
  page: number;
  pageSize: number;
  grupo?: GrupoCheckIn;
  referenceDate?: Date;
};

export type ActiveStaysListInput = {
  page: number;
  pageSize: number;
  search?: string;
  flatId?: number;
  hospedeResponsavelId?: number;
  sortField?: "dataInicio" | "dataFimPrevista" | "criadoEm" | "atualizadoEm";
  sortOrder?: "asc" | "desc";
};

export type TransferFlatInput = {
  novoFlatId: number;
  observacoes?: string;
};

export type RenewStayInput = {
  dataFimPrevista: Date;
  observacoes?: string;
};

export type CreateCheckInFromReservationPayload = {
  reservaId: number;
  flatId: number;
  subcategoriaId: number;
  hospedeResponsavelId: number;
  acompanhanteIds: number[];
  dataInicio: Date;
  dataFimPrevista: Date;
  quantidadeHospedes: number;
  cafeContratado: boolean;
  valorBaseContratado: number;
  valorCafePorPessoa: number;
  valorCafeContratado: number;
  valorTotalContratado: number;
  observacoes: string | null;
  caixaId: number;
  usuarioId: number;
  formaPagamento: FormaPagamento;
  comprovante: string | null;
  competenciaFim: Date;
};

export type CreateDirectCheckInPayload = {
  flatId: number;
  subcategoriaId: number;
  hospedeResponsavelId: number;
  acompanhanteIds: number[];
  dataInicio: Date;
  dataFimPrevista: Date;
  quantidadeHospedes: number;
  cafeContratado: boolean;
  valorBaseContratado: number;
  valorCafePorPessoa: number;
  valorCafeContratado: number;
  valorTotalContratado: number;
  observacoes: string | null;
  caixaId: number;
  usuarioId: number;
  formaPagamento: FormaPagamento;
  comprovante: string | null;
  competenciaFim: Date;
};

export type TransferFlatPayload = {
  estadiaId: number;
  flatAnteriorId: number;
  novoFlatId: number;
  usuarioId: number;
  observacoes: string | null;
};

export type RenewStayPayload = {
  estadiaId: number;
  usuarioId: number;
  dataFimAnterior: Date;
  novaDataFimPrevista: Date;
  observacoes: string | null;
};

export type EstadiasRepository = {
  listCheckInDoDia(input: {
    page: number;
    pageSize: number;
    grupo?: GrupoCheckIn;
    inicioDoDia: Date;
    fimDoDia: Date;
  }): Promise<{ data: CheckInDoDiaRecord[]; total: number }>;
  listActive(input: ActiveStaysListInput): Promise<{ data: EstadiaRecord[]; total: number }>;
  findReservaById(id: number): Promise<ReservaRecord | null>;
  findEstadiaById(id: number): Promise<EstadiaRecord | null>;
  findEstadiaByReservaId(reservaId: number): Promise<EstadiaRecord | null>;
  findFlatById(id: number): Promise<ReservaFlatRecord | null>;
  findHospedeResponsavelById(id: number): Promise<ReservaHospedeResponsavelRecord | null>;
  findAcompanhantesByIds(
    responsavelId: number,
    ids: number[]
  ): Promise<ReservaAcompanhanteRecord[]>;
  findOpenCaixaByUsuarioId(usuarioId: number): Promise<CaixaRecord | null>;
  hasActiveStayForFlat(flatId: number, ignoreEstadiaId?: number): Promise<boolean>;
  hasConflictingReservation(
    flatId: number,
    dataInicio: Date,
    dataFim: Date,
    ignoreReservaId?: number
  ): Promise<boolean>;
  createCheckInFromReservation(data: CreateCheckInFromReservationPayload): Promise<CheckInResultRecord>;
  createDirectCheckIn(data: CreateDirectCheckInPayload): Promise<CheckInResultRecord>;
  transferFlat(data: TransferFlatPayload): Promise<EstadiaRecord>;
  renewStay(data: RenewStayPayload): Promise<EstadiaRecord>;
};

const OCCUPANCY_BLOCKING_STATUSES: FlatStatus[] = ["Ocupado", "AguardandoLimpeza", "Manutencao"];

export class EstadiasService {
  constructor(private readonly repository: EstadiasRepository) {}

  async listCheckInDoDia(input: CheckInDoDiaListInput) {
    const referenceDate = normalizeDate(input.referenceDate ?? new Date(), invalidStayPeriodError);
    const inicioDoDia = startOfDay(referenceDate);
    const fimDoDia = endOfDay(referenceDate);
    const { data, total } = await this.repository.listCheckInDoDia({
      page: input.page,
      pageSize: input.pageSize,
      grupo: input.grupo,
      inicioDoDia,
      fimDoDia
    });

    return {
      data: data.map(toCheckInDoDiaResponse),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize)
      }
    };
  }

  async listActive(input: ActiveStaysListInput) {
    const { data, total } = await this.repository.listActive(input);

    return {
      data: data.map(toEstadiaResponse),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize)
      }
    };
  }

  async checkInFromReservation(
    reservaId: number,
    usuarioId: number,
    input: CheckInFromReservationInput
  ) {
    const reserva = await this.repository.findReservaById(reservaId);

    if (!reserva) {
      throw reservationNotFoundError();
    }

    if (reserva.status !== "Confirmada") {
      throw invalidReservationForCheckInError();
    }

    if (await this.repository.findEstadiaByReservaId(reserva.id)) {
      throw reservationAlreadyCheckedInError();
    }

    validateFlatAvailability(reserva.flat);

    if (await this.repository.hasActiveStayForFlat(reserva.flatId)) {
      throw flatUnavailableError();
    }

    const dataInicio = normalizeDate(input.dataInicioEfetiva ?? new Date(), invalidStayPeriodError);
    const dataFimPrevista = normalizeStayEndDate(input.dataFimPrevista, dataInicio);

    if (
      await this.repository.hasConflictingReservation(
        reserva.flatId,
        dataInicio,
        dataFimPrevista,
        reserva.id
      )
    ) {
      throw reservationConflictError();
    }

    const caixa = await this.repository.findOpenCaixaByUsuarioId(usuarioId);

    if (!caixa) {
      throw openCashRegisterRequiredError();
    }

    const valorPago = normalizeMoney(input.valorPago, invalidPaymentError);
    const valorEsperado = normalizeMoney(reserva.valorTotalContratado, invalidPaymentError);
    ensureIntegralPayment(valorPago, valorEsperado);
    const comprovante = normalizePaymentProof(input.formaPagamento, input.comprovante);

    return toCheckInResultResponse(
      await this.repository.createCheckInFromReservation({
        reservaId: reserva.id,
        flatId: reserva.flatId,
        subcategoriaId: reserva.subcategoriaId,
        hospedeResponsavelId: reserva.hospedeResponsavelId,
        acompanhanteIds: reserva.acompanhantes.map((item) => item.id),
        dataInicio,
        dataFimPrevista,
        quantidadeHospedes: reserva.quantidadeHospedes,
        cafeContratado: reserva.cafeContratado,
        valorBaseContratado: reserva.valorBaseContratado,
        valorCafePorPessoa: reserva.valorCafePorPessoa,
        valorCafeContratado: reserva.valorCafeContratado,
        valorTotalContratado: valorEsperado,
        observacoes: normalizeOptionalText(input.observacoes) ?? reserva.observacoes,
        caixaId: caixa.id,
        usuarioId,
        formaPagamento: input.formaPagamento,
        comprovante,
        competenciaFim: addDays(dataInicio, 30)
      })
    );
  }

  async directCheckIn(usuarioId: number, input: DirectCheckInInput) {
    const dataInicio = normalizeDate(input.dataInicio ?? new Date(), invalidStayPeriodError);
    const dataFimPrevista = normalizeStayEndDate(input.dataFimPrevista, dataInicio);
    const [flat, responsavel, caixa] = await Promise.all([
      this.repository.findFlatById(input.flatId),
      this.repository.findHospedeResponsavelById(input.hospedeResponsavelId),
      this.repository.findOpenCaixaByUsuarioId(usuarioId)
    ]);

    if (!flat) {
      throw flatUnavailableError();
    }

    validateFlatAvailability(flat);

    if (await this.repository.hasActiveStayForFlat(flat.id)) {
      throw flatUnavailableError();
    }

    if (!responsavel || !responsavel.ativo) {
      throw responsavelNotFoundError();
    }

    if (!caixa) {
      throw openCashRegisterRequiredError();
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

    if (await this.repository.hasConflictingReservation(flat.id, dataInicio, dataFimPrevista)) {
      throw reservationConflictError();
    }

    const cafeContratado = input.cafeContratado;
    const valorCafePorPessoa = cafeContratado
      ? normalizeMoney(input.valorCafePorPessoa ?? 0, invalidCafeValueError)
      : 0;
    const valorBaseContratado = normalizeMoney(flat.subcategoria.precoBase, invalidPaymentError);
    const valorCafeContratado = normalizeMoney(
      valorCafePorPessoa * quantidadeHospedes,
      invalidCafeValueError
    );
    const valorTotalContratado = normalizeMoney(
      valorBaseContratado + valorCafeContratado,
      invalidPaymentError
    );
    const valorPago = normalizeMoney(input.valorPago, invalidPaymentError);

    ensureIntegralPayment(valorPago, valorTotalContratado);

    return toCheckInResultResponse(
      await this.repository.createDirectCheckIn({
        flatId: flat.id,
        subcategoriaId: flat.subcategoriaId,
        hospedeResponsavelId: responsavel.id,
        acompanhanteIds,
        dataInicio,
        dataFimPrevista,
        quantidadeHospedes,
        cafeContratado,
        valorBaseContratado,
        valorCafePorPessoa,
        valorCafeContratado,
        valorTotalContratado,
        observacoes: normalizeOptionalText(input.observacoes),
        caixaId: caixa.id,
        usuarioId,
        formaPagamento: input.formaPagamento,
        comprovante: normalizePaymentProof(input.formaPagamento, input.comprovante),
        competenciaFim: addDays(dataInicio, 30)
      })
    );
  }

  async transferFlat(estadiaId: number, usuarioId: number, input: TransferFlatInput) {
    const estadia = await this.repository.findEstadiaById(estadiaId);

    if (!estadia || estadia.status !== "Ativa") {
      throw stayNotFoundError();
    }

    if (estadia.flatId === input.novoFlatId) {
      throw sameFlatTransferError();
    }

    const flat = await this.repository.findFlatById(input.novoFlatId);

    if (!flat) {
      throw flatUnavailableError();
    }

    validateFlatAvailability(flat);

    if (await this.repository.hasActiveStayForFlat(flat.id)) {
      throw flatUnavailableError();
    }

    if (await this.repository.hasConflictingReservation(flat.id, new Date(), estadia.dataFimPrevista)) {
      throw reservationConflictError();
    }

    return toEstadiaResponse(
      await this.repository.transferFlat({
        estadiaId: estadia.id,
        flatAnteriorId: estadia.flatId,
        novoFlatId: flat.id,
        usuarioId,
        observacoes: normalizeOptionalText(input.observacoes)
      })
    );
  }

  async renewStay(estadiaId: number, usuarioId: number, input: RenewStayInput) {
    const estadia = await this.repository.findEstadiaById(estadiaId);

    if (!estadia || estadia.status !== "Ativa") {
      throw stayNotFoundError();
    }

    const novaDataFimPrevista = normalizeDate(input.dataFimPrevista, invalidStayPeriodError);

    if (novaDataFimPrevista <= estadia.dataFimPrevista) {
      throw invalidRenewalDateError();
    }

    if (
      await this.repository.hasConflictingReservation(
        estadia.flatId,
        estadia.dataFimPrevista,
        novaDataFimPrevista,
        estadia.reservaId ?? undefined
      )
    ) {
      throw reservationConflictError();
    }

    return toEstadiaResponse(
      await this.repository.renewStay({
        estadiaId: estadia.id,
        usuarioId,
        dataFimAnterior: estadia.dataFimPrevista,
        novaDataFimPrevista,
        observacoes: normalizeOptionalText(input.observacoes)
      })
    );
  }
}

export function toCheckInDoDiaResponse(item: CheckInDoDiaRecord) {
  return {
    ...toReservaResponse(item.reserva),
    grupoCheckIn: item.grupoCheckIn
  };
}

export function toEstadiaResponse(estadia: EstadiaRecord) {
  return {
    id: estadia.id,
    reservaId: estadia.reservaId,
    flatId: estadia.flatId,
    flat: {
      id: estadia.flat.id,
      numero: estadia.flat.numero,
      statusOperacional: estadia.flat.statusOperacional
    },
    subcategoriaId: estadia.subcategoriaId,
    subcategoria: {
      id: estadia.subcategoria.id,
      nome: estadia.subcategoria.nome,
      precoBase: estadia.subcategoria.precoBase,
      capacidadeMaxima: estadia.subcategoria.capacidadeMaxima
    },
    hospedeResponsavelId: estadia.hospedeResponsavelId,
    hospedeResponsavel: {
      id: estadia.hospedeResponsavel.id,
      nomeCompleto: estadia.hospedeResponsavel.nomeCompleto,
      cpf: estadia.hospedeResponsavel.cpf
    },
    acompanhantes: estadia.acompanhantes.map((acompanhante) => ({
      id: acompanhante.id,
      nomeCompleto: acompanhante.nomeCompleto,
      documento: acompanhante.documento,
      menorDeIdade: acompanhante.menorDeIdade
    })),
    dataInicio: estadia.dataInicio,
    dataFimPrevista: estadia.dataFimPrevista,
    dataFimEfetiva: estadia.dataFimEfetiva,
    status: estadia.status,
    quantidadeHospedes: estadia.quantidadeHospedes,
    cafeContratado: estadia.cafeContratado,
    valorBaseContratado: estadia.valorBaseContratado,
    valorCafePorPessoa: estadia.valorCafePorPessoa,
    valorCafeContratado: estadia.valorCafeContratado,
    valorTotalContratado: estadia.valorTotalContratado,
    observacoes: estadia.observacoes,
    criadoEm: estadia.criadoEm,
    atualizadoEm: estadia.atualizadoEm
  };
}

export function toCobrancaResponse(cobranca: CobrancaRecord) {
  return {
    id: cobranca.id,
    estadiaId: cobranca.estadiaId,
    competenciaInicio: cobranca.competenciaInicio,
    competenciaFim: cobranca.competenciaFim,
    valor: cobranca.valor,
    status: cobranca.status,
    geradaEm: cobranca.geradaEm,
    liquidadaEm: cobranca.liquidadaEm,
    criadoEm: cobranca.criadoEm,
    atualizadoEm: cobranca.atualizadoEm
  };
}

export function toPagamentoResponse(pagamento: PagamentoRecord) {
  return {
    id: pagamento.id,
    cobrancaId: pagamento.cobrancaId,
    usuarioId: pagamento.usuarioId,
    caixaId: pagamento.caixaId,
    formaPagamento: pagamento.formaPagamento,
    valor: pagamento.valor,
    comprovante: pagamento.comprovante,
    criadoEm: pagamento.criadoEm,
    atualizadoEm: pagamento.atualizadoEm
  };
}

export function toCheckInResultResponse(result: CheckInResultRecord) {
  return {
    reserva: toReservaResponse(result.reserva),
    estadia: toEstadiaResponse(result.estadia),
    cobranca: toCobrancaResponse(result.cobranca),
    pagamento: toPagamentoResponse(result.pagamento)
  };
}

function validateFlatAvailability(flat: ReservaFlatRecord) {
  if (!flat.ativo || OCCUPANCY_BLOCKING_STATUSES.includes(flat.statusOperacional)) {
    throw flatUnavailableError();
  }
}

function normalizeDate(value: Date, onError: () => AppError): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw onError();
  }

  return date;
}

function normalizeStayEndDate(value: Date | undefined, startDate: Date): Date {
  const endDate = normalizeDate(value ?? addDays(startDate, 30), invalidStayPeriodError);

  if (endDate <= startDate) {
    throw invalidStayPeriodError();
  }

  return endDate;
}

function normalizeMoney(value: number, onError: () => AppError): number {
  if (!Number.isFinite(value) || value < 0) {
    throw onError();
  }

  return Math.round(value * 100) / 100;
}

function ensureIntegralPayment(valorPago: number, valorEsperado: number) {
  if (valorPago !== valorEsperado) {
    throw fullPaymentRequiredError();
  }
}

function normalizePaymentProof(
  formaPagamento: FormaPagamento,
  comprovante?: string
): string | null {
  const normalized = normalizeOptionalText(comprovante);

  if (formaPagamento !== "Dinheiro" && !normalized) {
    throw paymentProofRequiredError();
  }

  return normalized;
}

function normalizeOptionalText(value?: string): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function uniqueIds(ids: number[]): number[] {
  return [...new Set(ids)];
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function stayNotFoundError(): AppError {
  return new AppError({
    code: "ESTADIA_001",
    message: "Estadia nao encontrada.",
    statusCode: 404
  });
}

function reservationNotFoundError(): AppError {
  return new AppError({
    code: "ESTADIA_002",
    message: "Reserva nao encontrada.",
    statusCode: 404
  });
}

function invalidReservationForCheckInError(): AppError {
  return new AppError({
    code: "ESTADIA_003",
    message: "A reserva informada nao pode ser usada para check-in.",
    statusCode: 400
  });
}

function flatUnavailableError(): AppError {
  return new AppError({
    code: "ESTADIA_004",
    message: "Flat indisponivel para a operacao solicitada.",
    statusCode: 400
  });
}

function responsavelNotFoundError(): AppError {
  return new AppError({
    code: "ESTADIA_005",
    message: "Hospede responsavel nao encontrado ou inativo.",
    statusCode: 404
  });
}

function invalidAcompanhantesError(): AppError {
  return new AppError({
    code: "ESTADIA_006",
    message: "Acompanhantes invalidos para o hospede responsavel informado.",
    statusCode: 400
  });
}

function reservationConflictError(): AppError {
  return new AppError({
    code: "ESTADIA_007",
    message: "Ja existe reserva confirmada para o flat no periodo informado.",
    statusCode: 409
  });
}

function capacityExceededError(): AppError {
  return new AppError({
    code: "ESTADIA_008",
    message: "Quantidade de hospedes excede a capacidade maxima da subcategoria.",
    statusCode: 400
  });
}

function openCashRegisterRequiredError(): AppError {
  return new AppError({
    code: "ESTADIA_009",
    message: "E necessario ter um caixa aberto para registrar o pagamento inicial.",
    statusCode: 400
  });
}

function fullPaymentRequiredError(): AppError {
  return new AppError({
    code: "ESTADIA_010",
    message: "O check-in exige pagamento integral da primeira mensalidade.",
    statusCode: 400
  });
}

function paymentProofRequiredError(): AppError {
  return new AppError({
    code: "ESTADIA_011",
    message: "Comprovante obrigatorio para a forma de pagamento informada.",
    statusCode: 400
  });
}

function sameFlatTransferError(): AppError {
  return new AppError({
    code: "ESTADIA_012",
    message: "A troca de flat deve apontar para um flat diferente do atual.",
    statusCode: 400
  });
}

function invalidStayPeriodError(): AppError {
  return new AppError({
    code: "ESTADIA_013",
    message: "Periodo da estadia invalido.",
    statusCode: 400
  });
}

function invalidRenewalDateError(): AppError {
  return new AppError({
    code: "ESTADIA_014",
    message: "A nova data fim prevista deve ser maior que a data atual da estadia.",
    statusCode: 400
  });
}

function reservationAlreadyCheckedInError(): AppError {
  return new AppError({
    code: "ESTADIA_015",
    message: "A reserva informada ja possui uma estadia vinculada.",
    statusCode: 409
  });
}

function invalidPaymentError(): AppError {
  return new AppError({
    code: "ESTADIA_016",
    message: "Valor de pagamento invalido.",
    statusCode: 400
  });
}

function invalidCafeValueError(): AppError {
  return new AppError({
    code: "ESTADIA_017",
    message: "Valor de cafe invalido.",
    statusCode: 400
  });
}
