import { AppError } from "../../shared/errors/app-error.js";

export type FormaPagamento =
  | "Pix"
  | "Dinheiro"
  | "CartaoCredito"
  | "CartaoDebito"
  | "Transferencia";

export type StatusCobranca = "Pendente" | "Paga" | "Cancelada";
export type OrigemCobranca = "Mensalidade" | "Extra";
export type CaixaStatus = "Aberto" | "Fechado";
export type StatusEstadia = "Ativa" | "Encerrada";
export type StatusEstadiaExtra = "Pendente" | "Pago";

export type CaixaRecord = {
  id: number;
  usuarioId: number;
  status: CaixaStatus;
  abertoEm: Date;
  fechadoEm: Date | null;
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

export type CobrancaRecord = {
  id: number;
  estadiaId: number;
  origem: OrigemCobranca;
  estadiaExtraId: number | null;
  competenciaInicio: Date;
  competenciaFim: Date;
  valor: number;
  status: StatusCobranca;
  geradaEm: Date;
  liquidadaEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
  pagamentos: PagamentoRecord[];
};

export type TipoExtraRecord = {
  id: number;
  nome: string;
  nomeNormalizado: string;
  valorPadrao: number;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type TipoExtraSummaryRecord = {
  id: number;
  nome: string;
  ativo: boolean;
};

export type EstadiaFinanceiroRecord = {
  id: number;
  status: StatusEstadia;
  dataInicio: Date;
  dataFimPrevista: Date;
  dataFimEfetiva: Date | null;
  valorTotalContratado: number;
};

export type EstadiaExtraRecord = {
  id: number;
  estadiaId: number;
  tipoExtraId: number;
  tipoExtra: TipoExtraSummaryRecord;
  descricaoSnapshot: string;
  valorUnitario: number;
  quantidade: number;
  valorTotal: number;
  status: StatusEstadiaExtra;
  pagoEm: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
  cobranca: CobrancaRecord | null;
};

export type ExtraMutationResultRecord = {
  extra: EstadiaExtraRecord;
  cobranca: CobrancaRecord;
  pagamento: PagamentoRecord | null;
};

export type ChargePaymentResultRecord = {
  cobranca: CobrancaRecord;
  pagamento: PagamentoRecord;
  extra: EstadiaExtraRecord | null;
};

export type ExtraTypesListInput = {
  page: number;
  pageSize: number;
  search?: string;
  ativo?: boolean;
  sortField?: "nome" | "valorPadrao" | "criadoEm" | "atualizadoEm";
  sortOrder?: "asc" | "desc";
};

export type CreateTipoExtraInput = {
  nome: string;
  valorPadrao: number;
};

export type UpdateTipoExtraInput = Partial<CreateTipoExtraInput>;

export type GenerateMonthlyChargesInput = {
  referenceDate?: Date;
};

export type PayChargeInput = {
  formaPagamento: FormaPagamento;
  valorPago: number;
  comprovante?: string;
};

export type CreateStayExtraInput = {
  tipoExtraId: number;
  descricao?: string;
  valorUnitario?: number;
  quantidade?: number;
  pagarAgora?: boolean;
  formaPagamento?: FormaPagamento;
  valorPago?: number;
  comprovante?: string;
};

export type PayExtraInput = PayChargeInput;

export type CreateMonthlyChargePayload = {
  estadiaId: number;
  competenciaInicio: Date;
  competenciaFim: Date;
  valor: number;
};

export type PayChargePayload = {
  cobrancaId: number;
  usuarioId: number;
  caixaId: number;
  formaPagamento: FormaPagamento;
  valor: number;
  comprovante: string | null;
};

export type CreateStayExtraPayload = {
  estadiaId: number;
  tipoExtraId: number;
  descricaoSnapshot: string;
  valorUnitario: number;
  quantidade: number;
  valorTotal: number;
  pagamento:
    | {
        usuarioId: number;
        caixaId: number;
        formaPagamento: FormaPagamento;
        valor: number;
        comprovante: string | null;
      }
    | null;
};

export type FinanceiroRepository = {
  findEstadiaById(id: number): Promise<EstadiaFinanceiroRecord | null>;
  listCobrancasByEstadiaId(estadiaId: number): Promise<CobrancaRecord[]>;
  listExtrasByEstadiaId(estadiaId: number): Promise<EstadiaExtraRecord[]>;
  listTiposExtra(input: ExtraTypesListInput): Promise<{ data: TipoExtraRecord[]; total: number }>;
  findTipoExtraById(id: number): Promise<TipoExtraRecord | null>;
  findTipoExtraByNormalizedName(nomeNormalizado: string): Promise<TipoExtraRecord | null>;
  createTipoExtra(data: Omit<TipoExtraRecord, "id" | "criadoEm" | "atualizadoEm">): Promise<TipoExtraRecord>;
  updateTipoExtra(
    id: number,
    data: Partial<Omit<TipoExtraRecord, "id" | "criadoEm">>
  ): Promise<TipoExtraRecord>;
  findOpenCaixaByUsuarioId(usuarioId: number): Promise<CaixaRecord | null>;
  findCobrancaById(id: number): Promise<CobrancaRecord | null>;
  createMonthlyCharge(data: CreateMonthlyChargePayload): Promise<CobrancaRecord>;
  payCharge(data: PayChargePayload): Promise<ChargePaymentResultRecord>;
  findExtraById(id: number): Promise<EstadiaExtraRecord | null>;
  createStayExtra(data: CreateStayExtraPayload): Promise<ExtraMutationResultRecord>;
};

export class FinanceiroService {
  constructor(private readonly repository: FinanceiroRepository) {}

  async getStayFinancial(estadiaId: number) {
    const estadia = await this.repository.findEstadiaById(estadiaId);

    if (!estadia) {
      throw stayNotFoundError();
    }

    const [cobrancas, extras] = await Promise.all([
      this.repository.listCobrancasByEstadiaId(estadiaId),
      this.repository.listExtrasByEstadiaId(estadiaId)
    ]);

    return {
      estadia: toEstadiaFinanceiroResponse(estadia),
      cobrancas: cobrancas.map(toCobrancaResponse),
      extras: extras.map(toEstadiaExtraResponse)
    };
  }

  async listExtraTypes(input: ExtraTypesListInput) {
    const { data, total } = await this.repository.listTiposExtra(input);

    return {
      data: data.map(toTipoExtraResponse),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize)
      }
    };
  }

  async getExtraTypeById(id: number) {
    const extraType = await this.repository.findTipoExtraById(id);

    if (!extraType) {
      throw extraTypeNotFoundError();
    }

    return toTipoExtraResponse(extraType);
  }

  async createExtraType(input: CreateTipoExtraInput) {
    const nome = normalizeRequiredText(input.nome);
    const nomeNormalizado = normalizeName(nome);

    await this.ensureExtraTypeNameAvailable(nomeNormalizado);

    return toTipoExtraResponse(
      await this.repository.createTipoExtra({
        nome,
        nomeNormalizado,
        valorPadrao: normalizeMoney(input.valorPadrao, invalidMoneyError),
        ativo: true
      })
    );
  }

  async updateExtraType(id: number, input: UpdateTipoExtraInput) {
    const current = await this.repository.findTipoExtraById(id);

    if (!current) {
      throw extraTypeNotFoundError();
    }

    const data: Partial<Omit<TipoExtraRecord, "id" | "criadoEm">> = {};

    if (input.nome !== undefined) {
      const nome = normalizeRequiredText(input.nome);
      const nomeNormalizado = normalizeName(nome);
      await this.ensureExtraTypeNameAvailable(nomeNormalizado, id);
      data.nome = nome;
      data.nomeNormalizado = nomeNormalizado;
    }

    if (input.valorPadrao !== undefined) {
      data.valorPadrao = normalizeMoney(input.valorPadrao, invalidMoneyError);
    }

    return toTipoExtraResponse(await this.repository.updateTipoExtra(id, data));
  }

  async deleteExtraType(id: number) {
    const current = await this.repository.findTipoExtraById(id);

    if (!current) {
      throw extraTypeNotFoundError();
    }

    await this.repository.updateTipoExtra(id, { ativo: false });
  }

  async generateMonthlyCharges(estadiaId: number, input: GenerateMonthlyChargesInput) {
    const estadia = await this.repository.findEstadiaById(estadiaId);

    if (!estadia) {
      throw stayNotFoundError();
    }

    const referenceDate = normalizeDate(input.referenceDate ?? new Date(), invalidReferenceDateError);
    const cutoff = getChargeGenerationCutoff(estadia, referenceDate);
    const existingCharges = await this.repository.listCobrancasByEstadiaId(estadiaId);
    const monthlyCharges = existingCharges
      .filter((charge) => charge.origem === "Mensalidade")
      .sort((left, right) => left.competenciaInicio.getTime() - right.competenciaInicio.getTime());

    let nextCompetenciaInicio =
      monthlyCharges.at(-1)?.competenciaFim ?? normalizeDate(estadia.dataInicio, invalidReferenceDateError);

    const createdCharges: CobrancaRecord[] = [];

    while (nextCompetenciaInicio < cutoff) {
      const competenciaFim = addDays(nextCompetenciaInicio, 30);
      const charge = await this.repository.createMonthlyCharge({
        estadiaId: estadia.id,
        competenciaInicio: nextCompetenciaInicio,
        competenciaFim,
        valor: normalizeMoney(estadia.valorTotalContratado, invalidMoneyError)
      });

      createdCharges.push(charge);
      nextCompetenciaInicio = competenciaFim;
    }

    return {
      estadia: toEstadiaFinanceiroResponse(estadia),
      cobrancasGeradas: createdCharges.map(toCobrancaResponse)
    };
  }

  async payCharge(cobrancaId: number, usuarioId: number, input: PayChargeInput) {
    const charge = await this.repository.findCobrancaById(cobrancaId);

    if (!charge) {
      throw chargeNotFoundError();
    }

    this.assertChargeCanBePaid(charge);

    const caixa = await this.requireOpenCaixa(usuarioId);
    const valorPago = normalizeMoney(input.valorPago, invalidPaymentError);
    ensureIntegralPayment(valorPago, charge.valor);

    const result = await this.repository.payCharge({
      cobrancaId: charge.id,
      usuarioId,
      caixaId: caixa.id,
      formaPagamento: input.formaPagamento,
      valor: valorPago,
      comprovante: normalizePaymentProof(input.formaPagamento, input.comprovante)
    });

    return {
      cobranca: toCobrancaResponse(result.cobranca),
      pagamento: toPagamentoResponse(result.pagamento),
      extra: result.extra ? toEstadiaExtraResponse(result.extra) : null
    };
  }

  async createStayExtra(estadiaId: number, usuarioId: number, input: CreateStayExtraInput) {
    const [estadia, extraType] = await Promise.all([
      this.repository.findEstadiaById(estadiaId),
      this.repository.findTipoExtraById(input.tipoExtraId)
    ]);

    if (!estadia) {
      throw stayNotFoundError();
    }

    if (estadia.status !== "Ativa") {
      throw stayNotActiveForExtraError();
    }

    if (!extraType) {
      throw extraTypeNotFoundError();
    }

    if (!extraType.ativo) {
      throw extraTypeInactiveError();
    }

    const quantidade = normalizeQuantity(input.quantidade ?? 1);
    const valorUnitario = normalizeMoney(
      input.valorUnitario ?? extraType.valorPadrao,
      invalidMoneyError
    );
    const valorTotal = normalizeMoney(valorUnitario * quantidade, invalidMoneyError);

    let pagamento: CreateStayExtraPayload["pagamento"] = null;

    if (input.pagarAgora) {
      const caixa = await this.requireOpenCaixa(usuarioId);

      if (!input.formaPagamento || input.valorPago === undefined) {
        throw paymentDataRequiredError();
      }

      const valorPago = normalizeMoney(input.valorPago, invalidPaymentError);
      ensureIntegralPayment(valorPago, valorTotal);

      pagamento = {
        usuarioId,
        caixaId: caixa.id,
        formaPagamento: input.formaPagamento,
        valor: valorPago,
        comprovante: normalizePaymentProof(input.formaPagamento, input.comprovante)
      };
    }

    const result = await this.repository.createStayExtra({
      estadiaId,
      tipoExtraId: extraType.id,
      descricaoSnapshot: normalizeOptionalText(input.descricao) ?? extraType.nome,
      valorUnitario,
      quantidade,
      valorTotal,
      pagamento
    });

    return {
      extra: toEstadiaExtraResponse(result.extra),
      cobranca: toCobrancaResponse(result.cobranca),
      pagamento: result.pagamento ? toPagamentoResponse(result.pagamento) : null
    };
  }

  async payExtra(extraId: number, usuarioId: number, input: PayExtraInput) {
    const extra = await this.repository.findExtraById(extraId);

    if (!extra) {
      throw extraNotFoundError();
    }

    if (extra.status === "Pago") {
      throw extraAlreadyPaidError();
    }

    if (!extra.cobranca) {
      throw chargeNotFoundError();
    }

    this.assertChargeCanBePaid(extra.cobranca);

    const caixa = await this.requireOpenCaixa(usuarioId);
    const valorPago = normalizeMoney(input.valorPago, invalidPaymentError);
    ensureIntegralPayment(valorPago, extra.valorTotal);

    const result = await this.repository.payCharge({
      cobrancaId: extra.cobranca.id,
      usuarioId,
      caixaId: caixa.id,
      formaPagamento: input.formaPagamento,
      valor: valorPago,
      comprovante: normalizePaymentProof(input.formaPagamento, input.comprovante)
    });

    return {
      extra: result.extra ? toEstadiaExtraResponse(result.extra) : toEstadiaExtraResponse(extra),
      cobranca: toCobrancaResponse(result.cobranca),
      pagamento: toPagamentoResponse(result.pagamento)
    };
  }

  private async ensureExtraTypeNameAvailable(nomeNormalizado: string, ignoreId?: number) {
    const current = await this.repository.findTipoExtraByNormalizedName(nomeNormalizado);

    if (current && current.id !== ignoreId) {
      throw extraTypeNameTakenError();
    }
  }

  private async requireOpenCaixa(usuarioId: number) {
    const caixa = await this.repository.findOpenCaixaByUsuarioId(usuarioId);

    if (!caixa) {
      throw openCashRegisterRequiredError();
    }

    return caixa;
  }

  private assertChargeCanBePaid(charge: CobrancaRecord) {
    if (charge.status === "Paga") {
      throw chargeAlreadyPaidError();
    }

    if (charge.status === "Cancelada") {
      throw chargeCancelledError();
    }
  }
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

export function toCobrancaResponse(cobranca: CobrancaRecord) {
  return {
    id: cobranca.id,
    estadiaId: cobranca.estadiaId,
    origem: cobranca.origem,
    estadiaExtraId: cobranca.estadiaExtraId,
    competenciaInicio: cobranca.competenciaInicio,
    competenciaFim: cobranca.competenciaFim,
    valor: cobranca.valor,
    status: cobranca.status,
    geradaEm: cobranca.geradaEm,
    liquidadaEm: cobranca.liquidadaEm,
    criadoEm: cobranca.criadoEm,
    atualizadoEm: cobranca.atualizadoEm,
    pagamentos: cobranca.pagamentos.map(toPagamentoResponse)
  };
}

export function toTipoExtraResponse(extraType: TipoExtraRecord) {
  return {
    id: extraType.id,
    nome: extraType.nome,
    valorPadrao: extraType.valorPadrao,
    ativo: extraType.ativo,
    criadoEm: extraType.criadoEm,
    atualizadoEm: extraType.atualizadoEm
  };
}

export function toEstadiaExtraResponse(extra: EstadiaExtraRecord) {
  return {
    id: extra.id,
    estadiaId: extra.estadiaId,
    tipoExtraId: extra.tipoExtraId,
    tipoExtra: {
      id: extra.tipoExtra.id,
      nome: extra.tipoExtra.nome,
      ativo: extra.tipoExtra.ativo
    },
    descricaoSnapshot: extra.descricaoSnapshot,
    valorUnitario: extra.valorUnitario,
    quantidade: extra.quantidade,
    valorTotal: extra.valorTotal,
    status: extra.status,
    pagoEm: extra.pagoEm,
    criadoEm: extra.criadoEm,
    atualizadoEm: extra.atualizadoEm,
    cobranca: extra.cobranca ? toCobrancaResponse(extra.cobranca) : null
  };
}

export function toEstadiaFinanceiroResponse(estadia: EstadiaFinanceiroRecord) {
  return {
    id: estadia.id,
    status: estadia.status,
    dataInicio: estadia.dataInicio,
    dataFimPrevista: estadia.dataFimPrevista,
    dataFimEfetiva: estadia.dataFimEfetiva,
    valorTotalContratado: estadia.valorTotalContratado
  };
}

function normalizeRequiredText(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw invalidTextError();
  }

  return normalized;
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeMoney(value: number, errorFactory: () => AppError) {
  if (!Number.isFinite(value) || value < 0) {
    throw errorFactory();
  }

  return Number(value.toFixed(2));
}

function normalizeQuantity(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw invalidQuantityError();
  }

  return value;
}

function normalizeDate(value: Date, errorFactory: () => AppError) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw errorFactory();
  }

  return value;
}

function normalizePaymentProof(formaPagamento: FormaPagamento, comprovante?: string) {
  const normalized = normalizeOptionalText(comprovante);

  if (formaPagamento !== "Dinheiro" && !normalized) {
    throw paymentProofRequiredError();
  }

  return normalized;
}

function ensureIntegralPayment(valorPago: number, valorEsperado: number) {
  if (valorPago !== valorEsperado) {
    throw invalidPaymentAmountError();
  }
}

function addDays(baseDate: Date, days: number) {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + days);
  return result;
}

function getChargeGenerationCutoff(estadia: EstadiaFinanceiroRecord, referenceDate: Date) {
  if (estadia.status === "Encerrada" && estadia.dataFimEfetiva) {
    return estadia.dataFimEfetiva < referenceDate ? estadia.dataFimEfetiva : referenceDate;
  }

  return referenceDate;
}

function stayNotFoundError() {
  return new AppError({
    code: "FINANCEIRO_001",
    message: "Estadia não encontrada.",
    statusCode: 404
  });
}

function chargeNotFoundError() {
  return new AppError({
    code: "FINANCEIRO_002",
    message: "Cobrança não encontrada.",
    statusCode: 404
  });
}

function openCashRegisterRequiredError() {
  return new AppError({
    code: "FINANCEIRO_003",
    message: "É necessário possuir um caixa aberto para registrar pagamentos.",
    statusCode: 409
  });
}

function paymentProofRequiredError() {
  return new AppError({
    code: "FINANCEIRO_004",
    message: "Comprovante é obrigatório para a forma de pagamento informada.",
    statusCode: 400
  });
}

function invalidPaymentError() {
  return new AppError({
    code: "FINANCEIRO_005",
    message: "O valor informado para pagamento é inválido.",
    statusCode: 400
  });
}

function chargeAlreadyPaidError() {
  return new AppError({
    code: "FINANCEIRO_006",
    message: "A cobrança informada já foi paga.",
    statusCode: 409
  });
}

function chargeCancelledError() {
  return new AppError({
    code: "FINANCEIRO_007",
    message: "A cobrança informada está cancelada.",
    statusCode: 409
  });
}

function extraTypeNotFoundError() {
  return new AppError({
    code: "FINANCEIRO_008",
    message: "Tipo de extra não encontrado.",
    statusCode: 404
  });
}

function extraTypeNameTakenError() {
  return new AppError({
    code: "FINANCEIRO_009",
    message: "Já existe um tipo de extra com esse nome.",
    statusCode: 409
  });
}

function extraNotFoundError() {
  return new AppError({
    code: "FINANCEIRO_010",
    message: "Extra não encontrado.",
    statusCode: 404
  });
}

function extraAlreadyPaidError() {
  return new AppError({
    code: "FINANCEIRO_011",
    message: "O extra informado já está pago.",
    statusCode: 409
  });
}

function paymentDataRequiredError() {
  return new AppError({
    code: "FINANCEIRO_012",
    message: "Dados de pagamento são obrigatórios quando o extra deve ser pago imediatamente.",
    statusCode: 400
  });
}

function invalidQuantityError() {
  return new AppError({
    code: "FINANCEIRO_013",
    message: "A quantidade informada para o extra é inválida.",
    statusCode: 400
  });
}

function invalidMoneyError() {
  return new AppError({
    code: "FINANCEIRO_014",
    message: "O valor monetário informado é inválido.",
    statusCode: 400
  });
}

function invalidReferenceDateError() {
  return new AppError({
    code: "FINANCEIRO_015",
    message: "A data de referência informada é inválida.",
    statusCode: 400
  });
}

function invalidPaymentAmountError() {
  return new AppError({
    code: "FINANCEIRO_016",
    message: "O pagamento deve quitar integralmente o valor da cobrança.",
    statusCode: 400
  });
}

function extraTypeInactiveError() {
  return new AppError({
    code: "FINANCEIRO_017",
    message: "O tipo de extra informado está inativo.",
    statusCode: 409
  });
}

function stayNotActiveForExtraError() {
  return new AppError({
    code: "FINANCEIRO_018",
    message: "Só é possível lançar extras para estadias ativas.",
    statusCode: 409
  });
}

function invalidTextError() {
  return new AppError({
    code: "FINANCEIRO_019",
    message: "O texto informado é obrigatório.",
    statusCode: 400
  });
}
