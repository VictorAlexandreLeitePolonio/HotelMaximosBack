import { AppError } from "../../shared/errors/app-error.js";
import type { AuthUserRecord } from "../auth/auth.service.js";

export const DASHBOARD_TIMEZONE = "America/Sao_Paulo";
export const STAY_EXPIRY_WARNING_DAYS = 3;

export type FlatStatus =
  | "Livre"
  | "Reservado"
  | "Ocupado"
  | "AguardandoLimpeza"
  | "Manutencao";
export type UserProfile = "Admin" | "Recepcionista";
export type CleaningStatus = "Pendente" | "Concluida" | "Atrasada" | "Suspensa";
export type CleaningType = "Semanal" | "Checkout";
export type PaymentMethod =
  | "Pix"
  | "Dinheiro"
  | "CartaoCredito"
  | "CartaoDebito"
  | "Transferencia";
export type FlatHistoryType =
  | "CheckIn"
  | "CheckOut"
  | "TransferenciaSaida"
  | "TransferenciaEntrada"
  | "Renovacao"
  | "ManutencaoIniciada"
  | "ManutencaoFinalizada"
  | "NoShowManual"
  | "ObservacaoOperacional"
  | "ObservacaoOperacionalCorrigida"
  | "ObservacaoOperacionalCancelada";
export type DashboardAlertType =
  | "CheckInAtrasado"
  | "EstadiaVencendo"
  | "EstadiaVencida"
  | "LimpezaPendente"
  | "LimpezaAtrasada"
  | "LimpezaSuspensa";
export type DashboardAlertSeverity = "warning" | "critical";

export type DashboardUserRecord = {
  id: number;
  login: string;
  nomeCompleto: string;
  perfil: UserProfile;
};

export type DashboardReservationWarningRecord = {
  reservaId: number;
  flatId: number;
  flatNumero: string;
  hospedeResponsavelNome: string;
  dataInicio: Date;
};

export type DashboardStayWarningRecord = {
  estadiaId: number;
  flatId: number;
  flatNumero: string;
  hospedeResponsavelNome: string;
  dataFimPrevista: Date;
};

export type DashboardCleaningWarningRecord = {
  limpezaId: number;
  flatId: number;
  flatNumero: string;
  tipo: CleaningType;
  status: CleaningStatus;
  dataProgramada: Date;
  atrasaEm: Date;
};

export type DashboardPaymentSummaryRecord = {
  formaPagamento: PaymentMethod;
  quantidade: number;
  valor: number;
};

export type FlatHistoryRecord = {
  id: number;
  flatId: number;
  estadiaId: number | null;
  usuario: DashboardUserRecord | null;
  tipo: FlatHistoryType;
  descricao: string;
  metadata: Record<string, unknown> | null;
  criadoEm: Date;
};

export type DashboardOperationalSnapshot = {
  flatsPorStatus: Partial<Record<FlatStatus, number>>;
  estadiasAtivas: number;
  checkInsHoje: number;
  reservasRequerRealocacao: number;
  limpezasAbertas: number;
  checkInsAtrasados: DashboardReservationWarningRecord[];
  estadiasVencendo: DashboardStayWarningRecord[];
  limpezasComAviso: DashboardCleaningWarningRecord[];
};

export type DashboardFinancialSnapshot = {
  totalCobrancasPendentes: number;
  valorCobrancasPendentes: number;
  totalExtrasPendentes: number;
  valorExtrasPendentes: number;
  totalPagamentosHoje: number;
  valorPagamentosHoje: number;
  totalCaixasAbertos: number;
  totalCaixasFechadosHoje: number;
  pagamentosHojePorForma: DashboardPaymentSummaryRecord[];
};

export type ReservationNoShowRecord = {
  id: number;
  flatId: number;
  status: "Confirmada" | "RequerRealocacao" | "Cancelada" | "NoShow";
  dataInicio: Date;
  dataFim: Date;
  estadiaId: number | null;
};

export type FlatSummaryRecord = {
  id: number;
  numero: string;
  statusOperacional: FlatStatus;
};

export type DashboardsRepository = {
  loadOperationalSnapshot(input: {
    startOfOperationalDay: Date;
    endOfOperationalDay: Date;
    stayExpiryLimit: Date;
  }): Promise<DashboardOperationalSnapshot>;
  loadFinancialSnapshot(input: {
    startOfOperationalDay: Date;
    endOfOperationalDay: Date;
  }): Promise<DashboardFinancialSnapshot>;
  findReservationForNoShow(id: number): Promise<ReservationNoShowRecord | null>;
  markReservationAsNoShow(data: {
    reservaId: number;
    usuario: Pick<AuthUserRecord, "id" | "nomeCompleto" | "perfil">;
    motivo: string;
    observacoes: string | null;
    marcadoEm: Date;
  }): Promise<{ reserva: ReservationNoShowRecord; historico: FlatHistoryRecord }>;
  findFlatById(id: number): Promise<FlatSummaryRecord | null>;
  listFlatHistory(input: {
    flatId: number;
    page: number;
    pageSize: number;
  }): Promise<{ data: FlatHistoryRecord[]; total: number }>;
  createOperationalObservation(data: {
    flatId: number;
    usuario: Pick<AuthUserRecord, "id" | "login" | "nomeCompleto" | "perfil">;
    descricao: string;
    observacoes: string | null;
    criadoEm: Date;
  }): Promise<FlatHistoryRecord>;
  findFlatHistoryEntry(flatId: number, historyId: number): Promise<FlatHistoryRecord | null>;
  createOperationalObservationCorrection(data: {
    flatId: number;
    historyId: number;
    usuario: Pick<AuthUserRecord, "id" | "login" | "nomeCompleto" | "perfil">;
    descricaoCorrigida: string;
    motivo: string;
    observacoes: string | null;
    criadoEm: Date;
    historicoOriginal: FlatHistoryRecord;
  }): Promise<FlatHistoryRecord>;
  createOperationalObservationCancellation(data: {
    flatId: number;
    historyId: number;
    usuario: Pick<AuthUserRecord, "id" | "login" | "nomeCompleto" | "perfil">;
    motivo: string;
    observacoes: string | null;
    criadoEm: Date;
    historicoOriginal: FlatHistoryRecord;
  }): Promise<FlatHistoryRecord>;
};

export type MarkNoShowInput = {
  motivo: string;
  observacoes?: string;
};

export type FlatHistoryListInput = {
  page: number;
  pageSize: number;
};

export type CreateOperationalObservationInput = {
  descricao: string;
  observacoes?: string;
};

export type CorrectOperationalObservationInput = {
  descricaoCorrigida: string;
  motivo: string;
  observacoes?: string;
};

export type CancelOperationalObservationInput = {
  motivo: string;
  observacoes?: string;
};

const FLAT_STATUS_KEYS: FlatStatus[] = [
  "Livre",
  "Reservado",
  "Ocupado",
  "AguardandoLimpeza",
  "Manutencao"
];

export class DashboardsService {
  constructor(private readonly repository: DashboardsRepository) {}

  async getOperationalDashboard(referenceDate: Date = new Date()) {
    const bounds = getOperationalDayBounds(referenceDate);
    const snapshot = await this.repository.loadOperationalSnapshot({
      startOfOperationalDay: bounds.start,
      endOfOperationalDay: bounds.end,
      stayExpiryLimit: bounds.stayExpiryLimit
    });

    const avisos = [
      ...snapshot.checkInsAtrasados.map((item) => ({
        tipo: "CheckInAtrasado" as const,
        severidade: "warning" as const,
        titulo: `Check-in atrasado para a reserva ${item.reservaId}`,
        descricao: `Reserva do flat ${item.flatNumero} aguardando acao manual da recepcao.`,
        referencia: {
          flatId: item.flatId,
          reservaId: item.reservaId,
          estadiaId: null,
          limpezaId: null
        },
        ocorridoEm: item.dataInicio
      })),
      ...snapshot.estadiasVencendo.map((item) => {
        const vencida = item.dataFimPrevista.getTime() < referenceDate.getTime();

        return {
          tipo: vencida ? ("EstadiaVencida" as const) : ("EstadiaVencendo" as const),
          severidade: vencida ? ("critical" as const) : ("warning" as const),
          titulo: vencida
            ? `Estadia vencida no flat ${item.flatNumero}`
            : `Estadia proxima do vencimento no flat ${item.flatNumero}`,
          descricao: vencida
            ? `A estadia de ${item.hospedeResponsavelNome} ja ultrapassou a data fim prevista.`
            : `A estadia de ${item.hospedeResponsavelNome} vence em ate ${STAY_EXPIRY_WARNING_DAYS} dias corridos.`,
          referencia: {
            flatId: item.flatId,
            reservaId: null,
            estadiaId: item.estadiaId,
            limpezaId: null
          },
          ocorridoEm: item.dataFimPrevista
        };
      }),
      ...snapshot.limpezasComAviso.map((item) => ({
        tipo: mapCleaningAlertType(item.status),
        severidade: item.status === "Atrasada" ? ("critical" as const) : ("warning" as const),
        titulo: buildCleaningAlertTitle(item),
        descricao: buildCleaningAlertDescription(item),
        referencia: {
          flatId: item.flatId,
          reservaId: null,
          estadiaId: null,
          limpezaId: item.limpezaId
        },
        ocorridoEm: item.status === "Atrasada" ? item.atrasaEm : item.dataProgramada
      }))
    ].sort(sortAlerts);

    return {
      generatedAt: referenceDate,
      resumo: {
        flatsPorStatus: FLAT_STATUS_KEYS.reduce<Record<FlatStatus, number>>((acc, key) => {
          acc[key] = snapshot.flatsPorStatus[key] ?? 0;
          return acc;
        }, {} as Record<FlatStatus, number>),
        estadiasAtivas: snapshot.estadiasAtivas,
        checkInsHoje: snapshot.checkInsHoje,
        checkInsAtrasados: snapshot.checkInsAtrasados.length,
        reservasRequerRealocacao: snapshot.reservasRequerRealocacao,
        limpezasAbertas: snapshot.limpezasAbertas
      },
      avisos
    };
  }

  async getFinancialDashboard(referenceDate: Date = new Date()) {
    const bounds = getOperationalDayBounds(referenceDate);
    const snapshot = await this.repository.loadFinancialSnapshot({
      startOfOperationalDay: bounds.start,
      endOfOperationalDay: bounds.end
    });

    return {
      generatedAt: referenceDate,
      resumo: {
        totalCobrancasPendentes: snapshot.totalCobrancasPendentes,
        valorCobrancasPendentes: snapshot.valorCobrancasPendentes,
        totalExtrasPendentes: snapshot.totalExtrasPendentes,
        valorExtrasPendentes: snapshot.valorExtrasPendentes,
        totalPagamentosHoje: snapshot.totalPagamentosHoje,
        valorPagamentosHoje: snapshot.valorPagamentosHoje,
        totalCaixasAbertos: snapshot.totalCaixasAbertos,
        totalCaixasFechadosHoje: snapshot.totalCaixasFechadosHoje
      },
      pagamentosHojePorForma: snapshot.pagamentosHojePorForma
    };
  }

  async markReservationAsNoShow(
    reservaId: number,
    usuario: AuthUserRecord,
    input: MarkNoShowInput,
    now: Date = new Date()
  ) {
    const reserva = await this.repository.findReservationForNoShow(reservaId);

    if (!reserva) {
      throw reservationNotFoundError();
    }

    if (reserva.status !== "Confirmada" || reserva.estadiaId !== null) {
      throw invalidReservationForNoShowError();
    }

    if (reserva.dataInicio.getTime() >= getOperationalDayBounds(now).start.getTime()) {
      throw reservationNotOverdueForNoShowError();
    }

    const result = await this.repository.markReservationAsNoShow({
      reservaId,
      usuario,
      motivo: normalizeRequiredText(input.motivo, invalidReasonError),
      observacoes: normalizeOptionalText(input.observacoes),
      marcadoEm: now
    });

    return {
      reserva: result.reserva,
      historico: toFlatHistoryResponse(result.historico)
    };
  }

  async listFlatHistory(flatId: number, input: FlatHistoryListInput) {
    await this.requireFlat(flatId);

    const { data, total } = await this.repository.listFlatHistory({
      flatId,
      page: input.page,
      pageSize: input.pageSize
    });

    return {
      data: data.map(toFlatHistoryResponse),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize)
      }
    };
  }

  async createOperationalObservation(
    flatId: number,
    usuario: AuthUserRecord,
    input: CreateOperationalObservationInput,
    now: Date = new Date()
  ) {
    await this.requireFlat(flatId);

    return toFlatHistoryResponse(
      await this.repository.createOperationalObservation({
        flatId,
        usuario,
        descricao: normalizeRequiredText(input.descricao, invalidDescriptionError),
        observacoes: normalizeOptionalText(input.observacoes),
        criadoEm: now
      })
    );
  }

  async correctOperationalObservation(
    flatId: number,
    historyId: number,
    usuario: AuthUserRecord,
    input: CorrectOperationalObservationInput,
    now: Date = new Date()
  ) {
    await this.requireFlat(flatId);

    const historicoOriginal = await this.repository.findFlatHistoryEntry(flatId, historyId);

    if (!historicoOriginal) {
      throw flatHistoryNotFoundError();
    }

    assertOperationalObservationTarget(historicoOriginal);

    return toFlatHistoryResponse(
      await this.repository.createOperationalObservationCorrection({
        flatId,
        historyId,
        usuario,
        descricaoCorrigida: normalizeRequiredText(
          input.descricaoCorrigida,
          invalidDescriptionError
        ),
        motivo: normalizeRequiredText(input.motivo, invalidReasonError),
        observacoes: normalizeOptionalText(input.observacoes),
        criadoEm: now,
        historicoOriginal
      })
    );
  }

  async cancelOperationalObservation(
    flatId: number,
    historyId: number,
    usuario: AuthUserRecord,
    input: CancelOperationalObservationInput,
    now: Date = new Date()
  ) {
    await this.requireFlat(flatId);

    const historicoOriginal = await this.repository.findFlatHistoryEntry(flatId, historyId);

    if (!historicoOriginal) {
      throw flatHistoryNotFoundError();
    }

    assertOperationalObservationTarget(historicoOriginal);

    return toFlatHistoryResponse(
      await this.repository.createOperationalObservationCancellation({
        flatId,
        historyId,
        usuario,
        motivo: normalizeRequiredText(input.motivo, invalidReasonError),
        observacoes: normalizeOptionalText(input.observacoes),
        criadoEm: now,
        historicoOriginal
      })
    );
  }

  private async requireFlat(flatId: number) {
    const flat = await this.repository.findFlatById(flatId);

    if (!flat) {
      throw flatNotFoundError();
    }

    return flat;
  }
}

export function toFlatHistoryResponse(record: FlatHistoryRecord) {
  return {
    id: record.id,
    flatId: record.flatId,
    estadiaId: record.estadiaId,
    usuario: record.usuario
      ? {
          id: record.usuario.id,
          login: record.usuario.login,
          nomeCompleto: record.usuario.nomeCompleto,
          perfil: record.usuario.perfil
        }
      : null,
    tipo: record.tipo,
    descricao: record.descricao,
    metadata: record.metadata,
    criadoEm: record.criadoEm
  };
}

function mapCleaningAlertType(status: CleaningStatus): DashboardAlertType {
  switch (status) {
    case "Atrasada":
      return "LimpezaAtrasada";
    case "Suspensa":
      return "LimpezaSuspensa";
    default:
      return "LimpezaPendente";
  }
}

function buildCleaningAlertTitle(item: DashboardCleaningWarningRecord) {
  if (item.status === "Atrasada") {
    return `Limpeza atrasada no flat ${item.flatNumero}`;
  }

  if (item.status === "Suspensa") {
    return `Limpeza suspensa no flat ${item.flatNumero}`;
  }

  return `Limpeza pendente no flat ${item.flatNumero}`;
}

function buildCleaningAlertDescription(item: DashboardCleaningWarningRecord) {
  if (item.status === "Atrasada") {
    return `A limpeza ${item.tipo} do flat ${item.flatNumero} ultrapassou o prazo operacional.`;
  }

  if (item.status === "Suspensa") {
    return `A limpeza ${item.tipo} do flat ${item.flatNumero} segue suspensa e exige acompanhamento.`;
  }

  return `A limpeza ${item.tipo} do flat ${item.flatNumero} segue aberta para conclusao.`;
}

function sortAlerts(
  left: { severidade: DashboardAlertSeverity; ocorridoEm: Date },
  right: { severidade: DashboardAlertSeverity; ocorridoEm: Date }
) {
  const severityWeight = (value: DashboardAlertSeverity) => (value === "critical" ? 0 : 1);
  const severityDiff = severityWeight(left.severidade) - severityWeight(right.severidade);

  if (severityDiff !== 0) {
    return severityDiff;
  }

  return left.ocorridoEm.getTime() - right.ocorridoEm.getTime();
}

function assertOperationalObservationTarget(historico: FlatHistoryRecord) {
  if (historico.tipo !== "ObservacaoOperacional") {
    throw invalidOperationalObservationTargetError();
  }
}

export function getOperationalDayBounds(referenceDate: Date) {
  const localDay = getLocalDateParts(referenceDate, DASHBOARD_TIMEZONE);
  const start = localDateStartToUtc(localDay, DASHBOARD_TIMEZONE);
  const end = new Date(localDateStartToUtc(addLocalDays(localDay, 1), DASHBOARD_TIMEZONE).getTime() - 1);
  const stayExpiryLimit = new Date(
    localDateStartToUtc(addLocalDays(localDay, STAY_EXPIRY_WARNING_DAYS + 1), DASHBOARD_TIMEZONE).getTime() - 1
  );

  return {
    start,
    end,
    stayExpiryLimit
  };
}

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
};

function getLocalDateParts(date: Date, timeZone: string): LocalDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = formatter.formatToParts(date);
  const year = Number(readPart(parts, "year"));
  const month = Number(readPart(parts, "month"));
  const day = Number(readPart(parts, "day"));
  const weekdayLabel = readPart(parts, "weekday");

  return {
    year,
    month,
    day,
    weekday: mapWeekday(weekdayLabel)
  };
}

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPart["type"]) {
  const value = parts.find((part) => part.type === type)?.value;

  if (!value) {
    throw new Error(`Falha ao ler a parte ${type} da data.`);
  }

  return value;
}

function mapWeekday(value: string) {
  switch (value) {
    case "Sun":
      return 0;
    case "Mon":
      return 1;
    case "Tue":
      return 2;
    case "Wed":
      return 3;
    case "Thu":
      return 4;
    case "Fri":
      return 5;
    default:
      return 6;
  }
}

function addLocalDays(date: LocalDateParts, days: number): LocalDateParts {
  const utcDate = new Date(Date.UTC(date.year, date.month - 1, date.day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);

  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
    weekday: utcDate.getUTCDay()
  };
}

function localDateStartToUtc(date: LocalDateParts, timeZone: string) {
  const utcGuess = new Date(Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0));
  const offset = getTimeZoneOffsetMilliseconds(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset);
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const parts = formatter.formatToParts(date);
  const year = Number(readPart(parts, "year"));
  const month = Number(readPart(parts, "month"));
  const day = Number(readPart(parts, "day"));
  const hour = Number(readPart(parts, "hour"));
  const minute = Number(readPart(parts, "minute"));
  const second = Number(readPart(parts, "second"));

  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return asUtc - date.getTime();
}

function normalizeRequiredText(
  value: string,
  errorFactory: (message?: string) => AppError = invalidDescriptionError
) {
  const normalized = value.trim();

  if (!normalized) {
    throw errorFactory();
  }

  return normalized;
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function reservationNotFoundError() {
  return new AppError({
    code: "DASH_001",
    message: "Reserva nao encontrada.",
    statusCode: 404
  });
}

function invalidReservationForNoShowError() {
  return new AppError({
    code: "DASH_002",
    message: "A reserva informada nao pode ser marcada como no-show neste estado.",
    statusCode: 409
  });
}

function reservationNotOverdueForNoShowError() {
  return new AppError({
    code: "DASH_003",
    message: "O no-show manual so pode ser aplicado a check-ins ja atrasados.",
    statusCode: 409
  });
}

function flatNotFoundError() {
  return new AppError({
    code: "DASH_004",
    message: "Flat nao encontrado.",
    statusCode: 404
  });
}

function flatHistoryNotFoundError() {
  return new AppError({
    code: "DASH_005",
    message: "Historico do flat nao encontrado.",
    statusCode: 404
  });
}

function invalidOperationalObservationTargetError() {
  return new AppError({
    code: "DASH_006",
    message: "A correcao ou cancelamento administrativo exige uma observacao operacional original.",
    statusCode: 409
  });
}

function invalidDescriptionError(message = "Informe uma descricao valida.") {
  return new AppError({
    code: "DASH_007",
    message,
    statusCode: 400
  });
}

function invalidReasonError(message = "Informe um motivo valido.") {
  return new AppError({
    code: "DASH_008",
    message,
    statusCode: 400
  });
}
