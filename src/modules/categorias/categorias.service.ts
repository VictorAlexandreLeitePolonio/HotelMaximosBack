import { AppError } from "../../shared/errors/app-error.js";
import { normalizeName, normalizeRequiredText } from "./categorias.helpers.js";

export type CategoriaRecord = {
  id: number;
  nome: string;
  nomeNormalizado: string;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type SubcategoriaRecord = {
  id: number;
  categoriaId: number;
  categoriaNome: string;
  nome: string;
  nomeNormalizado: string;
  precoBase: number;
  capacidadeMaxima: number;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type CategoriasListInput = {
  page: number;
  pageSize: number;
  search?: string;
  ativo?: boolean;
  sortField?: "nome" | "criadoEm" | "atualizadoEm";
  sortOrder?: "asc" | "desc";
};

export type SubcategoriasListInput = {
  page: number;
  pageSize: number;
  search?: string;
  categoriaId?: number;
  ativo?: boolean;
  sortField?: "nome" | "precoBase" | "capacidadeMaxima" | "criadoEm" | "atualizadoEm";
  sortOrder?: "asc" | "desc";
};

export type CreateCategoriaInput = {
  nome: string;
};

export type UpdateCategoriaInput = Partial<CreateCategoriaInput>;

export type CreateSubcategoriaInput = {
  categoriaId: number;
  nome: string;
  precoBase: number;
  capacidadeMaxima: number;
};

export type UpdateSubcategoriaInput = Partial<CreateSubcategoriaInput>;

export type CategoriasRepository = {
  listCategories(input: CategoriasListInput): Promise<{ data: CategoriaRecord[]; total: number }>;
  findCategoryById(id: number): Promise<CategoriaRecord | null>;
  findCategoryByNormalizedName(nomeNormalizado: string): Promise<CategoriaRecord | null>;
  createCategory(data: Omit<CategoriaRecord, "id" | "criadoEm" | "atualizadoEm">): Promise<CategoriaRecord>;
  updateCategory(id: number, data: Partial<Omit<CategoriaRecord, "id" | "criadoEm">>): Promise<CategoriaRecord>;
  countActiveSubcategoriesByCategory(id: number): Promise<number>;
  countActiveFlatsByCategory(id: number): Promise<number>;
  listSubcategories(input: SubcategoriasListInput): Promise<{ data: SubcategoriaRecord[]; total: number }>;
  findSubcategoryById(id: number): Promise<SubcategoriaRecord | null>;
  findSubcategoryByNormalizedName(categoriaId: number, nomeNormalizado: string): Promise<SubcategoriaRecord | null>;
  createSubcategory(
    data: Omit<SubcategoriaRecord, "id" | "categoriaNome" | "criadoEm" | "atualizadoEm">
  ): Promise<SubcategoriaRecord>;
  updateSubcategory(
    id: number,
    data: Partial<Omit<SubcategoriaRecord, "id" | "categoriaNome" | "criadoEm">>
  ): Promise<SubcategoriaRecord>;
  countActiveFlatsBySubcategory(id: number): Promise<number>;
};

export class CategoriasService {
  constructor(private readonly repository: CategoriasRepository) {}

  async listCategories(input: CategoriasListInput) {
    const { data, total } = await this.repository.listCategories(input);

    return {
      data: data.map(toCategoriaResponse),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize)
      }
    };
  }

  async getCategoryById(id: number) {
    const categoria = await this.repository.findCategoryById(id);

    if (!categoria) {
      throw categoryNotFoundError();
    }

    return toCategoriaResponse(categoria);
  }

  async createCategory(input: CreateCategoriaInput) {
    const nome = normalizeRequiredText(input.nome);
    const nomeNormalizado = normalizeName(nome);

    await this.ensureCategoryNameAvailable(nomeNormalizado);

    return toCategoriaResponse(
      await this.repository.createCategory({
        nome,
        nomeNormalizado,
        ativo: true
      })
    );
  }

  async updateCategory(id: number, input: UpdateCategoriaInput) {
    const categoria = await this.repository.findCategoryById(id);

    if (!categoria) {
      throw categoryNotFoundError();
    }

    const data: Partial<Omit<CategoriaRecord, "id" | "criadoEm">> = {};

    if (input.nome !== undefined) {
      const nome = normalizeRequiredText(input.nome);
      const nomeNormalizado = normalizeName(nome);
      await this.ensureCategoryNameAvailable(nomeNormalizado, id);
      data.nome = nome;
      data.nomeNormalizado = nomeNormalizado;
    }

    return toCategoriaResponse(await this.repository.updateCategory(id, data));
  }

  async deleteCategory(id: number): Promise<void> {
    const categoria = await this.repository.findCategoryById(id);

    if (!categoria) {
      throw categoryNotFoundError();
    }

    const [activeSubcategories, activeFlats] = await Promise.all([
      this.repository.countActiveSubcategoriesByCategory(id),
      this.repository.countActiveFlatsByCategory(id)
    ]);

    if (activeSubcategories > 0 || activeFlats > 0) {
      throw categoryInUseError();
    }

    await this.repository.updateCategory(id, { ativo: false });
  }

  async listSubcategories(input: SubcategoriasListInput) {
    const { data, total } = await this.repository.listSubcategories(input);

    return {
      data: data.map(toSubcategoriaResponse),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize)
      }
    };
  }

  async getSubcategoryById(id: number) {
    const subcategoria = await this.repository.findSubcategoryById(id);

    if (!subcategoria) {
      throw subcategoryNotFoundError();
    }

    return toSubcategoriaResponse(subcategoria);
  }

  async createSubcategory(input: CreateSubcategoriaInput) {
    const categoria = await this.repository.findCategoryById(input.categoriaId);

    if (!categoria || !categoria.ativo) {
      throw categoryNotFoundError();
    }

    const nome = normalizeRequiredText(input.nome);
    const nomeNormalizado = normalizeName(nome);

    await this.ensureSubcategoryNameAvailable(input.categoriaId, nomeNormalizado);

    return toSubcategoriaResponse(
      await this.repository.createSubcategory({
        categoriaId: input.categoriaId,
        nome,
        nomeNormalizado,
        precoBase: this.normalizePrice(input.precoBase),
        capacidadeMaxima: this.normalizeCapacity(input.capacidadeMaxima),
        ativo: true
      })
    );
  }

  async updateSubcategory(id: number, input: UpdateSubcategoriaInput) {
    const current = await this.repository.findSubcategoryById(id);

    if (!current) {
      throw subcategoryNotFoundError();
    }

    const categoriaId = input.categoriaId ?? current.categoriaId;
    const categoria = await this.repository.findCategoryById(categoriaId);

    if (!categoria || !categoria.ativo) {
      throw categoryNotFoundError();
    }

    if (categoriaId !== current.categoriaId) {
      const activeFlats = await this.repository.countActiveFlatsBySubcategory(id);

      if (activeFlats > 0) {
        throw subcategoryCategoryChangeBlockedError();
      }
    }

    const nome = input.nome !== undefined ? normalizeRequiredText(input.nome) : current.nome;
    const nomeNormalizado = normalizeName(nome);
    await this.ensureSubcategoryNameAvailable(categoriaId, nomeNormalizado, id);

    return toSubcategoriaResponse(
      await this.repository.updateSubcategory(id, {
        categoriaId,
        nome,
        nomeNormalizado,
        precoBase: input.precoBase !== undefined ? this.normalizePrice(input.precoBase) : current.precoBase,
        capacidadeMaxima:
          input.capacidadeMaxima !== undefined
            ? this.normalizeCapacity(input.capacidadeMaxima)
            : current.capacidadeMaxima
      })
    );
  }

  async deleteSubcategory(id: number): Promise<void> {
    const subcategoria = await this.repository.findSubcategoryById(id);

    if (!subcategoria) {
      throw subcategoryNotFoundError();
    }

    const activeFlats = await this.repository.countActiveFlatsBySubcategory(id);

    if (activeFlats > 0) {
      throw subcategoryInUseError();
    }

    await this.repository.updateSubcategory(id, { ativo: false });
  }

  private async ensureCategoryNameAvailable(nomeNormalizado: string, currentId?: number) {
    const existing = await this.repository.findCategoryByNormalizedName(nomeNormalizado);

    if (existing && existing.id !== currentId) {
      throw duplicateCategoryError();
    }
  }

  private async ensureSubcategoryNameAvailable(categoriaId: number, nomeNormalizado: string, currentId?: number) {
    const existing = await this.repository.findSubcategoryByNormalizedName(categoriaId, nomeNormalizado);

    if (existing && existing.id !== currentId) {
      throw duplicateSubcategoryError();
    }
  }

  private normalizePrice(value: number): number {
    if (!Number.isFinite(value) || value < 0) {
      throw invalidPriceError();
    }

    return Number(value.toFixed(2));
  }

  private normalizeCapacity(value: number): number {
    if (!Number.isInteger(value) || value <= 0) {
      throw invalidCapacityError();
    }

    return value;
  }
}

export function toCategoriaResponse(categoria: CategoriaRecord) {
  return {
    id: categoria.id,
    nome: categoria.nome,
    ativo: categoria.ativo,
    criadoEm: categoria.criadoEm,
    atualizadoEm: categoria.atualizadoEm
  };
}

export function toSubcategoriaResponse(subcategoria: SubcategoriaRecord) {
  return {
    id: subcategoria.id,
    categoriaId: subcategoria.categoriaId,
    categoriaNome: subcategoria.categoriaNome,
    nome: subcategoria.nome,
    precoBase: subcategoria.precoBase,
    capacidadeMaxima: subcategoria.capacidadeMaxima,
    ativo: subcategoria.ativo,
    criadoEm: subcategoria.criadoEm,
    atualizadoEm: subcategoria.atualizadoEm
  };
}

function duplicateCategoryError(): AppError {
  return new AppError({
    code: "CATEGORIA_001",
    message: "Ja existe uma categoria com este nome.",
    statusCode: 409
  });
}

function categoryNotFoundError(): AppError {
  return new AppError({
    code: "CATEGORIA_002",
    message: "Categoria nao encontrada.",
    statusCode: 404
  });
}

function categoryInUseError(): AppError {
  return new AppError({
    code: "CATEGORIA_003",
    message: "Nao e possivel inativar a categoria porque ela possui subcategorias ou flats ativos.",
    statusCode: 400
  });
}

function duplicateSubcategoryError(): AppError {
  return new AppError({
    code: "SUBCATEGORIA_001",
    message: "Ja existe uma subcategoria com este nome para a categoria informada.",
    statusCode: 409
  });
}

function subcategoryNotFoundError(): AppError {
  return new AppError({
    code: "SUBCATEGORIA_002",
    message: "Subcategoria nao encontrada.",
    statusCode: 404
  });
}

function invalidPriceError(): AppError {
  return new AppError({
    code: "SUBCATEGORIA_003",
    message: "Preco base invalido.",
    statusCode: 400
  });
}

function invalidCapacityError(): AppError {
  return new AppError({
    code: "SUBCATEGORIA_004",
    message: "Capacidade maxima invalida.",
    statusCode: 400
  });
}

function subcategoryInUseError(): AppError {
  return new AppError({
    code: "SUBCATEGORIA_005",
    message: "Nao e possivel inativar a subcategoria porque ela possui flats ativos.",
    statusCode: 400
  });
}

function subcategoryCategoryChangeBlockedError(): AppError {
  return new AppError({
    code: "SUBCATEGORIA_006",
    message: "Nao e possivel alterar a categoria da subcategoria porque ela possui flats ativos.",
    statusCode: 400
  });
}
