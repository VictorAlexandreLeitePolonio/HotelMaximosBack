import { AppError } from "../../shared/errors/app-error.js";
import { buildCashRegisterPdf } from "./caixas.pdf.js";

export const cashRegisterPaymentMethods = [
  "Pix",
  "Dinheiro",
  "CartaoCredito",
  "CartaoDebito",
  "Transferencia"
] as const;

export type FormaPagamento = (typeof cashRegisterPaymentMethods)[number];
export type CaixaStatus = "Aberto" | "Fechado";
export type PerfilUsuario = "Admin" | "Recepcionista";

export type CashBreakdownValue = {
  formaPagamento: FormaPagamento;
  valor: number;
};

export type CashRegisterUserRecord = {
  id: number;
  login: string;
  nomeCompleto: string;
  perfil: PerfilUsuario;
};

export type CashRegisterPaymentRecord = {
  id: number;
  cobrancaId: number;
  estadiaId: number;
  estadiaExtraId: number | null;
  origemCobranca: "Mensalidade" | "Extra";
  usuarioId: number;
  caixaId: number;
  formaPagamento: FormaPagamento;
  valor: number;
  comprovante: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type CashRegisterAdjustmentRecord = {
  id: number;
  caixaId: number;
  usuarioId: number;
  usuario: CashRegisterUserRecord;
  motivo: string;
  observacoes: string | null;
  valores: CashBreakdownValue[];
  criadoEm: Date;
};

export type CashRegisterRecord = {
  id: number;
  usuarioId: number;
  usuario: CashRegisterUserRecord;
  turno: string | null;
  status: CaixaStatus;
  abertoEm: Date;
  fechadoEm: Date | null;
  observacoesFechamento: string | null;
  valoresConferidos: CashBreakdownValue[] | null;
  resumoCalculado: CashBreakdownValue[] | null;
  criadoEm: Date;
  atualizadoEm: Date;
  pagamentos: CashRegisterPaymentRecord[];
  ajustes: CashRegisterAdjustmentRecord[];
};

export type OpenCashRegisterInput = {
  turno: string;
};

export type CloseCashRegisterInput = {
  valoresConferidos: CashBreakdownValue[];
  observacoes?: string;
};

export type ClosedCashRegistersListInput = {
  page: number;
  pageSize: number;
  usuarioId?: number;
  search?: string;
  sortOrder?: "asc" | "desc";
};

export type CreateCashRegisterAdjustmentInput = {
  motivo: string;
  observacoes?: string;
  valores: CashBreakdownValue[];
};

export type CashRegistersRepository = {
  findOpenByUsuarioId(usuarioId: number): Promise<CashRegisterRecord | null>;
  create(data: { usuarioId: number; turno: string }): Promise<CashRegisterRecord>;
  findById(id: number): Promise<CashRegisterRecord | null>;
  close(
    id: number,
    data: {
      valoresConferidos: CashBreakdownValue[];
      resumoCalculado: CashBreakdownValue[];
      observacoesFechamento: string | null;
    }
  ): Promise<CashRegisterRecord>;
  listClosed(input: ClosedCashRegistersListInput): Promise<{ data: CashRegisterRecord[]; total: number }>;
  createAdjustment(data: {
    caixaId: number;
    usuarioId: number;
    motivo: string;
    observacoes: string | null;
    valores: CashBreakdownValue[];
  }): Promise<CashRegisterAdjustmentRecord>;
};

export class CaixasService {
  constructor(private readonly repository: CashRegistersRepository) {}

  async openCashRegister(user: CashRegisterUserRecord, input: OpenCashRegisterInput) {
    const current = await this.repository.findOpenByUsuarioId(user.id);

    if (current) {
      throw cashRegisterAlreadyOpenError();
    }

    const caixa = await this.repository.create({
      usuarioId: user.id,
      turno: normalizeRequiredText(input.turno, invalidShiftError)
    });

    return toCashRegisterResponse(caixa);
  }

  async getOwnCashRegister(userId: number) {
    const caixa = await this.repository.findOpenByUsuarioId(userId);

    return {
      caixa: caixa ? toCashRegisterResponse(caixa) : null
    };
  }

  async getCashRegisterById(user: CashRegisterUserRecord, id: number) {
    const caixa = await this.requireCashRegister(id);
    this.assertCanAccessCashRegister(user, caixa);
    return toCashRegisterResponse(caixa);
  }

  async closeCashRegister(user: CashRegisterUserRecord, id: number, input: CloseCashRegisterInput) {
    const caixa = await this.requireCashRegister(id);
    this.assertOwnCashRegisterOperation(user, caixa);

    if (caixa.status === "Fechado") {
      throw cashRegisterAlreadyClosedError();
    }

    const valoresConferidos = normalizeBreakdown(input.valoresConferidos, {
      allowNegative: false,
      requireNonZero: false
    });
    const resumoCalculado = summarizePayments(caixa.pagamentos);

    const closedCashRegister = await this.repository.close(caixa.id, {
      valoresConferidos,
      resumoCalculado,
      observacoesFechamento: normalizeOptionalText(input.observacoes)
    });

    return toCashRegisterResponse(closedCashRegister);
  }

  async listClosedCashRegisters(input: ClosedCashRegistersListInput) {
    const { data, total } = await this.repository.listClosed(input);

    return {
      data: data.map(toCashRegisterListItemResponse),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize)
      }
    };
  }

  async createAdjustment(
    user: CashRegisterUserRecord,
    id: number,
    input: CreateCashRegisterAdjustmentInput
  ) {
    const caixa = await this.requireCashRegister(id);

    if (caixa.status !== "Fechado") {
      throw adjustmentRequiresClosedCashRegisterError();
    }

    const valores = normalizeBreakdown(input.valores, {
      allowNegative: true,
      requireNonZero: true
    });

    await this.repository.createAdjustment({
      caixaId: caixa.id,
      usuarioId: user.id,
      motivo: normalizeRequiredText(input.motivo, invalidAdjustmentReasonError),
      observacoes: normalizeOptionalText(input.observacoes),
      valores
    });

    return toCashRegisterResponse(await this.requireCashRegister(id));
  }

  async generateClosingPdf(user: CashRegisterUserRecord, id: number) {
    const caixa = await this.requireCashRegister(id);
    this.assertCanAccessCashRegister(user, caixa);

    if (caixa.status !== "Fechado") {
      throw pdfRequiresClosedCashRegisterError();
    }

    return {
      fileName: buildCashRegisterPdfFileName(caixa),
      buffer: buildCashRegisterPdf(toCashRegisterResponse(caixa))
    };
  }

  private async requireCashRegister(id: number) {
    const caixa = await this.repository.findById(id);

    if (!caixa) {
      throw cashRegisterNotFoundError();
    }

    return caixa;
  }

  private assertCanAccessCashRegister(user: CashRegisterUserRecord, caixa: CashRegisterRecord) {
    if (user.perfil === "Admin") {
      return;
    }

    if (caixa.usuarioId !== user.id) {
      throw cashRegisterAccessDeniedError();
    }
  }

  private assertOwnCashRegisterOperation(user: CashRegisterUserRecord, caixa: CashRegisterRecord) {
    if (caixa.usuarioId !== user.id) {
      throw cashRegisterAccessDeniedError();
    }
  }
}

export function toCashRegisterResponse(caixa: CashRegisterRecord) {
  return {
    id: caixa.id,
    usuario: toCashRegisterUserResponse(caixa.usuario),
    turno: caixa.turno,
    status: caixa.status,
    abertoEm: caixa.abertoEm,
    fechadoEm: caixa.fechadoEm,
    observacoesFechamento: caixa.observacoesFechamento,
    criadoEm: caixa.criadoEm,
    atualizadoEm: caixa.atualizadoEm,
    pagamentos: caixa.pagamentos.map(toCashRegisterPaymentResponse),
    ajustes: caixa.ajustes.map(toCashRegisterAdjustmentResponse),
    resumoFechamento: buildCashRegisterSummary(caixa)
  };
}

export function toCashRegisterListItemResponse(caixa: CashRegisterRecord) {
  return {
    id: caixa.id,
    usuario: toCashRegisterUserResponse(caixa.usuario),
    turno: caixa.turno,
    status: caixa.status,
    abertoEm: caixa.abertoEm,
    fechadoEm: caixa.fechadoEm,
    criadoEm: caixa.criadoEm,
    atualizadoEm: caixa.atualizadoEm,
    resumoFechamento: buildCashRegisterSummary(caixa)
  };
}

export function toCashRegisterUserResponse(user: CashRegisterUserRecord) {
  return {
    id: user.id,
    login: user.login,
    nomeCompleto: user.nomeCompleto,
    perfil: user.perfil
  };
}

export function toCashRegisterPaymentResponse(payment: CashRegisterPaymentRecord) {
  return {
    id: payment.id,
    cobrancaId: payment.cobrancaId,
    estadiaId: payment.estadiaId,
    estadiaExtraId: payment.estadiaExtraId,
    origemCobranca: payment.origemCobranca,
    usuarioId: payment.usuarioId,
    caixaId: payment.caixaId,
    formaPagamento: payment.formaPagamento,
    valor: payment.valor,
    comprovante: payment.comprovante,
    criadoEm: payment.criadoEm,
    atualizadoEm: payment.atualizadoEm
  };
}

export function toCashRegisterAdjustmentResponse(adjustment: CashRegisterAdjustmentRecord) {
  return {
    id: adjustment.id,
    caixaId: adjustment.caixaId,
    usuario: toCashRegisterUserResponse(adjustment.usuario),
    motivo: adjustment.motivo,
    observacoes: adjustment.observacoes,
    valores: adjustment.valores.map((item) => ({
      formaPagamento: item.formaPagamento,
      valor: item.valor
    })),
    criadoEm: adjustment.criadoEm
  };
}

export function summarizePayments(payments: CashRegisterPaymentRecord[]): CashBreakdownValue[] {
  const totals = createEmptyBreakdownMap();

  for (const payment of payments) {
    totals[payment.formaPagamento] += normalizeMoney(payment.valor, invalidBreakdownValueError);
  }

  return toBreakdownArray(totals);
}

export function buildCashRegisterSummary(caixa: CashRegisterRecord) {
  if (caixa.status !== "Fechado" && !caixa.valoresConferidos && !caixa.resumoCalculado) {
    return null;
  }

  const calculado = breakdownToMap(caixa.resumoCalculado ?? summarizePayments(caixa.pagamentos));
  const conferido = caixa.valoresConferidos ? breakdownToMap(caixa.valoresConferidos) : null;
  const ajustes = summarizeAdjustmentValues(caixa.ajustes);

  const itens = cashRegisterPaymentMethods.map((formaPagamento) => {
    const valorCalculado = normalizeMoney(calculado[formaPagamento], invalidBreakdownValueError);
    const valorConferido = conferido
      ? normalizeMoney(conferido[formaPagamento], invalidBreakdownValueError)
      : null;
    const valorAjuste = normalizeSignedMoney(ajustes[formaPagamento], invalidBreakdownValueError);
    const diferenca =
      valorConferido === null
        ? null
        : normalizeSignedMoney(valorConferido - valorCalculado, invalidBreakdownValueError);

    return {
      formaPagamento,
      valorCalculado,
      valorConferido,
      diferenca,
      valorAjuste,
      valorFinal: normalizeSignedMoney(valorCalculado + valorAjuste, invalidBreakdownValueError)
    };
  });

  const totalCalculado = normalizeMoney(
    itens.reduce((total, item) => total + item.valorCalculado, 0),
    invalidBreakdownValueError
  );
  const totalConferido =
    conferido === null
      ? null
      : normalizeMoney(itens.reduce((total, item) => total + (item.valorConferido ?? 0), 0), invalidBreakdownValueError);
  const diferencaTotal =
    totalConferido === null
      ? null
      : normalizeSignedMoney(totalConferido - totalCalculado, invalidBreakdownValueError);
  const totalAjustes = normalizeSignedMoney(
    itens.reduce((total, item) => total + item.valorAjuste, 0),
    invalidBreakdownValueError
  );

  return {
    itens,
    totalCalculado,
    totalConferido,
    diferencaTotal,
    totalAjustes,
    totalFinal: normalizeSignedMoney(totalCalculado + totalAjustes, invalidBreakdownValueError)
  };
}

export function normalizeBreakdown(
  values: CashBreakdownValue[],
  options: { allowNegative: boolean; requireNonZero: boolean }
): CashBreakdownValue[] {
  const totals = createEmptyBreakdownMap();

  for (const value of values) {
    const normalizedValue = options.allowNegative
      ? normalizeSignedMoney(value.valor, invalidBreakdownValueError)
      : normalizeMoney(value.valor, invalidBreakdownValueError);

    totals[value.formaPagamento] += normalizedValue;
  }

  const breakdown = toBreakdownArray(totals);

  if (options.requireNonZero && breakdown.every((item) => item.valor === 0)) {
    throw adjustmentRequiresNonZeroValueError();
  }

  return breakdown;
}

function summarizeAdjustmentValues(adjustments: CashRegisterAdjustmentRecord[]) {
  const totals = createEmptyBreakdownMap();

  for (const adjustment of adjustments) {
    for (const value of adjustment.valores) {
      totals[value.formaPagamento] += normalizeSignedMoney(value.valor, invalidBreakdownValueError);
    }
  }

  return totals;
}

function breakdownToMap(values: CashBreakdownValue[]) {
  const totals = createEmptyBreakdownMap();

  for (const value of values) {
    totals[value.formaPagamento] += normalizeSignedMoney(value.valor, invalidBreakdownValueError);
  }

  return totals;
}

function toBreakdownArray(values: Record<FormaPagamento, number>) {
  return cashRegisterPaymentMethods.map((formaPagamento) => ({
    formaPagamento,
    valor: normalizeSignedMoney(values[formaPagamento], invalidBreakdownValueError)
  }));
}

function createEmptyBreakdownMap(): Record<FormaPagamento, number> {
  return {
    Pix: 0,
    Dinheiro: 0,
    CartaoCredito: 0,
    CartaoDebito: 0,
    Transferencia: 0
  };
}

function normalizeRequiredText(value: string, errorFactory: () => AppError) {
  const normalized = value.trim();

  if (!normalized) {
    throw errorFactory();
  }

  return normalized;
}

function normalizeOptionalText(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeMoney(value: number, errorFactory: () => AppError) {
  if (!Number.isFinite(value) || value < 0) {
    throw errorFactory();
  }

  return roundMoney(value);
}

function normalizeSignedMoney(value: number, errorFactory: () => AppError) {
  if (!Number.isFinite(value)) {
    throw errorFactory();
  }

  return roundMoney(value);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildCashRegisterPdfFileName(caixa: CashRegisterRecord) {
  const closedAt = (caixa.fechadoEm ?? caixa.abertoEm).toISOString().slice(0, 10);
  return `caixa-${caixa.id}-${closedAt}.pdf`;
}

function cashRegisterAlreadyOpenError() {
  return new AppError({
    code: "CAIXA_001",
    message: "O usuario ja possui um caixa aberto.",
    statusCode: 409
  });
}

function cashRegisterNotFoundError() {
  return new AppError({
    code: "CAIXA_002",
    message: "Caixa nao encontrado.",
    statusCode: 404
  });
}

function cashRegisterAlreadyClosedError() {
  return new AppError({
    code: "CAIXA_003",
    message: "O caixa informado ja foi fechado.",
    statusCode: 409
  });
}

function cashRegisterAccessDeniedError() {
  return new AppError({
    code: "CAIXA_004",
    message: "Voce nao pode acessar este caixa.",
    statusCode: 403
  });
}

function invalidShiftError() {
  return new AppError({
    code: "CAIXA_005",
    message: "Informe um turno valido para abrir o caixa.",
    statusCode: 400
  });
}

function invalidBreakdownValueError() {
  return new AppError({
    code: "CAIXA_006",
    message: "Os valores informados para o caixa sao invalidos.",
    statusCode: 400
  });
}

function adjustmentRequiresClosedCashRegisterError() {
  return new AppError({
    code: "CAIXA_007",
    message: "Ajustes administrativos so podem ser criados para caixas fechados.",
    statusCode: 409
  });
}

function invalidAdjustmentReasonError() {
  return new AppError({
    code: "CAIXA_008",
    message: "Informe um motivo valido para o ajuste administrativo.",
    statusCode: 400
  });
}

function adjustmentRequiresNonZeroValueError() {
  return new AppError({
    code: "CAIXA_009",
    message: "O ajuste administrativo precisa alterar ao menos um valor do fechamento.",
    statusCode: 400
  });
}

function pdfRequiresClosedCashRegisterError() {
  return new AppError({
    code: "CAIXA_010",
    message: "O PDF de fechamento so pode ser gerado para um caixa ja fechado.",
    statusCode: 409
  });
}
