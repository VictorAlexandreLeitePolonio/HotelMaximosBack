import { describe, expect, it } from "vitest";
import {
  CategoriasService,
  type CategoriaRecord,
  type CategoriasRepository,
  type SubcategoriaRecord
} from "../src/modules/categorias/categorias.service.js";

class FakeCategoriasRepository implements CategoriasRepository {
  categorias: CategoriaRecord[] = [];
  subcategorias: SubcategoriaRecord[] = [];
  activeFlatsByCategory = new Map<number, number>();
  activeFlatsBySubcategory = new Map<number, number>();

  async listCategories() {
    return {
      data: this.categorias,
      total: this.categorias.length
    };
  }

  async findCategoryById(id: number) {
    return this.categorias.find((item) => item.id === id) ?? null;
  }

  async findCategoryByNormalizedName(nomeNormalizado: string) {
    return this.categorias.find((item) => item.nomeNormalizado === nomeNormalizado) ?? null;
  }

  async createCategory(data: Omit<CategoriaRecord, "id" | "criadoEm" | "atualizadoEm">) {
    const categoria: CategoriaRecord = {
      id: this.categorias.length + 1,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      ...data
    };
    this.categorias.push(categoria);
    return categoria;
  }

  async updateCategory(id: number, data: Partial<Omit<CategoriaRecord, "id" | "criadoEm">>) {
    const categoria = await this.findCategoryById(id);

    if (!categoria) {
      throw new Error("Categoria fake nao encontrada.");
    }

    Object.assign(categoria, data, { atualizadoEm: new Date() });
    return categoria;
  }

  async countActiveSubcategoriesByCategory(id: number) {
    return this.subcategorias.filter((item) => item.categoriaId === id && item.ativo).length;
  }

  async countActiveFlatsByCategory(id: number) {
    return this.activeFlatsByCategory.get(id) ?? 0;
  }

  async listSubcategories() {
    return {
      data: this.subcategorias,
      total: this.subcategorias.length
    };
  }

  async findSubcategoryById(id: number) {
    return this.subcategorias.find((item) => item.id === id) ?? null;
  }

  async findSubcategoryByNormalizedName(categoriaId: number, nomeNormalizado: string) {
    return (
      this.subcategorias.find(
        (item) => item.categoriaId === categoriaId && item.nomeNormalizado === nomeNormalizado
      ) ?? null
    );
  }

  async createSubcategory(data: Omit<SubcategoriaRecord, "id" | "categoriaNome" | "criadoEm" | "atualizadoEm">) {
    const categoria = await this.findCategoryById(data.categoriaId);

    if (!categoria) {
      throw new Error("Categoria fake nao encontrada.");
    }

    const subcategoria: SubcategoriaRecord = {
      id: this.subcategorias.length + 1,
      categoriaNome: categoria.nome,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      ...data
    };
    this.subcategorias.push(subcategoria);
    return subcategoria;
  }

  async updateSubcategory(
    id: number,
    data: Partial<Omit<SubcategoriaRecord, "id" | "categoriaNome" | "criadoEm">>
  ) {
    const subcategoria = await this.findSubcategoryById(id);

    if (!subcategoria) {
      throw new Error("Subcategoria fake nao encontrada.");
    }

    if (data.categoriaId !== undefined) {
      const categoria = await this.findCategoryById(data.categoriaId);
      subcategoria.categoriaNome = categoria?.nome ?? subcategoria.categoriaNome;
    }

    Object.assign(subcategoria, data, { atualizadoEm: new Date() });
    return subcategoria;
  }

  async countActiveFlatsBySubcategory(id: number) {
    return this.activeFlatsBySubcategory.get(id) ?? 0;
  }
}

function createCategoria(overrides: Partial<CategoriaRecord> = {}): CategoriaRecord {
  return {
    id: 1,
    nome: "Standard",
    nomeNormalizado: "standard",
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    ...overrides
  };
}

describe("CategoriasService", () => {
  it("creates category with normalized unique name", async () => {
    const repository = new FakeCategoriasRepository();
    const result = await new CategoriasService(repository).createCategory({
      nome: " Standard "
    });

    expect(result.nome).toBe("Standard");
    expect(repository.categorias[0].nomeNormalizado).toBe("standard");
    expect(result.ativo).toBe(true);
  });

  it("rejects duplicate category names with CATEGORIA_001", async () => {
    const repository = new FakeCategoriasRepository();
    repository.categorias.push(createCategoria());

    await expect(
      new CategoriasService(repository).createCategory({
        nome: "STANDARD"
      })
    ).rejects.toMatchObject({
      code: "CATEGORIA_001",
      statusCode: 409
    });
  });

  it("creates subcategory with price and capacity under an active category", async () => {
    const repository = new FakeCategoriasRepository();
    repository.categorias.push(createCategoria());

    const result = await new CategoriasService(repository).createSubcategory({
      categoriaId: 1,
      nome: " Luxo ",
      precoBase: 199.9,
      capacidadeMaxima: 3
    });

    expect(result).toMatchObject({
      categoriaId: 1,
      categoriaNome: "Standard",
      nome: "Luxo",
      precoBase: 199.9,
      capacidadeMaxima: 3,
      ativo: true
    });
  });

  it("rejects duplicate subcategory names inside the same category with SUBCATEGORIA_001", async () => {
    const repository = new FakeCategoriasRepository();
    repository.categorias.push(createCategoria());
    repository.subcategorias.push({
      id: 1,
      categoriaId: 1,
      categoriaNome: "Standard",
      nome: "Luxo",
      nomeNormalizado: "luxo",
      precoBase: 220,
      capacidadeMaxima: 2,
      ativo: true,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    });

    await expect(
      new CategoriasService(repository).createSubcategory({
        categoriaId: 1,
        nome: " LUXO ",
        precoBase: 250,
        capacidadeMaxima: 4
      })
    ).rejects.toMatchObject({
      code: "SUBCATEGORIA_001",
      statusCode: 409
    });
  });

  it("blocks category deletion when active dependencies exist", async () => {
    const repository = new FakeCategoriasRepository();
    repository.categorias.push(createCategoria());
    repository.subcategorias.push({
      id: 1,
      categoriaId: 1,
      categoriaNome: "Standard",
      nome: "Luxo",
      nomeNormalizado: "luxo",
      precoBase: 220,
      capacidadeMaxima: 2,
      ativo: true,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    });

    await expect(new CategoriasService(repository).deleteCategory(1)).rejects.toMatchObject({
      code: "CATEGORIA_003",
      statusCode: 400
    });
  });

  it("blocks changing subcategory category when active flats use it", async () => {
    const repository = new FakeCategoriasRepository();
    repository.categorias.push(createCategoria({ id: 1, nome: "Standard" }));
    repository.categorias.push(createCategoria({ id: 2, nome: "Master", nomeNormalizado: "master" }));
    repository.subcategorias.push({
      id: 1,
      categoriaId: 1,
      categoriaNome: "Standard",
      nome: "Luxo",
      nomeNormalizado: "luxo",
      precoBase: 220,
      capacidadeMaxima: 2,
      ativo: true,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    });
    repository.activeFlatsBySubcategory.set(1, 1);

    await expect(
      new CategoriasService(repository).updateSubcategory(1, {
        categoriaId: 2
      })
    ).rejects.toMatchObject({
      code: "SUBCATEGORIA_006",
      statusCode: 400
    });
  });
});
