import { describe, expect, it, vi } from "vitest";
import type { AuthUserRecord } from "../auth/auth.service.js";
import {
  DashboardsService,
  type DashboardCleaningWarningRecord,
  type DashboardOperationalSnapshot,
  type DashboardReservationWarningRecord,
  type DashboardStayWarningRecord,
  type DashboardsRepository,
  type FlatHistoryRecord,
  type FlatSummaryRecord,
  type ReservationNoShowRecord
} from "./dashboards.service.js";

const adminUser: AuthUserRecord = {
  id: 1,
  login: "admin",
  loginNormalizado: "admin",
  nomeCompleto: "Administrador",
  email: "admin@hotelmaximos.test",
  senhaHash: "hash",
  perfil: "Admin",
  ativo: true,
  deveAlterarSenha: false
};

function createRepositoryMock(): DashboardsRepository {
  return {
    loadOperationalSnapshot: vi.fn(),
    loadFinancialSnapshot: vi.fn(),
    findReservationForNoShow: vi.fn(),
    markReservationAsNoShow: vi.fn(),
    findFlatById: vi.fn(),
    listFlatHistory: vi.fn(),
    createOperationalObservation: vi.fn(),
    findFlatHistoryEntry: vi.fn(),
    createOperationalObservationCorrection: vi.fn(),
    createOperationalObservationCancellation: vi.fn()
  };
}

function makeHistory(type: FlatHistoryRecord["tipo"]): FlatHistoryRecord {
  return {
    id: 10,
    flatId: 4,
    estadiaId: null,
    usuario: {
      id: 1,
      login: "admin",
      nomeCompleto: "Administrador",
      perfil: "Admin"
    },
    tipo: type,
    descricao: "Historico",
    metadata: null,
    criadoEm: new Date("2026-05-21T12:00:00.000Z")
  };
}

function makeFlat(): FlatSummaryRecord {
  return {
    id: 4,
    numero: "203",
    statusOperacional: "Livre"
  };
}

describe("DashboardsService", () => {
  it("marks an overdue reservation as no-show and records audit history", async () => {
    const repository = createRepositoryMock();
    const service = new DashboardsService(repository);
    const reservation: ReservationNoShowRecord = {
      id: 91,
      flatId: 4,
      status: "Confirmada",
      dataInicio: new Date("2026-05-20T12:00:00.000Z"),
      dataFim: new Date("2026-05-25T12:00:00.000Z"),
      estadiaId: null
    };

    vi.mocked(repository.findReservationForNoShow).mockResolvedValue(reservation);
    vi.mocked(repository.markReservationAsNoShow).mockResolvedValue({
      reserva: {
        ...reservation,
        status: "NoShow"
      },
      historico: makeHistory("NoShowManual")
    });

    const result = await service.markReservationAsNoShow(
      91,
      adminUser,
      {
        motivo: " Hospede desistiu ",
        observacoes: " Ligacao registrada "
      },
      new Date("2026-05-21T12:00:00.000Z")
    );

    expect(result.reserva.status).toBe("NoShow");
    expect(result.historico.tipo).toBe("NoShowManual");
    expect(repository.markReservationAsNoShow).toHaveBeenCalledWith(
      expect.objectContaining({
        motivo: "Hospede desistiu",
        observacoes: "Ligacao registrada"
      })
    );
  });

  it("blocks no-show for reservations that are not overdue yet", async () => {
    const repository = createRepositoryMock();
    const service = new DashboardsService(repository);

    vi.mocked(repository.findReservationForNoShow).mockResolvedValue({
      id: 91,
      flatId: 4,
      status: "Confirmada",
      dataInicio: new Date("2026-05-21T15:00:00.000Z"),
      dataFim: new Date("2026-05-25T12:00:00.000Z"),
      estadiaId: null
    });

    await expect(
      service.markReservationAsNoShow(
        91,
        adminUser,
        {
          motivo: "Nao compareceu"
        },
        new Date("2026-05-21T12:00:00.000Z")
      )
    ).rejects.toMatchObject({
      code: "DASH_003"
    });
  });

  it("rejects administrative correction when the target is not an operational observation", async () => {
    const repository = createRepositoryMock();
    const service = new DashboardsService(repository);

    vi.mocked(repository.findFlatById).mockResolvedValue(makeFlat());
    vi.mocked(repository.findFlatHistoryEntry).mockResolvedValue(makeHistory("ManutencaoIniciada"));

    await expect(
      service.correctOperationalObservation(
        4,
        10,
        adminUser,
        {
          descricaoCorrigida: "Texto corrigido",
          motivo: "Ajuste"
        }
      )
    ).rejects.toMatchObject({
      code: "DASH_006"
    });
  });

  it("builds operational alerts with critical severity for overdue stays and cleanings", async () => {
    const repository = createRepositoryMock();
    const service = new DashboardsService(repository);
    const overdueCheckIn: DashboardReservationWarningRecord = {
      reservaId: 91,
      flatId: 4,
      flatNumero: "203",
      hospedeResponsavelNome: "Maria",
      dataInicio: new Date("2026-05-20T15:00:00.000Z")
    };
    const overdueStay: DashboardStayWarningRecord = {
      estadiaId: 33,
      flatId: 4,
      flatNumero: "203",
      hospedeResponsavelNome: "Joao",
      dataFimPrevista: new Date("2026-05-21T10:00:00.000Z")
    };
    const overdueCleaning: DashboardCleaningWarningRecord = {
      limpezaId: 14,
      flatId: 4,
      flatNumero: "203",
      tipo: "Checkout",
      status: "Atrasada",
      dataProgramada: new Date("2026-05-20T10:00:00.000Z"),
      atrasaEm: new Date("2026-05-21T08:00:00.000Z")
    };
    const snapshot: DashboardOperationalSnapshot = {
      flatsPorStatus: {
        Livre: 1,
        Ocupado: 2
      },
      estadiasAtivas: 2,
      checkInsHoje: 1,
      reservasRequerRealocacao: 0,
      limpezasAbertas: 1,
      checkInsAtrasados: [overdueCheckIn],
      estadiasVencendo: [overdueStay],
      limpezasComAviso: [overdueCleaning]
    };

    vi.mocked(repository.loadOperationalSnapshot).mockResolvedValue(snapshot);

    const result = await service.getOperationalDashboard(new Date("2026-05-21T12:00:00.000Z"));

    expect(result.resumo.checkInsAtrasados).toBe(1);
    expect(result.avisos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipo: "EstadiaVencida",
          severidade: "critical"
        }),
        expect.objectContaining({
          tipo: "LimpezaAtrasada",
          severidade: "critical"
        }),
        expect.objectContaining({
          tipo: "CheckInAtrasado",
          severidade: "warning"
        })
      ])
    );
  });
});
