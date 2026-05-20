import type { PrismaClient } from "@prisma/client";
import type {
  CheckoutContextRecord,
  CheckoutsRepository,
  FinalizeCheckoutPayload
} from "./checkouts.service.js";
import type { EstadiaRecord } from "../estadias/estadias.service.js";
import type { CobrancaRecord, EstadiaExtraRecord } from "../financeiro/financeiro.service.js";

type PrismaDb = PrismaClient | PrismaClient["$transaction"];

const estadiaInclude = {
  flat: true,
  subcategoria: true,
  hospedeResponsavel: true,
  hospedes: {
    include: {
      acompanhante: true
    }
  }
} as const;

const chargeInclude = {
  pagamentos: true
} as const;

const extraInclude = {
  tipoExtra: true,
  cobranca: {
    include: chargeInclude
  }
} as const;

export class PrismaCheckoutsRepository implements CheckoutsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEstadiaId(id: number) {
    return this.loadCheckoutContext(this.prisma, id);
  }

  async finalizeCheckout(data: FinalizeCheckoutPayload) {
    await this.prisma.$transaction(async (tx: any) => {
      const estadia = await tx.estadia.findUniqueOrThrow({
        where: {
          id: data.estadiaId
        },
        select: {
          flatId: true
        }
      });

      await tx.estadia.update({
        where: {
          id: data.estadiaId
        },
        data: {
          status: "Encerrada",
          dataFimEfetiva: data.dataCheckout
        }
      });

      await tx.flat.update({
        where: {
          id: estadia.flatId
        },
        data: {
          statusOperacional: "AguardandoLimpeza"
        }
      });

      await tx.limpeza.upsert({
        where: {
          chaveGeracao: `checkout:${data.estadiaId}`
        },
        create: {
          chaveGeracao: `checkout:${data.estadiaId}`,
          flatId: estadia.flatId,
          estadiaId: data.estadiaId,
          tipo: "Checkout",
          status: "Pendente",
          dataProgramada: data.dataCheckout,
          atrasaEm: new Date(data.dataCheckout.getTime() + 24 * 60 * 60 * 1000)
        },
        update: {
          flatId: estadia.flatId,
          estadiaId: data.estadiaId,
          tipo: "Checkout",
          status: "Pendente",
          dataProgramada: data.dataCheckout,
          atrasaEm: new Date(data.dataCheckout.getTime() + 24 * 60 * 60 * 1000),
          concluidaEm: null,
          usuarioConclusaoId: null,
          observacoesConclusao: null
        }
      });

      await tx.historicoFlat.create({
        data: {
          flatId: estadia.flatId,
          estadiaId: data.estadiaId,
          usuarioId: data.usuario.id,
          tipo: "CheckOut",
          descricao:
            data.motivoOverride === null
              ? "Checkout concluido com encerramento regular da estadia."
              : "Checkout concluido com override administrativo de debito pendente.",
          metadata: {
            usuarioNome: data.usuario.nomeCompleto,
            usuarioPerfil: data.usuario.perfil,
            motivoOverride: data.motivoOverride,
            reciboNumero: data.reciboNumero,
            totalCobrado: data.totalCobrado,
            totalPago: data.totalPago,
            totalPendente: data.totalPendente,
            cobrancasPendentes: data.cobrancasPendentes,
            extrasPendentes: data.extrasPendentes,
            flatStatusFinal: "AguardandoLimpeza",
            dataCheckout: data.dataCheckout.toISOString()
          }
        }
      });
    });

    const context = await this.loadCheckoutContext(this.prisma, data.estadiaId);

    if (!context) {
      throw new Error("Falha ao recarregar a estadia apos o checkout.");
    }

    return context;
  }

  private async loadCheckoutContext(db: any, estadiaId: number): Promise<CheckoutContextRecord | null> {
    const estadia = await db.estadia.findUnique({
      where: {
        id: estadiaId
      },
      include: estadiaInclude
    });

    if (!estadia) {
      return null;
    }

    const [cobrancas, extras] = await Promise.all([
      db.cobranca.findMany({
        where: {
          estadiaId
        },
        include: chargeInclude,
        orderBy: {
          competenciaInicio: "asc"
        }
      }),
      db.estadiaExtra.findMany({
        where: {
          estadiaId
        },
        include: extraInclude,
        orderBy: {
          criadoEm: "asc"
        }
      })
    ]);

    return {
      estadia: toEstadiaRecord(estadia),
      cobrancas: cobrancas.map(toCobrancaRecord),
      extras: extras.map(toEstadiaExtraRecord)
    };
  }
}

function toEstadiaRecord(row: any): EstadiaRecord {
  return {
    id: row.id,
    reservaId: row.reservaId,
    flatId: row.flatId,
    flat: {
      id: row.flat.id,
      numero: row.flat.numero,
      statusOperacional: row.flat.statusOperacional,
      ativo: row.flat.ativo,
      subcategoriaId: row.flat.subcategoriaId,
      subcategoria: {
        id: row.subcategoria.id,
        nome: row.subcategoria.nome,
        precoBase: Number(row.subcategoria.precoBase),
        capacidadeMaxima: row.subcategoria.capacidadeMaxima
      }
    },
    subcategoriaId: row.subcategoriaId,
    subcategoria: {
      id: row.subcategoria.id,
      nome: row.subcategoria.nome,
      precoBase: Number(row.subcategoria.precoBase),
      capacidadeMaxima: row.subcategoria.capacidadeMaxima
    },
    hospedeResponsavelId: row.hospedeResponsavelId,
    hospedeResponsavel: {
      id: row.hospedeResponsavel.id,
      nomeCompleto: row.hospedeResponsavel.nomeCompleto,
      cpf: row.hospedeResponsavel.cpf,
      ativo: row.hospedeResponsavel.ativo
    },
    acompanhantes: row.hospedes.map((item: any) => ({
      id: item.acompanhante.id,
      nomeCompleto: item.acompanhante.nomeCompleto,
      documento: item.acompanhante.documento,
      menorDeIdade: item.acompanhante.menorDeIdade
    })),
    dataInicio: row.dataInicio,
    dataFimPrevista: row.dataFimPrevista,
    dataFimEfetiva: row.dataFimEfetiva,
    status: row.status,
    quantidadeHospedes: row.quantidadeHospedes,
    cafeContratado: row.cafeContratado,
    valorBaseContratado: Number(row.valorBaseContratado),
    valorCafePorPessoa: Number(row.valorCafePorPessoa),
    valorCafeContratado: Number(row.valorCafeContratado),
    valorTotalContratado: Number(row.valorTotalContratado),
    observacoes: row.observacoes,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
  };
}

function toPagamentoRecord(row: any) {
  return {
    id: row.id,
    cobrancaId: row.cobrancaId,
    usuarioId: row.usuarioId,
    caixaId: row.caixaId,
    formaPagamento: row.formaPagamento,
    valor: Number(row.valor),
    comprovante: row.comprovante,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
  };
}

function toCobrancaRecord(row: any): CobrancaRecord {
  return {
    id: row.id,
    estadiaId: row.estadiaId,
    origem: row.origem,
    estadiaExtraId: row.estadiaExtraId,
    competenciaInicio: row.competenciaInicio,
    competenciaFim: row.competenciaFim,
    valor: Number(row.valor),
    status: row.status,
    geradaEm: row.geradaEm,
    liquidadaEm: row.liquidadaEm,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
    pagamentos: row.pagamentos.map(toPagamentoRecord)
  };
}

function toEstadiaExtraRecord(row: any): EstadiaExtraRecord {
  return {
    id: row.id,
    estadiaId: row.estadiaId,
    tipoExtraId: row.tipoExtraId,
    tipoExtra: {
      id: row.tipoExtra.id,
      nome: row.tipoExtra.nome,
      ativo: row.tipoExtra.ativo
    },
    descricaoSnapshot: row.descricaoSnapshot,
    valorUnitario: Number(row.valorUnitario),
    quantidade: row.quantidade,
    valorTotal: Number(row.valorTotal),
    status: row.status,
    pagoEm: row.pagoEm,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
    cobranca: row.cobranca ? toCobrancaRecord(row.cobranca) : null
  };
}
