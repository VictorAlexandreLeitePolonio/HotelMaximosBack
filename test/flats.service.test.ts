import { describe, expect, it } from "vitest";
import {
  FlatsService,
  type CategoriaResumoRecord,
  type FlatRecord,
  type FlatsRepository,
  type SubcategoriaResumoRecord
} from "../src/modules/flats/flats.service.js";

class FakeFlatsRepository implements FlatsRepository {
  flats: FlatRecord[] = [];
  categorias: CategoriaResumoRecord[] = [];
  subcategorias: SubcategoriaResumoRecord[] = [];

  async list() {
    return {
      data: this.flats,
      total: this.flats.length
    };
  }

  async findById(id: number) {
    return this.flats.find((item) => item.id === id) ?? null;
  }

  async findByNormalizedNumber(numeroNormalizado: string) {
    return this.flats.find((item) => item.numeroNormalizado === numeroNormalizado) ?? null;
  }

  async findCategoryById(id: number) {
    return this.categorias.find((item) => item.id === id) ?? null;
  }

  async findSubcategoryById(id: number) {
    return this.subcategorias.find((item) => item.id === id) ?? null;
  }

  async create(data: Omit<FlatRecord, "id" | "categoria" | "subcategoria" | "criadoEm" | "atualizadoEm">) {
    const categoria = await this.findCategoryById(data.categoriaId);
    const subcategoria = await this.findSubcategoryById(data.subcategoriaId);

    if (!categoria || !subcategoria) {
      throw new Error("Dependencia fake nao encontrada.");
    }

    const flat: FlatRecord = {
      id: this.flats.length + 1,
      categoria,
      subcategoria,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      ...data
    };
    this.flats.push(flat);
    return flat;
  }

  async update(id: number, data: Partial<Omit<FlatRecord, "id" | "categoria" | "subcategoria" | "criadoEm">>) {
    const flat = await this.findById(id);

    if (!flat) {
      throw new Error("Flat fake nao encontrado.");
    }

    if (data.categoriaId !== undefined) {
      const categoria = await this.findCategoryById(data.categoriaId);
      if (categoria) {
        flat.categoria = categoria;
      }
    }

    if (data.subcategoriaId !== undefined) {
      const subcategoria = await this.findSubcategoryById(data.subcategoriaId);
      if (subcategoria) {
        flat.subcategoria = subcategoria;
      }
    }

    Object.assign(flat, data, { atualizadoEm: new Date() });
    return flat;
  }

  async softDelete(id: number) {
    const flat = await this.findById(id);

    if (!flat) {
      throw new Error("Flat fake nao encontrado.");
    }

    flat.ativo = false;
  }
}

function createCategoria(overrides: Partial<CategoriaResumoRecord> = {}): CategoriaResumoRecord {
  return {
    id: 1,
    nome: "Standard",
    ativo: true,
    ...overrides
  };
}

function createSubcategoria(overrides: Partial<SubcategoriaResumoRecord> = {}): SubcategoriaResumoRecord {
  return {
    id: 1,
    categoriaId: 1,
    nome: "Luxo",
    precoBase: 220,
    capacidadeMaxima: 2,
    ativo: true,
    ...overrides
  };
}

describe("FlatsService", () => {
  it("creates flat with valid hierarchy and normalized number", async () => {
    const repository = new FakeFlatsRepository();
    repository.categorias.push(createCategoria());
    repository.subcategorias.push(createSubcategoria());

    const result = await new FlatsService(repository).create({
      numero: " 101a ",
      categoriaId: 1,
      subcategoriaId: 1
    });

    expect(result).toMatchObject({
      numero: "101a",
      categoriaId: 1,
      subcategoriaId: 1,
      statusOperacional: "Livre",
      ativo: true
    });
    expect(repository.flats[0].numeroNormalizado).toBe("101A");
  });

  it("rejects duplicate flat numbers with FLAT_001", async () => {
    const repository = new FakeFlatsRepository();
    repository.categorias.push(createCategoria());
    repository.subcategorias.push(createSubcategoria());
    repository.flats.push({
      id: 1,
      numero: "101A",
      numeroNormalizado: "101A",
      categoriaId: 1,
      subcategoriaId: 1,
      categoria: createCategoria(),
      subcategoria: createSubcategoria(),
      statusOperacional: "Livre",
      ativo: true,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    });

    await expect(
      new FlatsService(repository).create({
        numero: "101a",
        categoriaId: 1,
        subcategoriaId: 1
      })
    ).rejects.toMatchObject({
      code: "FLAT_001",
      statusCode: 409
    });
  });

  it("rejects flat creation when subcategory does not belong to category with FLAT_003", async () => {
    const repository = new FakeFlatsRepository();
    repository.categorias.push(createCategoria({ id: 1 }));
    repository.categorias.push(createCategoria({ id: 2, nome: "Master" }));
    repository.subcategorias.push(createSubcategoria({ id: 1, categoriaId: 2 }));

    await expect(
      new FlatsService(repository).create({
        numero: "202",
        categoriaId: 1,
        subcategoriaId: 1
      })
    ).rejects.toMatchObject({
      code: "FLAT_003",
      statusCode: 400
    });
  });

  it("blocks category or subcategory changes when flat is reserved", async () => {
    const repository = new FakeFlatsRepository();
    repository.categorias.push(createCategoria({ id: 1 }));
    repository.categorias.push(createCategoria({ id: 2, nome: "Master" }));
    repository.subcategorias.push(createSubcategoria({ id: 1, categoriaId: 1 }));
    repository.subcategorias.push(createSubcategoria({ id: 2, categoriaId: 2, nome: "Premium" }));
    repository.flats.push({
      id: 1,
      numero: "101",
      numeroNormalizado: "101",
      categoriaId: 1,
      subcategoriaId: 1,
      categoria: createCategoria({ id: 1 }),
      subcategoria: createSubcategoria({ id: 1, categoriaId: 1 }),
      statusOperacional: "Reservado",
      ativo: true,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    });

    await expect(
      new FlatsService(repository).update(1, {
        categoriaId: 2,
        subcategoriaId: 2
      })
    ).rejects.toMatchObject({
      code: "FLAT_005",
      statusCode: 400
    });
  });

  it("updates operational status without changing the structural hierarchy", async () => {
    const repository = new FakeFlatsRepository();
    repository.categorias.push(createCategoria());
    repository.subcategorias.push(createSubcategoria());
    repository.flats.push({
      id: 1,
      numero: "101",
      numeroNormalizado: "101",
      categoriaId: 1,
      subcategoriaId: 1,
      categoria: createCategoria(),
      subcategoria: createSubcategoria(),
      statusOperacional: "Livre",
      ativo: true,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    });

    const result = await new FlatsService(repository).updateStatus(1, "Manutencao");

    expect(result.statusOperacional).toBe("Manutencao");
    expect(repository.flats[0].categoriaId).toBe(1);
    expect(repository.flats[0].subcategoriaId).toBe(1);
  });
});
