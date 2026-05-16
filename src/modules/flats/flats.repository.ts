import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type {
  CategoriaResumoRecord,
  FlatRecord,
  FlatsListInput,
  FlatsRepository,
  SubcategoriaResumoRecord
} from "./flats.service.js";

function toCategoriaResumo(row: { id: number; nome: string; ativo: boolean }): CategoriaResumoRecord {
  return row;
}

function toSubcategoriaResumo(row: {
  id: number;
  categoriaId: number;
  nome: string;
  precoBase: Prisma.Decimal;
  capacidadeMaxima: number;
  ativo: boolean;
}): SubcategoriaResumoRecord {
  return {
    id: row.id,
    categoriaId: row.categoriaId,
    nome: row.nome,
    precoBase: row.precoBase.toNumber(),
    capacidadeMaxima: row.capacidadeMaxima,
    ativo: row.ativo
  };
}

function toFlatRecord(row: {
  id: number;
  numero: string;
  numeroNormalizado: string;
  categoriaId: number;
  subcategoriaId: number;
  statusOperacional: "Livre" | "Reservado" | "Ocupado" | "AguardandoLimpeza" | "Manutencao";
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
  categoria: { id: number; nome: string; ativo: boolean };
  subcategoria: {
    id: number;
    categoriaId: number;
    nome: string;
    precoBase: Prisma.Decimal;
    capacidadeMaxima: number;
    ativo: boolean;
  };
}): FlatRecord {
  return {
    id: row.id,
    numero: row.numero,
    numeroNormalizado: row.numeroNormalizado,
    categoriaId: row.categoriaId,
    subcategoriaId: row.subcategoriaId,
    categoria: toCategoriaResumo(row.categoria),
    subcategoria: toSubcategoriaResumo(row.subcategoria),
    statusOperacional: row.statusOperacional,
    ativo: row.ativo,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
  };
}

export class PrismaFlatsRepository implements FlatsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(input: FlatsListInput): Promise<{ data: FlatRecord[]; total: number }> {
    const where: Prisma.FlatWhereInput = {};

    if (input.search?.trim()) {
      where.numero = {
        contains: input.search.trim(),
        mode: "insensitive"
      };
    }

    if (input.categoriaId !== undefined) {
      where.categoriaId = input.categoriaId;
    }

    if (input.subcategoriaId !== undefined) {
      where.subcategoriaId = input.subcategoriaId;
    }

    if (input.statusOperacional) {
      where.statusOperacional = input.statusOperacional;
    }

    if (input.ativo !== undefined) {
      where.ativo = input.ativo;
    }

    const orderBy: Prisma.FlatOrderByWithRelationInput = {
      [input.sortField ?? "numero"]: input.sortOrder ?? "asc"
    };

    const include = {
      categoria: {
        select: {
          id: true,
          nome: true,
          ativo: true
        }
      },
      subcategoria: {
        select: {
          id: true,
          categoriaId: true,
          nome: true,
          precoBase: true,
          capacidadeMaxima: true,
          ativo: true
        }
      }
    } satisfies Prisma.FlatInclude;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.flat.findMany({
        where,
        orderBy,
        include,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.flat.count({ where })
    ]);

    return {
      data: data.map(toFlatRecord),
      total
    };
  }

  async findById(id: number) {
    const flat = await this.prisma.flat.findUnique({
      where: { id },
      include: {
        categoria: {
          select: {
            id: true,
            nome: true,
            ativo: true
          }
        },
        subcategoria: {
          select: {
            id: true,
            categoriaId: true,
            nome: true,
            precoBase: true,
            capacidadeMaxima: true,
            ativo: true
          }
        }
      }
    });

    return flat ? toFlatRecord(flat) : null;
  }

  async findByNormalizedNumber(numeroNormalizado: string) {
    const flat = await this.prisma.flat.findUnique({
      where: { numeroNormalizado },
      include: {
        categoria: {
          select: {
            id: true,
            nome: true,
            ativo: true
          }
        },
        subcategoria: {
          select: {
            id: true,
            categoriaId: true,
            nome: true,
            precoBase: true,
            capacidadeMaxima: true,
            ativo: true
          }
        }
      }
    });

    return flat ? toFlatRecord(flat) : null;
  }

  async findCategoryById(id: number) {
    const categoria = await this.prisma.categoriaFlat.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        ativo: true
      }
    });

    return categoria ? toCategoriaResumo(categoria) : null;
  }

  async findSubcategoryById(id: number) {
    const subcategoria = await this.prisma.subcategoriaFlat.findUnique({
      where: { id },
      select: {
        id: true,
        categoriaId: true,
        nome: true,
        precoBase: true,
        capacidadeMaxima: true,
        ativo: true
      }
    });

    return subcategoria ? toSubcategoriaResumo(subcategoria) : null;
  }

  async create(data: Omit<FlatRecord, "id" | "categoria" | "subcategoria" | "criadoEm" | "atualizadoEm">) {
    return toFlatRecord(
      await this.prisma.flat.create({
        data,
        include: {
          categoria: {
            select: {
              id: true,
              nome: true,
              ativo: true
            }
          },
          subcategoria: {
            select: {
              id: true,
              categoriaId: true,
              nome: true,
              precoBase: true,
              capacidadeMaxima: true,
              ativo: true
            }
          }
        }
      })
    );
  }

  async update(id: number, data: Partial<Omit<FlatRecord, "id" | "categoria" | "subcategoria" | "criadoEm">>) {
    return toFlatRecord(
      await this.prisma.flat.update({
        where: { id },
        data,
        include: {
          categoria: {
            select: {
              id: true,
              nome: true,
              ativo: true
            }
          },
          subcategoria: {
            select: {
              id: true,
              categoriaId: true,
              nome: true,
              precoBase: true,
              capacidadeMaxima: true,
              ativo: true
            }
          }
        }
      })
    );
  }

  async softDelete(id: number): Promise<void> {
    await this.prisma.flat.update({
      where: { id },
      data: {
        ativo: false
      }
    });
  }
}
