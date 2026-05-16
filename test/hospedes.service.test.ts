import { describe, expect, it } from "vitest";
import {
  HospedesService,
  type HospedeListRecord,
  type HospedeResponsavelRecord,
  type HospedesRepository
} from "../src/modules/hospedes/hospedes.service.js";

class FakeHospedesRepository implements HospedesRepository {
  hospedes: HospedeResponsavelRecord[] = [];

  async list() {
    const data: HospedeListRecord[] = this.hospedes.map((item) => ({
      id: item.id,
      nomeCompleto: item.nomeCompleto,
      cpf: item.cpf,
      cpfNormalizado: item.cpfNormalizado,
      email: item.email,
      endereco: item.endereco,
      telefone: item.telefone,
      documento: item.documento,
      empresa: item.empresa,
      ativo: item.ativo,
      criadoEm: item.criadoEm,
      atualizadoEm: item.atualizadoEm,
      acompanhantesCount: item.acompanhantes.length
    }));

    return {
      data,
      total: data.length
    };
  }

  async findById(id: number) {
    return this.hospedes.find((item) => item.id === id) ?? null;
  }

  async findByNormalizedCpf(cpfNormalizado: string) {
    return this.hospedes.find((item) => item.cpfNormalizado === cpfNormalizado) ?? null;
  }

  async create(data: Parameters<HospedesRepository["create"]>[0]) {
    const hospede: HospedeResponsavelRecord = {
      id: this.hospedes.length + 1,
      nomeCompleto: data.nomeCompleto,
      cpf: data.cpf,
      cpfNormalizado: data.cpfNormalizado,
      email: data.email,
      endereco: data.endereco,
      telefone: data.telefone,
      documento: data.documento,
      empresa: data.empresa,
      ativo: data.ativo,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
      acompanhantes: data.acompanhantes.map((acompanhante, index) => ({
        id: index + 1,
        hospedeResponsavelId: this.hospedes.length + 1,
        nomeCompleto: acompanhante.nomeCompleto,
        documento: acompanhante.documento ?? null,
        menorDeIdade: acompanhante.menorDeIdade,
        criadoEm: new Date(),
        atualizadoEm: new Date()
      }))
    };

    this.hospedes.push(hospede);
    return hospede;
  }

  async update(id: number, data: Parameters<HospedesRepository["update"]>[1]) {
    const hospede = await this.findById(id);

    if (!hospede) {
      throw new Error("Hospede fake nao encontrado.");
    }

    hospede.nomeCompleto = data.nomeCompleto;
    hospede.cpf = data.cpf;
    hospede.cpfNormalizado = data.cpfNormalizado;
    hospede.email = data.email;
    hospede.endereco = data.endereco;
    hospede.telefone = data.telefone;
    hospede.documento = data.documento;
    hospede.empresa = data.empresa;
    hospede.ativo = data.ativo;
    hospede.atualizadoEm = new Date();
    hospede.acompanhantes = data.acompanhantes.map((acompanhante, index) => ({
      id: acompanhante.id ?? index + 1,
      hospedeResponsavelId: id,
      nomeCompleto: acompanhante.nomeCompleto,
      documento: acompanhante.documento ?? null,
      menorDeIdade: acompanhante.menorDeIdade,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    }));

    return hospede;
  }

  async softDelete(id: number) {
    const hospede = await this.findById(id);

    if (!hospede) {
      throw new Error("Hospede fake nao encontrado.");
    }

    hospede.ativo = false;
  }
}

function createHospede(overrides: Partial<HospedeResponsavelRecord> = {}): HospedeResponsavelRecord {
  return {
    id: 1,
    nomeCompleto: "Maria Silva",
    cpf: "12345678901",
    cpfNormalizado: "12345678901",
    email: "maria@hotel.com",
    endereco: "Rua A, 100",
    telefone: "11999999999",
    documento: "RG123456",
    empresa: null,
    ativo: true,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    acompanhantes: [],
    ...overrides
  };
}

describe("HospedesService", () => {
  it("creates responsible guests with normalized CPF and nested acompanhantes", async () => {
    const repository = new FakeHospedesRepository();
    const result = await new HospedesService(repository).create({
      nomeCompleto: " Maria Silva ",
      cpf: "123.456.789-01",
      email: "MARIA@HOTEL.COM",
      endereco: " Rua A, 100 ",
      telefone: " (11) 99999-9999 ",
      documento: " RG123456 ",
      acompanhantes: [
        {
          nomeCompleto: "Filho Silva",
          menorDeIdade: true
        }
      ]
    });

    expect(result).toMatchObject({
      nomeCompleto: "Maria Silva",
      cpf: "12345678901",
      email: "maria@hotel.com",
      endereco: "Rua A, 100",
      telefone: "(11) 99999-9999",
      documento: "RG123456",
      ativo: true
    });
    expect(result.acompanhantes).toHaveLength(1);
    expect(result.acompanhantes[0]).toMatchObject({
      nomeCompleto: "Filho Silva",
      documento: null,
      menorDeIdade: true
    });
  });

  it("rejects duplicate responsible CPF with HOSPEDE_002", async () => {
    const repository = new FakeHospedesRepository();
    repository.hospedes.push(createHospede());

    await expect(
      new HospedesService(repository).create({
        nomeCompleto: "Outra Maria",
        cpf: "123.456.789-01",
        email: "outra@hotel.com",
        endereco: "Rua B, 200",
        telefone: "11988888888",
        documento: "RG654321"
      })
    ).rejects.toMatchObject({
      code: "HOSPEDE_002",
      statusCode: 409
    });
  });

  it("rejects adult acompanhante without document with HOSPEDE_004", async () => {
    const repository = new FakeHospedesRepository();

    await expect(
      new HospedesService(repository).create({
        nomeCompleto: "Maria Silva",
        cpf: "12345678901",
        email: "maria@hotel.com",
        endereco: "Rua A, 100",
        telefone: "11999999999",
        documento: "RG123456",
        acompanhantes: [
          {
            nomeCompleto: "Adulto Sem Documento",
            menorDeIdade: false
          }
        ]
      })
    ).rejects.toMatchObject({
      code: "HOSPEDE_004",
      statusCode: 400
    });
  });

  it("updates responsible guests and replaces acompanhantes payload", async () => {
    const repository = new FakeHospedesRepository();
    repository.hospedes.push(
      createHospede({
        acompanhantes: [
          {
            id: 1,
            hospedeResponsavelId: 1,
            nomeCompleto: "Filho Silva",
            documento: null,
            menorDeIdade: true,
            criadoEm: new Date(),
            atualizadoEm: new Date()
          }
        ]
      })
    );

    const result = await new HospedesService(repository).update(1, {
      telefone: "1133334444",
      acompanhantes: [
        {
          id: 1,
          nomeCompleto: "Filho Silva Atualizado",
          menorDeIdade: true
        },
        {
          nomeCompleto: "Adulto Silva",
          documento: "RG998877",
          menorDeIdade: false
        }
      ]
    });

    expect(result.telefone).toBe("1133334444");
    expect(result.acompanhantes).toHaveLength(2);
    expect(result.acompanhantes[0].nomeCompleto).toBe("Filho Silva Atualizado");
    expect(result.acompanhantes[1]).toMatchObject({
      nomeCompleto: "Adulto Silva",
      documento: "RG998877",
      menorDeIdade: false
    });
  });

  it("soft deletes responsible guests", async () => {
    const repository = new FakeHospedesRepository();
    repository.hospedes.push(createHospede());

    await new HospedesService(repository).delete(1);

    expect(repository.hospedes[0].ativo).toBe(false);
  });
});
