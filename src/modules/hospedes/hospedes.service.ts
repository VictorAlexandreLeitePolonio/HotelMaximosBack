import { AppError } from "../../shared/errors/app-error.js";
import {
  isValidCpfFormat,
  normalizeCpf,
  normalizeNullableText,
  normalizeRequiredText
} from "./hospedes.helpers.js";

export type HospedeAcompanhanteRecord = {
  id: number;
  hospedeResponsavelId: number;
  nomeCompleto: string;
  documento: string | null;
  menorDeIdade: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
};

export type HospedeResponsavelRecord = {
  id: number;
  nomeCompleto: string;
  cpf: string;
  cpfNormalizado: string;
  email: string;
  endereco: string;
  telefone: string;
  documento: string;
  empresa: string | null;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
  acompanhantes: HospedeAcompanhanteRecord[];
};

export type HospedeListRecord = Omit<HospedeResponsavelRecord, "acompanhantes"> & {
  acompanhantesCount: number;
};

export type AcompanhanteInput = {
  id?: number;
  nomeCompleto: string;
  documento?: string;
  menorDeIdade: boolean;
};

export type CreateHospedeInput = {
  nomeCompleto: string;
  cpf: string;
  email: string;
  endereco: string;
  telefone: string;
  documento: string;
  empresa?: string;
  acompanhantes?: AcompanhanteInput[];
};

export type UpdateHospedeInput = Partial<CreateHospedeInput>;

export type HospedesListInput = {
  page: number;
  pageSize: number;
  search?: string;
  cpf?: string;
  ativo?: boolean;
  sortField?: "nomeCompleto" | "cpf" | "email" | "criadoEm" | "atualizadoEm";
  sortOrder?: "asc" | "desc";
};

export type UpsertHospedePayload = Omit<HospedeResponsavelRecord, "id" | "criadoEm" | "atualizadoEm" | "acompanhantes"> & {
  acompanhantes: Array<Omit<HospedeAcompanhanteRecord, "id" | "hospedeResponsavelId" | "criadoEm" | "atualizadoEm"> & { id?: number }>;
};

export type HospedesRepository = {
  list(input: HospedesListInput): Promise<{ data: HospedeListRecord[]; total: number }>;
  findById(id: number): Promise<HospedeResponsavelRecord | null>;
  findByNormalizedCpf(cpfNormalizado: string): Promise<HospedeResponsavelRecord | null>;
  create(data: UpsertHospedePayload): Promise<HospedeResponsavelRecord>;
  update(id: number, data: UpsertHospedePayload): Promise<HospedeResponsavelRecord>;
  softDelete(id: number): Promise<void>;
};

export class HospedesService {
  constructor(private readonly repository: HospedesRepository) {}

  async list(input: HospedesListInput) {
    const { data, total } = await this.repository.list(input);

    return {
      data: data.map(toHospedeListItem),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.ceil(total / input.pageSize)
      }
    };
  }

  async getById(id: number) {
    const hospede = await this.repository.findById(id);

    if (!hospede) {
      throw hospedeNotFoundError();
    }

    return toHospedeResponse(hospede);
  }

  async create(input: CreateHospedeInput) {
    const payload = this.normalizePayload(input);
    await this.ensureCpfAvailable(payload.cpfNormalizado);

    return toHospedeResponse(await this.repository.create(payload));
  }

  async update(id: number, input: UpdateHospedeInput) {
    const current = await this.repository.findById(id);

    if (!current) {
      throw hospedeNotFoundError();
    }

    const payload = this.normalizePayload({
      nomeCompleto: input.nomeCompleto ?? current.nomeCompleto,
      cpf: input.cpf ?? current.cpf,
      email: input.email ?? current.email,
      endereco: input.endereco ?? current.endereco,
      telefone: input.telefone ?? current.telefone,
      documento: input.documento ?? current.documento,
      empresa: input.empresa ?? current.empresa ?? undefined,
      acompanhantes: input.acompanhantes ?? current.acompanhantes.map((acompanhante) => ({
        id: acompanhante.id,
        nomeCompleto: acompanhante.nomeCompleto,
        documento: acompanhante.documento ?? undefined,
        menorDeIdade: acompanhante.menorDeIdade
      })),
      ativo: current.ativo
    });

    await this.ensureCpfAvailable(payload.cpfNormalizado, id);

    return toHospedeResponse(await this.repository.update(id, payload));
  }

  async delete(id: number): Promise<void> {
    const current = await this.repository.findById(id);

    if (!current) {
      throw hospedeNotFoundError();
    }

    await this.repository.softDelete(id);
  }

  private normalizePayload(
    input: (CreateHospedeInput | UpdateHospedeInput) & { ativo?: boolean }
  ): UpsertHospedePayload {
    const cpfNormalizado = normalizeCpf(input.cpf ?? "");

    if (!isValidCpfFormat(cpfNormalizado)) {
      throw invalidCpfError();
    }

    const acompanhantes = (input.acompanhantes ?? []).map((acompanhante) => {
      const documento = normalizeNullableText(acompanhante.documento);

      if (!acompanhante.menorDeIdade && !documento) {
        throw invalidAcompanhanteError();
      }

      return {
        id: acompanhante.id,
        nomeCompleto: normalizeRequiredText(acompanhante.nomeCompleto),
        documento,
        menorDeIdade: acompanhante.menorDeIdade
      };
    });

    return {
      nomeCompleto: normalizeRequiredText(input.nomeCompleto ?? ""),
      cpf: cpfNormalizado,
      cpfNormalizado,
      email: normalizeRequiredText(input.email ?? "").toLowerCase(),
      endereco: normalizeRequiredText(input.endereco ?? ""),
      telefone: normalizeRequiredText(input.telefone ?? ""),
      documento: normalizeRequiredText(input.documento ?? ""),
      empresa: normalizeNullableText(input.empresa),
      ativo: input.ativo ?? true,
      acompanhantes
    };
  }

  private async ensureCpfAvailable(cpfNormalizado: string, currentId?: number) {
    const existing = await this.repository.findByNormalizedCpf(cpfNormalizado);

    if (existing && existing.id !== currentId) {
      throw duplicateCpfError();
    }
  }
}

export function toHospedeResponse(hospede: HospedeResponsavelRecord) {
  return {
    id: hospede.id,
    nomeCompleto: hospede.nomeCompleto,
    cpf: hospede.cpf,
    email: hospede.email,
    endereco: hospede.endereco,
    telefone: hospede.telefone,
    documento: hospede.documento,
    empresa: hospede.empresa,
    ativo: hospede.ativo,
    criadoEm: hospede.criadoEm,
    atualizadoEm: hospede.atualizadoEm,
    acompanhantes: hospede.acompanhantes.map((acompanhante) => ({
      id: acompanhante.id,
      nomeCompleto: acompanhante.nomeCompleto,
      documento: acompanhante.documento,
      menorDeIdade: acompanhante.menorDeIdade,
      criadoEm: acompanhante.criadoEm,
      atualizadoEm: acompanhante.atualizadoEm
    }))
  };
}

export function toHospedeListItem(hospede: HospedeListRecord) {
  return {
    id: hospede.id,
    nomeCompleto: hospede.nomeCompleto,
    cpf: hospede.cpf,
    email: hospede.email,
    endereco: hospede.endereco,
    telefone: hospede.telefone,
    documento: hospede.documento,
    empresa: hospede.empresa,
    ativo: hospede.ativo,
    criadoEm: hospede.criadoEm,
    atualizadoEm: hospede.atualizadoEm,
    acompanhantesCount: hospede.acompanhantesCount
  };
}

function hospedeNotFoundError(): AppError {
  return new AppError({
    code: "HOSPEDE_001",
    message: "Hospede nao encontrado.",
    statusCode: 404
  });
}

function duplicateCpfError(): AppError {
  return new AppError({
    code: "HOSPEDE_002",
    message: "Ja existe um hospede responsavel com este CPF.",
    statusCode: 409
  });
}

function invalidCpfError(): AppError {
  return new AppError({
    code: "HOSPEDE_003",
    message: "CPF invalido.",
    statusCode: 400
  });
}

function invalidAcompanhanteError(): AppError {
  return new AppError({
    code: "HOSPEDE_004",
    message: "Acompanhante maior de idade deve informar documento.",
    statusCode: 400
  });
}
