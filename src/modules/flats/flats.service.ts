import { AppError } from "../../shared/errors/app-error.js";
import { normalizeFlatNumber, normalizeRequiredText } from "./flats.helpers.js";

export type FlatStatus = "Livre" | "Reservado" | "Ocupado" | "AguardandoLimpeza" | "Manutencao";

export type CategoriaResumoRecord = {
  id: number;
  nome: string;
  ativo: boolean;
};

export type SubcategoriaResumoRecord = {
  id: number;
  categoriaId: number;
  nome: string;
  precoBase: number;
  capacidadeMaxima: number;
  ativo: boolean;
};

export type FlatRecord = {
  id: number;
  numero: string;
  numeroNormalizado: string;
  categoriaId: number;
  subcategoriaId: number;
  categoria: CategoriaResumoRecord;
  subcategoria: SubcategoriaResumoRecord;
  statusOperacional: FlatStatus;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type FlatsListInput = {
  page: number;
  pageSize: number;
  search?: string;
  categoriaId?: number;
  subcategoriaId?: number;
  statusOperacional?: FlatStatus;
  ativo?: boolean;
  sortField?: "numero" | "statusOperacional" | "criadoEm" | "atualizadoEm";
  sortOrder?: "asc" | "desc";
};

export type CreateFlatInput = {
  numero: string;
  categoriaId: number;
  subcategoriaId: number;
  statusOperacional?: FlatStatus;
};

export type UpdateFlatInput = Partial<CreateFlatInput>;

export type FlatsRepository = {
  list(input: FlatsListInput): Promise<{ data: FlatRecord[]; total: number }>;
  findById(id: number): Promise<FlatRecord | null>;
  findByNormalizedNumber(numeroNormalizado: string): Promise<FlatRecord | null>;
  findCategoryById(id: number): Promise<CategoriaResumoRecord | null>;
  findSubcategoryById(id: number): Promise<SubcategoriaResumoRecord | null>;
  create(data: Omit<FlatRecord, "id" | "categoria" | "subcategoria" | "criadoEm" | "atualizadoEm">): Promise<FlatRecord>;
  update(id: number, data: Partial<Omit<FlatRecord, "id" | "categoria" | "subcategoria" | "criadoEm">>): Promise<FlatRecord>;
  softDelete(id: number): Promise<void>;
  hasFutureReservation(id: number, now: Date): Promise<boolean>;
};

const OCCUPANCY_BLOCKING_STATUSES: FlatStatus[] = ["Ocupado"];

export class FlatsService {
  constructor(private readonly repository: FlatsRepository) {}

  async list(input: FlatsListInput) {
    const { data, total } = await this.repository.list(input);

    return {
      data: data.map(toFlatResponse),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize)
      }
    };
  }

  async getById(id: number) {
    const flat = await this.repository.findById(id);

    if (!flat) {
      throw flatNotFoundError();
    }

    return toFlatResponse(flat);
  }

  async create(input: CreateFlatInput) {
    const payload = await this.normalizePayload(input);
    await this.ensureFlatNumberAvailable(payload.numeroNormalizado);
    return toFlatResponse(await this.repository.create(payload));
  }

  async update(id: number, input: UpdateFlatInput) {
    const current = await this.repository.findById(id);

    if (!current) {
      throw flatNotFoundError();
    }

    const nextCategoriaId = input.categoriaId ?? current.categoriaId;
    const nextSubcategoriaId = input.subcategoriaId ?? current.subcategoriaId;
    const changingStructure =
      nextCategoriaId !== current.categoriaId || nextSubcategoriaId !== current.subcategoriaId;

    if (changingStructure && OCCUPANCY_BLOCKING_STATUSES.includes(current.statusOperacional)) {
      throw flatStructureBlockedError();
    }

    if (changingStructure && (await this.repository.hasFutureReservation(id, new Date()))) {
      throw flatStructureBlockedError();
    }

    const payload = await this.normalizePayload({
      numero: input.numero ?? current.numero,
      categoriaId: nextCategoriaId,
      subcategoriaId: nextSubcategoriaId,
      statusOperacional: input.statusOperacional ?? current.statusOperacional,
      ativo: current.ativo
    });

    await this.ensureFlatNumberAvailable(payload.numeroNormalizado, id);
    return toFlatResponse(await this.repository.update(id, payload));
  }

  async updateStatus(id: number, statusOperacional: FlatStatus) {
    const current = await this.repository.findById(id);

    if (!current) {
      throw flatNotFoundError();
    }

    return toFlatResponse(await this.repository.update(id, { statusOperacional }));
  }

  async delete(id: number): Promise<void> {
    const current = await this.repository.findById(id);

    if (!current) {
      throw flatNotFoundError();
    }

    await this.repository.softDelete(id);
  }

  private async normalizePayload(
    input: (CreateFlatInput | UpdateFlatInput) & { ativo?: boolean }
  ): Promise<Omit<FlatRecord, "id" | "categoria" | "subcategoria" | "criadoEm" | "atualizadoEm">> {
    const numero = normalizeRequiredText(input.numero ?? "");
    const numeroNormalizado = normalizeFlatNumber(numero);
    const categoriaId = input.categoriaId ?? 0;
    const subcategoriaId = input.subcategoriaId ?? 0;
    const statusOperacional = input.statusOperacional ?? "Livre";

    const [categoria, subcategoria] = await Promise.all([
      this.repository.findCategoryById(categoriaId),
      this.repository.findSubcategoryById(subcategoriaId)
    ]);

    if (!categoria || !categoria.ativo) {
      throw categoryNotFoundError();
    }

    if (!subcategoria || !subcategoria.ativo) {
      throw subcategoryNotFoundError();
    }

    if (subcategoria.categoriaId !== categoria.id) {
      throw invalidCategoryRelationshipError();
    }

    return {
      numero,
      numeroNormalizado,
      categoriaId: categoria.id,
      subcategoriaId: subcategoria.id,
      statusOperacional,
      ativo: input.ativo ?? true
    };
  }

  private async ensureFlatNumberAvailable(numeroNormalizado: string, currentId?: number) {
    const existing = await this.repository.findByNormalizedNumber(numeroNormalizado);

    if (existing && existing.id !== currentId) {
      throw duplicateFlatNumberError();
    }
  }
}

export function toFlatResponse(flat: FlatRecord) {
  return {
    id: flat.id,
    numero: flat.numero,
    categoriaId: flat.categoriaId,
    subcategoriaId: flat.subcategoriaId,
    categoria: {
      id: flat.categoria.id,
      nome: flat.categoria.nome
    },
    subcategoria: {
      id: flat.subcategoria.id,
      nome: flat.subcategoria.nome,
      precoBase: flat.subcategoria.precoBase,
      capacidadeMaxima: flat.subcategoria.capacidadeMaxima
    },
    statusOperacional: flat.statusOperacional,
    ativo: flat.ativo,
    criadoEm: flat.criadoEm,
    atualizadoEm: flat.atualizadoEm
  };
}

function duplicateFlatNumberError(): AppError {
  return new AppError({
    code: "FLAT_001",
    message: "Ja existe um flat com este numero.",
    statusCode: 409
  });
}

function flatNotFoundError(): AppError {
  return new AppError({
    code: "FLAT_002",
    message: "Flat nao encontrado.",
    statusCode: 404
  });
}

function invalidCategoryRelationshipError(): AppError {
  return new AppError({
    code: "FLAT_003",
    message: "A subcategoria informada nao pertence a categoria selecionada.",
    statusCode: 400
  });
}

function categoryNotFoundError(): AppError {
  return new AppError({
    code: "FLAT_004",
    message: "Categoria informada nao encontrada ou inativa.",
    statusCode: 404
  });
}

function flatStructureBlockedError(): AppError {
  return new AppError({
    code: "FLAT_005",
    message: "Nao e possivel alterar categoria ou subcategoria de um flat ocupado ou com reserva futura.",
    statusCode: 400
  });
}

function subcategoryNotFoundError(): AppError {
  return new AppError({
    code: "FLAT_006",
    message: "Subcategoria informada nao encontrada ou inativa.",
    statusCode: 404
  });
}
