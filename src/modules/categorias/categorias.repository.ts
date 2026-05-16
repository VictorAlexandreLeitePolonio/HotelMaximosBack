import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type {
  CategoriaRecord,
  CategoriasListInput,
  CategoriasRepository,
  SubcategoriaRecord,
  SubcategoriasListInput
} from "./categorias.service.js";

function toCategoriaRecord(row: {
  id: number;
  nome: string;
  nomeNormalizado: string;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}): CategoriaRecord {
  return row;
}

function toSubcategoriaRecord(row: {
  id: number;
  categoriaId: number;
  nome: string;
  nomeNormalizado: string;
  precoBase: Prisma.Decimal;
  capacidadeMaxima: number;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
  categoria: { nome: string };
}): SubcategoriaRecord {
  return {
    id: row.id,
    categoriaId: row.categoriaId,
    categoriaNome: row.categoria.nome,
    nome: row.nome,
    nomeNormalizado: row.nomeNormalizado,
    precoBase: row.precoBase.toNumber(),
    capacidadeMaxima: row.capacidadeMaxima,
    ativo: row.ativo,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm
  };
}

export class PrismaCategoriasRepository implements CategoriasRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listCategories(input: CategoriasListInput): Promise<{ data: CategoriaRecord[]; total: number }> {
    const where: Prisma.CategoriaFlatWhereInput = {};

    if (input.search?.trim()) {
      where.nome = {
        contains: input.search.trim(),
        mode: "insensitive"
      };
    }

    if (input.ativo !== undefined) {
      where.ativo = input.ativo;
    }

    const orderBy: Prisma.CategoriaFlatOrderByWithRelationInput = {
      [input.sortField ?? "nome"]: input.sortOrder ?? "asc"
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.categoriaFlat.findMany({
        where,
        orderBy,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.categoriaFlat.count({ where })
    ]);

    return {
      data: data.map(toCategoriaRecord),
      total
    };
  }

  async findCategoryById(id: number) {
    const categoria = await this.prisma.categoriaFlat.findUnique({
      where: { id }
    });

    return categoria ? toCategoriaRecord(categoria) : null;
  }

  async findCategoryByNormalizedName(nomeNormalizado: string) {
    const categoria = await this.prisma.categoriaFlat.findUnique({
      where: { nomeNormalizado }
    });

    return categoria ? toCategoriaRecord(categoria) : null;
  }

  async createCategory(data: Omit<CategoriaRecord, "id" | "criadoEm" | "atualizadoEm">) {
    return toCategoriaRecord(
      await this.prisma.categoriaFlat.create({
        data
      })
    );
  }

  async updateCategory(id: number, data: Partial<Omit<CategoriaRecord, "id" | "criadoEm">>) {
    return toCategoriaRecord(
      await this.prisma.categoriaFlat.update({
        where: { id },
        data
      })
    );
  }

  async countActiveSubcategoriesByCategory(id: number) {
    return this.prisma.subcategoriaFlat.count({
      where: {
        categoriaId: id,
        ativo: true
      }
    });
  }

  async countActiveFlatsByCategory(id: number) {
    return this.prisma.flat.count({
      where: {
        categoriaId: id,
        ativo: true
      }
    });
  }

  async listSubcategories(input: SubcategoriasListInput): Promise<{ data: SubcategoriaRecord[]; total: number }> {
    const where: Prisma.SubcategoriaFlatWhereInput = {};

    if (input.search?.trim()) {
      where.nome = {
        contains: input.search.trim(),
        mode: "insensitive"
      };
    }

    if (input.categoriaId !== undefined) {
      where.categoriaId = input.categoriaId;
    }

    if (input.ativo !== undefined) {
      where.ativo = input.ativo;
    }

    const orderByField = input.sortField ?? "nome";
    const orderBy: Prisma.SubcategoriaFlatOrderByWithRelationInput =
      orderByField === "nome" || orderByField === "criadoEm" || orderByField === "atualizadoEm"
        ? { [orderByField]: input.sortOrder ?? "asc" }
        : { [orderByField]: input.sortOrder ?? "asc" };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.subcategoriaFlat.findMany({
        where,
        orderBy,
        include: {
          categoria: {
            select: {
              nome: true
            }
          }
        },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize
      }),
      this.prisma.subcategoriaFlat.count({ where })
    ]);

    return {
      data: data.map(toSubcategoriaRecord),
      total
    };
  }

  async findSubcategoryById(id: number) {
    const subcategoria = await this.prisma.subcategoriaFlat.findUnique({
      where: { id },
      include: {
        categoria: {
          select: {
            nome: true
          }
        }
      }
    });

    return subcategoria ? toSubcategoriaRecord(subcategoria) : null;
  }

  async findSubcategoryByNormalizedName(categoriaId: number, nomeNormalizado: string) {
    const subcategoria = await this.prisma.subcategoriaFlat.findUnique({
      where: {
        categoriaId_nomeNormalizado: {
          categoriaId,
          nomeNormalizado
        }
      },
      include: {
        categoria: {
          select: {
            nome: true
          }
        }
      }
    });

    return subcategoria ? toSubcategoriaRecord(subcategoria) : null;
  }

  async createSubcategory(
    data: Omit<SubcategoriaRecord, "id" | "categoriaNome" | "criadoEm" | "atualizadoEm">
  ) {
    return toSubcategoriaRecord(
      await this.prisma.subcategoriaFlat.create({
        data,
        include: {
          categoria: {
            select: {
              nome: true
            }
          }
        }
      })
    );
  }

  async updateSubcategory(
    id: number,
    data: Partial<Omit<SubcategoriaRecord, "id" | "categoriaNome" | "criadoEm">>
  ) {
    return toSubcategoriaRecord(
      await this.prisma.subcategoriaFlat.update({
        where: { id },
        data,
        include: {
          categoria: {
            select: {
              nome: true
            }
          }
        }
      })
    );
  }

  async countActiveFlatsBySubcategory(id: number) {
    return this.prisma.flat.count({
      where: {
        subcategoriaId: id,
        ativo: true
      }
    });
  }
}
