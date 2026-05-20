import { describe, expect, it, vi } from "vitest";
import type { AuthUserRecord } from "../auth/auth.service.js";
import {
  FlatsService,
  type FlatMaintenanceCleaningRecord,
  type FlatMaintenanceReservationRecord,
  type FlatRecord,
  type FlatsRepository
} from "./flats.service.js";

const baseUser: AuthUserRecord = {
  id: 7,
  login: "admin",
  loginNormalizado: "admin",
  nomeCompleto: "Administrador",
  email: "admin@hotelmaximos.test",
  senhaHash: "hash",
  perfil: "Admin",
  ativo: true,
  deveAlterarSenha: false
};

function makeFlat(statusOperacional: FlatRecord["statusOperacional"]): FlatRecord {
  return {
    id: 12,
    numero: "203",
    numeroNormalizado: "203",
    categoriaId: 1,
    subcategoriaId: 2,
    categoria: {
      id: 1,
      nome: "Luxo",
      ativo: true
    },
    subcategoria: {
      id: 2,
      categoriaId: 1,
      nome: "Suite",
      precoBase: 320,
      capacidadeMaxima: 3,
      ativo: true
    },
    statusOperacional,
    ativo: true,
    criadoEm: new Date("2026-05-20T00:00:00.000Z"),
    atualizadoEm: new Date("2026-05-20T00:00:00.000Z")
  };
}

function createRepositoryMock(): FlatsRepository {
  return {
    list: vi.fn(),
    findById: vi.fn(),
    findByNormalizedNumber: vi.fn(),
    findCategoryById: vi.fn(),
    findSubcategoryById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    hasFutureReservation: vi.fn(),
    listPendingReservationsForMaintenance: vi.fn(),
    listOpenCleaningsForFlat: vi.fn(),
    startMaintenance: vi.fn(),
    releaseMaintenance: vi.fn()
  };
}

describe("FlatsService maintenance flow", () => {
  it("starts maintenance, marks reservations for relocation and suspends open cleanings", async () => {
    const repository = createRepositoryMock();
    const service = new FlatsService(repository);
    const affectedReservations: FlatMaintenanceReservationRecord[] = [{ id: 88, status: "Confirmada" }];
    const openCleanings: FlatMaintenanceCleaningRecord[] = [
      {
        id: 14,
        tipo: "Checkout",
        status: "Pendente",
        atrasaEm: new Date("2026-05-20T18:00:00.000Z"),
        concluidaEm: null
      }
    ];

    vi.mocked(repository.findById).mockResolvedValue(makeFlat("Livre"));
    vi.mocked(repository.listPendingReservationsForMaintenance).mockResolvedValue(affectedReservations);
    vi.mocked(repository.listOpenCleaningsForFlat).mockResolvedValue(openCleanings);
    vi.mocked(repository.startMaintenance).mockResolvedValue(makeFlat("Manutencao"));

    const result = await service.startMaintenance(
      12,
      baseUser,
      {
        motivo: " Troca do chuveiro ",
        observacoes: " Revisar lampada "
      },
      new Date("2026-05-20T12:00:00.000Z")
    );

    expect(result.flat.statusOperacional).toBe("Manutencao");
    expect(result.reservasAfetadas).toEqual([{ id: 88, status: "RequerRealocacao" }]);
    expect(result.limpezasAfetadas).toEqual([{ id: 14, status: "Suspensa" }]);
    expect(repository.startMaintenance).toHaveBeenCalledWith(
      expect.objectContaining({
        flatId: 12,
        statusAnterior: "Livre",
        motivo: "Troca do chuveiro",
        observacoes: "Revisar lampada"
      })
    );
  });

  it("blocks maintenance for occupied flats", async () => {
    const repository = createRepositoryMock();
    const service = new FlatsService(repository);

    vi.mocked(repository.findById).mockResolvedValue(makeFlat("Ocupado"));

    await expect(
      service.startMaintenance(12, baseUser, { motivo: "Troca emergencial" })
    ).rejects.toMatchObject({
      code: "FLAT_009"
    });
  });

  it("requires the dedicated maintenance route for manual status changes", async () => {
    const repository = createRepositoryMock();
    const service = new FlatsService(repository);

    vi.mocked(repository.findById).mockResolvedValue(makeFlat("Livre"));

    await expect(service.updateStatus(12, "Manutencao")).rejects.toMatchObject({
      code: "FLAT_007"
    });
  });

  it("releases maintenance and restores checkout cleanings to the proper operational state", async () => {
    const repository = createRepositoryMock();
    const service = new FlatsService(repository);
    const now = new Date("2026-05-22T10:00:00.000Z");
    const openCleanings: FlatMaintenanceCleaningRecord[] = [
      {
        id: 14,
        tipo: "Checkout",
        status: "Suspensa",
        atrasaEm: new Date("2026-05-21T10:00:00.000Z"),
        concluidaEm: null
      }
    ];

    vi.mocked(repository.findById).mockResolvedValue(makeFlat("Manutencao"));
    vi.mocked(repository.listOpenCleaningsForFlat).mockResolvedValue(openCleanings);
    vi.mocked(repository.releaseMaintenance).mockResolvedValue(makeFlat("AguardandoLimpeza"));

    const result = await service.releaseMaintenance(
      12,
      baseUser,
      {
        observacoes: " Servico concluido "
      },
      now
    );

    expect(result.flat.statusOperacional).toBe("AguardandoLimpeza");
    expect(result.limpezasAfetadas).toEqual([{ id: 14, status: "Atrasada" }]);
    expect(repository.releaseMaintenance).toHaveBeenCalledWith(
      expect.objectContaining({
        flatId: 12,
        statusSeguinte: "AguardandoLimpeza",
        observacoes: "Servico concluido",
        limpezasAfetadas: [{ id: 14, status: "Atrasada" }]
      })
    );
  });
});
