import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  HospedeAcompanhanteRecord,
  HospedeListRecord,
  HospedeResponsavelRecord,
  HospedesListInput,
  HospedesRepository,
  UpsertHospedePayload
} from "./hospedes.service.js";
import { normalizeCpf } from "./hospedes.helpers.js";

type HospedeResponsavelRow = Omit<HospedeResponsavelRecord, "acompanhantes">;

const SORT_FIELD_MAP: Record<
  NonNullable<HospedesListInput["sortField"]>,
  `"nomeCompleto"` | `"cpf"` | `"email"` | `"criadoEm"` | `"atualizadoEm"`
> = {
  nomeCompleto: `"nomeCompleto"`,
  cpf: `"cpf"`,
  email: `"email"`,
  criadoEm: `"criadoEm"`,
  atualizadoEm: `"atualizadoEm"`
};

export class PrismaHospedesRepository implements HospedesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(input: HospedesListInput): Promise<{ data: HospedeListRecord[]; total: number }> {
    const filters: Prisma.Sql[] = [];

    if (input.search?.trim()) {
      const search = `%${input.search.trim()}%`;
      filters.push(Prisma.sql`
        (
          hr."nomeCompleto" ILIKE ${search}
          OR hr."email" ILIKE ${search}
          OR hr."telefone" ILIKE ${search}
          OR hr."cpf" ILIKE ${search}
        )
      `);
    }

    if (input.cpf?.trim()) {
      filters.push(Prisma.sql`hr."cpfNormalizado" = ${normalizeCpf(input.cpf)}`);
    }

    if (input.ativo !== undefined) {
      filters.push(Prisma.sql`hr."ativo" = ${input.ativo}`);
    }

    const whereClause =
      filters.length > 0 ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}` : Prisma.empty;
    const orderField = SORT_FIELD_MAP[input.sortField ?? "criadoEm"];
    const orderDirection = input.sortOrder === "asc" ? Prisma.raw("ASC") : Prisma.raw("DESC");
    const offset = (input.page - 1) * input.pageSize;

    const data = await this.prisma.$queryRaw<Array<HospedeResponsavelRow & { acompanhantesCount: number }>>(
      Prisma.sql`
        SELECT
          hr.*,
          COUNT(ha.id)::int AS "acompanhantesCount"
        FROM "hospedes_responsaveis" hr
        LEFT JOIN "hospedes_acompanhantes" ha
          ON ha."hospedeResponsavelId" = hr.id
        ${whereClause}
        GROUP BY hr.id
        ORDER BY hr.${Prisma.raw(orderField)} ${orderDirection}
        LIMIT ${input.pageSize}
        OFFSET ${offset}
      `
    );

    const totalRows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "hospedes_responsaveis" hr
        ${whereClause}
      `
    );

    return {
      data,
      total: Number(totalRows[0]?.count ?? 0)
    };
  }

  async findById(id: number): Promise<HospedeResponsavelRecord | null> {
    const responsavel = await this.findResponsavelRowByClause(Prisma.sql`hr.id = ${id}`);

    if (!responsavel) {
      return null;
    }

    return {
      ...responsavel,
      acompanhantes: await this.findAcompanhantesByResponsavelId(id)
    };
  }

  async findByNormalizedCpf(cpfNormalizado: string): Promise<HospedeResponsavelRecord | null> {
    const responsavel = await this.findResponsavelRowByClause(
      Prisma.sql`hr."cpfNormalizado" = ${cpfNormalizado}`
    );

    if (!responsavel) {
      return null;
    }

    return {
      ...responsavel,
      acompanhantes: await this.findAcompanhantesByResponsavelId(responsavel.id)
    };
  }

  async create(data: UpsertHospedePayload): Promise<HospedeResponsavelRecord> {
    return this.prisma.$transaction(async (tx) => {
      const inserted = await tx.$queryRaw<Array<HospedeResponsavelRow>>(Prisma.sql`
        INSERT INTO "hospedes_responsaveis" (
          "nomeCompleto",
          "cpf",
          "cpfNormalizado",
          "email",
          "endereco",
          "telefone",
          "documento",
          "empresa",
          "ativo",
          "atualizadoEm"
        )
        VALUES (
          ${data.nomeCompleto},
          ${data.cpf},
          ${data.cpfNormalizado},
          ${data.email},
          ${data.endereco},
          ${data.telefone},
          ${data.documento},
          ${data.empresa},
          ${data.ativo},
          NOW()
        )
        RETURNING *
      `);

      const hospede = inserted[0];

      for (const acompanhante of data.acompanhantes) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "hospedes_acompanhantes" (
            "hospedeResponsavelId",
            "nomeCompleto",
            "documento",
            "menorDeIdade",
            "atualizadoEm"
          )
          VALUES (
            ${hospede.id},
            ${acompanhante.nomeCompleto},
            ${acompanhante.documento},
            ${acompanhante.menorDeIdade},
            NOW()
          )
        `);
      }

      return {
        ...hospede,
        acompanhantes: await this.findAcompanhantesByResponsavelId(hospede.id, tx)
      };
    });
  }

  async update(id: number, data: UpsertHospedePayload): Promise<HospedeResponsavelRecord> {
    return this.prisma.$transaction(async (tx) => {
      const updatedRows = await tx.$queryRaw<Array<HospedeResponsavelRow>>(Prisma.sql`
        UPDATE "hospedes_responsaveis"
        SET
          "nomeCompleto" = ${data.nomeCompleto},
          "cpf" = ${data.cpf},
          "cpfNormalizado" = ${data.cpfNormalizado},
          "email" = ${data.email},
          "endereco" = ${data.endereco},
          "telefone" = ${data.telefone},
          "documento" = ${data.documento},
          "empresa" = ${data.empresa},
          "ativo" = ${data.ativo},
          "atualizadoEm" = NOW()
        WHERE id = ${id}
        RETURNING *
      `);

      const existingAcompanhantes = await this.findAcompanhantesByResponsavelId(id, tx);
      const nextIds = new Set(data.acompanhantes.flatMap((item) => (item.id ? [item.id] : [])));
      const acompanhantesToDelete = existingAcompanhantes.filter((item) => !nextIds.has(item.id));

      if (acompanhantesToDelete.length > 0) {
        await tx.$executeRaw(Prisma.sql`
          DELETE FROM "hospedes_acompanhantes"
          WHERE "hospedeResponsavelId" = ${id}
            AND id IN (${Prisma.join(acompanhantesToDelete.map((item) => item.id))})
        `);
      }

      for (const acompanhante of data.acompanhantes) {
        if (acompanhante.id) {
          await tx.$executeRaw(Prisma.sql`
            UPDATE "hospedes_acompanhantes"
            SET
              "nomeCompleto" = ${acompanhante.nomeCompleto},
              "documento" = ${acompanhante.documento},
              "menorDeIdade" = ${acompanhante.menorDeIdade},
              "atualizadoEm" = NOW()
            WHERE id = ${acompanhante.id}
              AND "hospedeResponsavelId" = ${id}
          `);
          continue;
        }

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "hospedes_acompanhantes" (
            "hospedeResponsavelId",
            "nomeCompleto",
            "documento",
            "menorDeIdade",
            "atualizadoEm"
          )
          VALUES (
            ${id},
            ${acompanhante.nomeCompleto},
            ${acompanhante.documento},
            ${acompanhante.menorDeIdade},
            NOW()
          )
        `);
      }

      return {
        ...updatedRows[0],
        acompanhantes: await this.findAcompanhantesByResponsavelId(id, tx)
      };
    });
  }

  async softDelete(id: number): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "hospedes_responsaveis"
      SET
        "ativo" = false,
        "atualizadoEm" = NOW()
      WHERE id = ${id}
    `);
  }

  private async findResponsavelRowByClause(where: Prisma.Sql): Promise<HospedeResponsavelRow | null> {
    const rows = await this.prisma.$queryRaw<Array<HospedeResponsavelRow>>(Prisma.sql`
      SELECT hr.*
      FROM "hospedes_responsaveis" hr
      WHERE ${where}
      LIMIT 1
    `);

    return rows[0] ?? null;
  }

  private async findAcompanhantesByResponsavelId(
    hospedeResponsavelId: number,
    client: PrismaClient | Prisma.TransactionClient = this.prisma
  ): Promise<HospedeAcompanhanteRecord[]> {
    return client.$queryRaw<Array<HospedeAcompanhanteRecord>>(Prisma.sql`
      SELECT *
      FROM "hospedes_acompanhantes"
      WHERE "hospedeResponsavelId" = ${hospedeResponsavelId}
      ORDER BY id ASC
    `);
  }
}
