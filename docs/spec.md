# Sprint 10: Manutencao e bloqueios

## Objetivo

Entregar o backend operacional do bloqueio de flats em manutencao, com reflexo imediato em reservas pendentes, limpezas abertas e historico automatico do flat.

## Escopo tecnico

- Bloquear manualmente um flat em manutencao por endpoint dedicado.
- Liberar manualmente a manutencao com restauracao do fluxo operacional coerente.
- Impedir que o endpoint generico de status burle as regras da sprint ao entrar ou sair de `Manutencao`.
- Bloquear novas reservas e check-ins em flat em manutencao pelo contrato ja existente dos modulos operacionais.
- Marcar reservas pendentes afetadas como `RequerRealocacao`.
- Suspender limpezas abertas do flat enquanto a manutencao estiver vigente.
- Reativar limpezas suspensas para `Pendente` ou `Atrasada` quando a manutencao for liberada.
- Registrar historico automatico de inicio e liberacao da manutencao.

## Regras de negocio

1. A abertura de manutencao e manual e muda imediatamente o `statusOperacional` do flat para `Manutencao`.
2. Nao e permitido iniciar manutencao em flat com estadia ativa.
3. Reservas afetadas sao as reservas do flat ainda sem check-in, com status `Confirmada` e `dataFim` futura no momento da abertura da manutencao.
4. Toda reserva afetada passa para `RequerRealocacao` e deixa de ser elegivel para check-in direto a partir daquele contrato.
5. Limpezas abertas do flat ficam `Suspensa` enquanto o flat permanecer em manutencao.
6. Ao liberar manutencao, a limpeza aberta volta para `Pendente` ou `Atrasada` conforme `atrasaEm`; se existir limpeza de checkout aberta, o flat volta para `AguardandoLimpeza`.
7. Ao liberar manutencao sem limpeza de checkout aberta, o flat volta para `Livre`.
8. Toda abertura e toda liberacao de manutencao precisam deixar trilha em `historicos_flat`.

## Contratos planejados

### POST `/api/flats/:id/manutencao`

Inicia manutencao do flat.

Body:

```json
{
  "motivo": "Troca de chuveiro e revisao eletrica.",
  "observacoes": "Nao liberar para reserva ate a vistoria final."
}
```

Response:

```json
{
  "flat": {
    "id": 12,
    "numero": "203",
    "statusOperacional": "Manutencao"
  },
  "reservasAfetadas": [
    {
      "id": 88,
      "status": "RequerRealocacao"
    }
  ],
  "limpezasAfetadas": [
    {
      "id": 14,
      "status": "Suspensa"
    }
  ]
}
```

### POST `/api/flats/:id/manutencao/liberar`

Libera a manutencao do flat.

Body:

```json
{
  "observacoes": "Servico concluido e flat liberado para operacao."
}
```

Response:

```json
{
  "flat": {
    "id": 12,
    "numero": "203",
    "statusOperacional": "Livre"
  },
  "reservasAfetadas": [],
  "limpezasAfetadas": [
    {
      "id": 14,
      "status": "Atrasada"
    }
  ]
}
```

## Decisoes tecnicas

- O modulo aproveita a estrutura existente de `flats`, `reservas`, `limpezas` e `historicos_flat`, sem criar uma camada paralela de manutencao.
- A sinalizacao `RequerRealocacao` vive no enum `StatusReserva` para ficar visivel para os consumidores do modulo de reservas.
- A trilha auditavel da manutencao usa novos tipos de historico do flat, preservando o padrao que ja existe para check-in, checkout, transferencia e renovacao.
- A reativacao das limpezas e calculada no momento da liberacao, sem scheduler adicional.
