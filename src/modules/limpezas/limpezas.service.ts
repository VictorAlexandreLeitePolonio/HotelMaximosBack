import { AppError } from "../../shared/errors/app-error.js";

export const HOTEL_TIMEZONE = "America/Sao_Paulo";

export type CleaningType = "Semanal" | "Checkout";
export type CleaningStatus = "Pendente" | "Concluida" | "Atrasada" | "Suspensa";
export type FlatStatus = "Livre" | "Reservado" | "Ocupado" | "AguardandoLimpeza" | "Manutencao";
export type UserProfile = "Admin" | "Recepcionista";

export type CleaningFlatRecord = {
  id: number;
  numero: string;
  statusOperacional: FlatStatus;
};

export type CleaningUserRecord = {
  id: number;
  login: string;
  nomeCompleto: string;
  perfil: UserProfile;
};

export type CleaningRecord = {
  id: number;
  chaveGeracao: string;
  flatId: number;
  flat: CleaningFlatRecord;
  estadiaId: number | null;
  tipo: CleaningType;
  status: CleaningStatus;
  dataProgramada: Date;
  atrasaEm: Date;
  concluidaEm: Date | null;
  usuarioConclusaoId: number | null;
  usuarioConclusao: CleaningUserRecord | null;
  observacoesConclusao: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type WeeklyCleaningStayRecord = {
  estadiaId: number;
  flatId: number;
  flat: CleaningFlatRecord;
  dataInicio: Date;
};

export type CheckoutCleaningCandidateRecord = {
  estadiaId: number;
  flatId: number;
  flat: CleaningFlatRecord;
  dataCheckout: Date;
};

export type CreateCleaningInput = {
  chaveGeracao: string;
  flatId: number;
  estadiaId: number | null;
  tipo: CleaningType;
  status: CleaningStatus;
  dataProgramada: Date;
  atrasaEm: Date;
};

export type CleaningListInput = {
  page: number;
  pageSize: number;
  tipo?: CleaningType;
  status?: CleaningStatus;
  flatId?: number;
  sortOrder?: "asc" | "desc";
};

export type CompleteCleaningInput = {
  observacoes?: string;
};

export type CompleteCleaningPayload = {
  concluidaEm: Date;
  usuarioConclusaoId: number;
  observacoesConclusao: string | null;
  nextFlatStatus: FlatStatus | null;
};

export type LimpezasRepository = {
  listActiveStaysForWeeklyGeneration(): Promise<WeeklyCleaningStayRecord[]>;
  listCheckoutCleaningCandidates(): Promise<CheckoutCleaningCandidateRecord[]>;
  findExistingGenerationKeys(keys: string[]): Promise<string[]>;
  createMany(cleanings: CreateCleaningInput[]): Promise<void>;
  listOpenCleanings(): Promise<CleaningRecord[]>;
  updateStatuses(changes: Array<{ id: number; status: CleaningStatus }>): Promise<void>;
  list(input: CleaningListInput): Promise<{ data: CleaningRecord[]; total: number }>;
  findById(id: number): Promise<CleaningRecord | null>;
  complete(id: number, payload: CompleteCleaningPayload): Promise<CleaningRecord>;
};

export class LimpezasService {
  constructor(private readonly repository: LimpezasRepository) {}

  async list(input: CleaningListInput, now: Date = new Date()) {
    await this.syncOperationalState(now);

    const { data, total } = await this.repository.list(input);

    return {
      data: data.map(toCleaningResponse),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize)
      }
    };
  }

  async complete(
    id: number,
    user: CleaningUserRecord,
    input: CompleteCleaningInput,
    now: Date = new Date()
  ) {
    await this.syncOperationalState(now);

    const cleaning = await this.repository.findById(id);

    if (!cleaning) {
      throw cleaningNotFoundError();
    }

    if (cleaning.status === "Concluida") {
      throw cleaningAlreadyCompletedError();
    }

    if (cleaning.status === "Suspensa") {
      throw suspendedCleaningCompletionError();
    }

    return toCleaningResponse(
      await this.repository.complete(id, {
        concluidaEm: now,
        usuarioConclusaoId: user.id,
        observacoesConclusao: normalizeOptionalText(input.observacoes),
        nextFlatStatus: resolveNextFlatStatus(cleaning)
      })
    );
  }

  private async syncOperationalState(now: Date) {
    const [activeStays, checkoutCandidates] = await Promise.all([
      this.repository.listActiveStaysForWeeklyGeneration(),
      this.repository.listCheckoutCleaningCandidates()
    ]);

    const generated = [
      ...buildWeeklyCleaningInputs(activeStays, now),
      ...buildCheckoutCleaningInputs(checkoutCandidates)
    ];

    if (generated.length > 0) {
      const existingKeys = new Set(
        await this.repository.findExistingGenerationKeys(generated.map((item) => item.chaveGeracao))
      );
      const missing = generated.filter((item) => !existingKeys.has(item.chaveGeracao));

      if (missing.length > 0) {
        await this.repository.createMany(missing);
      }
    }

    const openCleanings = await this.repository.listOpenCleanings();
    const changes = openCleanings
      .map((item) => ({
        id: item.id,
        status: resolveCleaningStatus(item, now)
      }))
      .filter((item, index) => item.status !== openCleanings[index]?.status);

    if (changes.length > 0) {
      await this.repository.updateStatuses(changes);
    }
  }
}

export function buildWeeklyCleaningInputs(
  activeStays: WeeklyCleaningStayRecord[],
  now: Date
): CreateCleaningInput[] {
  const candidateDates = buildWeeklyCandidateDates(now);

  return activeStays.flatMap((stay) =>
    candidateDates
      .filter((candidate) => isStayActiveOnLocalDate(stay, candidate))
      .map((candidate) => ({
        chaveGeracao: buildWeeklyCleaningKey(stay.estadiaId, candidate),
        flatId: stay.flatId,
        estadiaId: stay.estadiaId,
        tipo: "Semanal" as const,
        status: "Pendente" as const,
        dataProgramada: localDateStartToUtc(candidate, HOTEL_TIMEZONE),
        atrasaEm: localDateStartToUtc(resolveWeeklyOverdueDate(candidate), HOTEL_TIMEZONE)
      }))
  );
}

export function buildCheckoutCleaningInputs(
  candidates: CheckoutCleaningCandidateRecord[]
): CreateCleaningInput[] {
  return candidates.map((candidate) => ({
    chaveGeracao: buildCheckoutCleaningKey(candidate.estadiaId),
    flatId: candidate.flatId,
    estadiaId: candidate.estadiaId,
    tipo: "Checkout" as const,
    status: "Pendente" as const,
    dataProgramada: candidate.dataCheckout,
    atrasaEm: addHours(candidate.dataCheckout, 24)
  }));
}

export function resolveCleaningStatus(
  cleaning: Pick<CleaningRecord, "status" | "concluidaEm" | "atrasaEm" | "flat">,
  now: Date
): CleaningStatus {
  if (cleaning.concluidaEm) {
    return "Concluida";
  }

  if (cleaning.flat.statusOperacional === "Manutencao") {
    return "Suspensa";
  }

  if (now.getTime() >= cleaning.atrasaEm.getTime()) {
    return "Atrasada";
  }

  return "Pendente";
}

export function toCleaningResponse(cleaning: CleaningRecord) {
  return {
    id: cleaning.id,
    flatId: cleaning.flatId,
    flat: {
      id: cleaning.flat.id,
      numero: cleaning.flat.numero,
      statusOperacional: cleaning.flat.statusOperacional
    },
    estadiaId: cleaning.estadiaId,
    tipo: cleaning.tipo,
    status: cleaning.status,
    dataProgramada: cleaning.dataProgramada,
    atrasaEm: cleaning.atrasaEm,
    concluidaEm: cleaning.concluidaEm,
    usuarioConclusao: cleaning.usuarioConclusao
      ? {
          id: cleaning.usuarioConclusao.id,
          login: cleaning.usuarioConclusao.login,
          nomeCompleto: cleaning.usuarioConclusao.nomeCompleto,
          perfil: cleaning.usuarioConclusao.perfil
        }
      : null,
    observacoesConclusao: cleaning.observacoesConclusao,
    criadoEm: cleaning.criadoEm,
    atualizadoEm: cleaning.atualizadoEm
  };
}

function resolveNextFlatStatus(cleaning: CleaningRecord): FlatStatus | null {
  if (cleaning.tipo === "Checkout" && cleaning.flat.statusOperacional === "AguardandoLimpeza") {
    return "Livre";
  }

  return null;
}

function buildWeeklyCandidateDates(now: Date): LocalDateParts[] {
  const today = getLocalDateParts(now, HOTEL_TIMEZONE);

  if (today.weekday === 5) {
    return [today];
  }

  if (today.weekday === 6) {
    return [addLocalDays(today, -1), today];
  }

  if (today.weekday === 0) {
    return [addLocalDays(today, -2), addLocalDays(today, -1)];
  }

  return [addLocalDays(today, -(today.weekday + 2)), addLocalDays(today, -(today.weekday + 1))];
}

function isStayActiveOnLocalDate(stay: WeeklyCleaningStayRecord, candidate: LocalDateParts) {
  const stayStart = getLocalDateParts(stay.dataInicio, HOTEL_TIMEZONE);
  return compareLocalDates(stayStart, candidate) <= 0;
}

function buildWeeklyCleaningKey(estadiaId: number, date: LocalDateParts) {
  return `weekly:${estadiaId}:${formatLocalDate(date)}`;
}

function buildCheckoutCleaningKey(estadiaId: number) {
  return `checkout:${estadiaId}`;
}

function formatLocalDate(date: LocalDateParts) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function resolveWeeklyOverdueDate(date: LocalDateParts) {
  if (date.weekday === 5) {
    return addLocalDays(date, 2);
  }

  return addLocalDays(date, 1);
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

function compareLocalDates(left: LocalDateParts, right: LocalDateParts) {
  const leftValue = Date.UTC(left.year, left.month - 1, left.day);
  const rightValue = Date.UTC(right.year, right.month - 1, right.day);
  return leftValue - rightValue;
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

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function cleaningNotFoundError() {
  return new AppError({
    code: "LIMPEZA_001",
    message: "Limpeza nao encontrada.",
    statusCode: 404
  });
}

function cleaningAlreadyCompletedError() {
  return new AppError({
    code: "LIMPEZA_002",
    message: "A limpeza informada ja foi concluida.",
    statusCode: 409
  });
}

function suspendedCleaningCompletionError() {
  return new AppError({
    code: "LIMPEZA_003",
    message: "Nao e possivel concluir manualmente uma limpeza suspensa.",
    statusCode: 409
  });
}
