import { AppError } from "../../shared/errors/app-error.js";
import type { AuthUserRecord } from "../auth/auth.service.js";
import {
  toCobrancaResponse,
  toEstadiaExtraResponse,
  type CobrancaRecord,
  type EstadiaExtraRecord
} from "../financeiro/financeiro.service.js";
import { toEstadiaResponse, type EstadiaRecord } from "../estadias/estadias.service.js";
import { buildCheckoutReceiptPdf } from "./checkouts.pdf.js";

export type CheckoutReceiptItemStatus = "Pendente" | "Pago" | "Cancelada";

export type CheckoutReceiptRecord = {
  numero: string;
  geradoEm: Date;
  avisoImpressao: string;
  downloadUrl: string;
  hospedeResponsavel: {
    id: number;
    nomeCompleto: string;
    cpf: string;
  };
  flat: {
    id: number;
    numero: string;
  };
  periodo: {
    dataInicio: Date;
    dataFimPrevista: Date;
    dataFimEfetiva: Date;
  };
  totais: {
    totalCobrado: number;
    totalPago: number;
    totalPendente: number;
  };
  itens: Array<{
    tipo: "Mensalidade" | "Extra";
    descricao: string;
    valor: number;
    status: CheckoutReceiptItemStatus;
  }>;
};

export type CheckoutContextRecord = {
  estadia: EstadiaRecord;
  cobrancas: CobrancaRecord[];
  extras: EstadiaExtraRecord[];
};

export type FinalizeCheckoutPayload = {
  estadiaId: number;
  usuario: Pick<AuthUserRecord, "id" | "nomeCompleto" | "perfil">;
  dataCheckout: Date;
  motivoOverride: string | null;
  reciboNumero: string;
  totalCobrado: number;
  totalPago: number;
  totalPendente: number;
  cobrancasPendentes: number[];
  extrasPendentes: number[];
};

export type CheckoutInput = {
  motivoOverride?: string;
};

export type CheckoutsRepository = {
  findByEstadiaId(id: number): Promise<CheckoutContextRecord | null>;
  finalizeCheckout(data: FinalizeCheckoutPayload): Promise<CheckoutContextRecord>;
};

const RECEIPT_PRINT_WARNING =
  "Imprima o recibo final antes de liberar o flat para limpeza operacional.";

export class CheckoutsService {
  constructor(private readonly repository: CheckoutsRepository) {}

  async checkout(estadiaId: number, user: AuthUserRecord, input: CheckoutInput) {
    const current = await this.repository.findByEstadiaId(estadiaId);

    if (!current) {
      throw stayNotFoundError();
    }

    if (current.estadia.status !== "Ativa") {
      throw stayAlreadyClosedError();
    }

    const financial = summarizeFinancial(current.cobrancas, current.extras);
    const motivoOverride = normalizeOptionalText(input.motivoOverride);
    const hasPendingDebt = financial.totalPendente > 0;

    if (hasPendingDebt && user.perfil !== "Admin") {
      throw pendingDebtRequiresAdminError();
    }

    if (hasPendingDebt && !motivoOverride) {
      throw overrideReasonRequiredError();
    }

    const dataCheckout = new Date();
    const reciboNumero = buildReceiptNumber(current.estadia.id, dataCheckout);

    const updated = await this.repository.finalizeCheckout({
      estadiaId: current.estadia.id,
      usuario: {
        id: user.id,
        nomeCompleto: user.nomeCompleto,
        perfil: user.perfil
      },
      dataCheckout,
      motivoOverride,
      reciboNumero,
      totalCobrado: financial.totalCobrado,
      totalPago: financial.totalPago,
      totalPendente: financial.totalPendente,
      cobrancasPendentes: financial.cobrancasPendentes.map((item) => item.id),
      extrasPendentes: financial.extrasPendentes.map((item) => item.id)
    });

    const updatedFinancial = summarizeFinancial(updated.cobrancas, updated.extras);

    return {
      estadia: toEstadiaResponse(updated.estadia),
      resumoFinanceiro: {
        totalCobrado: updatedFinancial.totalCobrado,
        totalPago: updatedFinancial.totalPago,
        totalPendente: updatedFinancial.totalPendente,
        cobrancasPendentes: updatedFinancial.cobrancasPendentes.map(toCobrancaResponse),
        extrasPendentes: updatedFinancial.extrasPendentes.map(toEstadiaExtraResponse)
      },
      override: {
        aplicado: hasPendingDebt,
        motivo: hasPendingDebt ? motivoOverride : null,
        autorizadoPor: hasPendingDebt
          ? {
              id: user.id,
              nomeCompleto: user.nomeCompleto,
              perfil: user.perfil
            }
          : null
      },
      recibo: toCheckoutReceiptResponse(updated, dataCheckout, reciboNumero),
      avisoImpressao: RECEIPT_PRINT_WARNING
    };
  }

  async generateReceiptPdf(estadiaId: number) {
    const current = await this.repository.findByEstadiaId(estadiaId);

    if (!current) {
      throw stayNotFoundError();
    }

    if (current.estadia.status !== "Encerrada" || !current.estadia.dataFimEfetiva) {
      throw receiptUnavailableError();
    }

    const receipt = toCheckoutReceiptResponse(
      current,
      current.estadia.dataFimEfetiva,
      buildReceiptNumber(current.estadia.id, current.estadia.dataFimEfetiva)
    );

    return {
      fileName: `recibo-checkout-estadia-${current.estadia.id}.pdf`,
      buffer: buildCheckoutReceiptPdf({
        numero: receipt.numero,
        geradoEm: receipt.geradoEm,
        estadiaId: current.estadia.id,
        hospedeResponsavel: receipt.hospedeResponsavel,
        flat: receipt.flat,
        periodo: receipt.periodo,
        totais: receipt.totais,
        itens: receipt.itens,
        motivoOverride: null
      })
    };
  }
}

export function toCheckoutReceiptResponse(
  context: CheckoutContextRecord,
  generatedAt: Date,
  receiptNumber: string
): CheckoutReceiptRecord {
  const financial = summarizeFinancial(context.cobrancas, context.extras);

  return {
    numero: receiptNumber,
    geradoEm: generatedAt,
    avisoImpressao: RECEIPT_PRINT_WARNING,
    downloadUrl: `/api/estadias/${context.estadia.id}/checkout/recibo`,
    hospedeResponsavel: {
      id: context.estadia.hospedeResponsavel.id,
      nomeCompleto: context.estadia.hospedeResponsavel.nomeCompleto,
      cpf: context.estadia.hospedeResponsavel.cpf
    },
    flat: {
      id: context.estadia.flat.id,
      numero: context.estadia.flat.numero
    },
    periodo: {
      dataInicio: context.estadia.dataInicio,
      dataFimPrevista: context.estadia.dataFimPrevista,
      dataFimEfetiva: context.estadia.dataFimEfetiva ?? generatedAt
    },
    totais: {
      totalCobrado: financial.totalCobrado,
      totalPago: financial.totalPago,
      totalPendente: financial.totalPendente
    },
    itens: buildReceiptItems(context)
  };
}

export function summarizeFinancial(cobrancas: CobrancaRecord[], extras: EstadiaExtraRecord[]) {
  const cobrancasValidas = cobrancas.filter((item) => item.status !== "Cancelada");
  const cobrancasPendentes = cobrancas.filter((item) => item.status === "Pendente");
  const extrasPendentes = extras.filter((item) => item.status === "Pendente");

  return {
    totalCobrado: normalizeMoney(
      cobrancasValidas.reduce((total, item) => total + item.valor, 0)
    ),
    totalPago: normalizeMoney(
      cobrancas.reduce(
        (total, item) => total + item.pagamentos.reduce((subtotal, pagamento) => subtotal + pagamento.valor, 0),
        0
      )
    ),
    totalPendente: normalizeMoney(
      cobrancasPendentes.reduce((total, item) => total + item.valor, 0)
    ),
    cobrancasPendentes,
    extrasPendentes
  };
}

function buildReceiptItems(context: CheckoutContextRecord) {
  const monthlyCharges = context.cobrancas
    .filter((item) => item.origem === "Mensalidade")
    .map((item) => ({
      tipo: "Mensalidade" as const,
      descricao: `Competencia ${formatDate(item.competenciaInicio)} a ${formatDate(item.competenciaFim)}`,
      valor: item.valor,
      status: toReceiptStatus(item.status)
    }));

  const extraItems = context.extras.map((item) => ({
    tipo: "Extra" as const,
    descricao: item.descricaoSnapshot,
    valor: item.valorTotal,
    status: item.status
  }));

  return [...monthlyCharges, ...extraItems];
}

function toReceiptStatus(status: CobrancaRecord["status"]): CheckoutReceiptItemStatus {
  if (status === "Paga") {
    return "Pago";
  }

  if (status === "Cancelada") {
    return "Cancelada";
  }

  return "Pendente";
}

function buildReceiptNumber(estadiaId: number, date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `REC-${estadiaId}-${year}${month}${day}${hours}${minutes}`;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeMoney(value: number) {
  return Number(value.toFixed(2));
}

function stayNotFoundError() {
  return new AppError({
    code: "CHECKOUT_001",
    message: "Estadia nao encontrada.",
    statusCode: 404
  });
}

function stayAlreadyClosedError() {
  return new AppError({
    code: "CHECKOUT_002",
    message: "A estadia informada ja foi encerrada.",
    statusCode: 409
  });
}

function pendingDebtRequiresAdminError() {
  return new AppError({
    code: "CHECKOUT_003",
    message: "Checkout com debito pendente exige override administrativo.",
    statusCode: 403
  });
}

function overrideReasonRequiredError() {
  return new AppError({
    code: "CHECKOUT_004",
    message: "Motivo do override administrativo e obrigatorio quando houver debito pendente.",
    statusCode: 400
  });
}

function receiptUnavailableError() {
  return new AppError({
    code: "CHECKOUT_005",
    message: "O recibo final so fica disponivel apos o checkout da estadia.",
    statusCode: 409
  });
}
