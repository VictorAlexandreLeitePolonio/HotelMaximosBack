# Sprint 11: Dashboards, avisos e auditoria

## Objetivo

Entregar o backend da Sprint 11 com visao operacional, visao financeira, avisos acionaveis, `NoShow` manual e trilha auditavel para eventos operacionais e observacoes administrativas do flat.

## Escopo tecnico

- Expor um Dashboard Operacional para consumo com polling de 30 segundos no frontend.
- Expor um Dashboard Financeiro restrito a `Admin`.
- Gerar avisos de limpeza, vencimento de estadia e check-in atrasado.
- Permitir a acao manual de `NoShow` sem automacao silenciosa.
- Permitir observacoes operacionais imutaveis no historico do flat.
- Permitir correcoes e cancelamentos administrativos auditaveis sobre observacoes operacionais.
- Expor listagem paginada do historico do flat para consulta operacional.

## Regras de negocio

1. O Dashboard Operacional e somente leitura no backend; o polling de 30 segundos e responsabilidade do frontend.
2. Aviso de check-in atrasado considera reservas `Confirmada`, ainda sem estadia vinculada, com `dataInicio` anterior ao inicio do dia operacional em `America/Sao_Paulo`.
3. Aviso de vencimento considera estadias `Ativa` cuja `dataFimPrevista` ja venceu ou vence em ate 3 dias corridos, contando a partir da data operacional de referencia.
4. Aviso de limpeza considera limpezas abertas: `Atrasada` gera severidade critica, `Pendente` e `Suspensa` permanecem avisos operacionais.
5. A reserva so pode virar `NoShow` manualmente quando ainda estiver `Confirmada`, sem estadia vinculada, e ja configurar check-in atrasado pela regra da sprint.
6. A acao de `NoShow` exige `motivo` e gera entrada automatica em `historicos_flat`.
7. Observacao operacional de recepcao nao e editada nem excluida em linha; ela nasce como evento imutavel em `historicos_flat`.
8. Correcao ou cancelamento administrativo nao reescreve a observacao original; cria novo evento auditavel com referencia explicita ao historico original.
9. Correcao e cancelamento administrativo exigem `motivo` e ficam restritos a `Admin`.
10. O Dashboard Financeiro fica restrito a `Admin` e usa os modulos ja existentes de `cobrancas`, `extras`, `pagamentos` e `caixas`, sem criar consolidacao paralela.

## Contratos planejados

### GET `/api/dashboards/operacional`

Retorna o resumo operacional e os avisos ativos para o momento da consulta.

Response:

```json
{
  "generatedAt": "2026-05-21T12:00:00.000Z",
  "resumo": {
    "flatsPorStatus": {
      "Livre": 18,
      "Reservado": 4,
      "Ocupado": 21,
      "AguardandoLimpeza": 3,
      "Manutencao": 2
    },
    "estadiasAtivas": 21,
    "checkInsHoje": 5,
    "checkInsAtrasados": 2,
    "reservasRequerRealocacao": 1,
    "limpezasAbertas": 4
  },
  "avisos": [
    {
      "tipo": "CheckInAtrasado",
      "severidade": "warning",
      "titulo": "Check-in atrasado para a reserva 91",
      "descricao": "Reserva do flat 203 aguardando acao manual da recepcao.",
      "referencia": {
        "flatId": 12,
        "reservaId": 91,
        "estadiaId": null,
        "limpezaId": null
      },
      "ocorridoEm": "2026-05-20T15:00:00.000Z"
    }
  ]
}
```

### GET `/api/dashboards/financeiro`

Retorna o resumo financeiro administrativo do dia operacional.

Response:

```json
{
  "generatedAt": "2026-05-21T12:00:00.000Z",
  "resumo": {
    "totalCobrancasPendentes": 6,
    "valorCobrancasPendentes": 7420,
    "totalExtrasPendentes": 3,
    "valorExtrasPendentes": 280,
    "totalPagamentosHoje": 9,
    "valorPagamentosHoje": 3910,
    "totalCaixasAbertos": 2,
    "totalCaixasFechadosHoje": 1
  },
  "pagamentosHojePorForma": [
    {
      "formaPagamento": "Pix",
      "quantidade": 4,
      "valor": 1820
    }
  ]
}
```

### POST `/api/reservas/:id/no-show`

Marca manualmente uma reserva atrasada como `NoShow`.

Body:

```json
{
  "motivo": "Hospede confirmou que nao viria mais.",
  "observacoes": "Contato realizado pela recepcao as 09:15."
}
```

Response:

```json
{
  "reserva": {
    "id": 91,
    "status": "NoShow"
  },
  "historico": {
    "tipo": "NoShowManual",
    "descricao": "Reserva marcada manualmente como no-show.",
    "flatId": 12
  }
}
```

### GET `/api/flats/:id/historico`

Lista paginada do historico operacional e auditavel do flat.

### POST `/api/flats/:id/observacoes-operacionais`

Cria uma observacao operacional imutavel no historico do flat.

Body:

```json
{
  "descricao": "Hospede pediu contato com manutencao se o ar parar novamente.",
  "observacoes": "Recado registrado durante a ronda da tarde."
}
```

### POST `/api/flats/:id/observacoes-operacionais/:historicoId/corrigir`

Cria uma correcao administrativa auditavel para uma observacao operacional existente.

Body:

```json
{
  "descricaoCorrigida": "Hospede pediu contato com manutencao apenas se o ar parar novamente durante a noite.",
  "motivo": "Complemento necessario apos revisar o relato da recepcao.",
  "observacoes": "Correcao autorizada pela administracao."
}
```

### POST `/api/flats/:id/observacoes-operacionais/:historicoId/cancelar`

Cancela administrativamente uma observacao operacional por meio de novo evento auditavel.

Body:

```json
{
  "motivo": "Observacao registrada no flat errado.",
  "observacoes": "Recado sera relancado no flat correto."
}
```

## Decisoes tecnicas

- O modulo reaproveita `flats`, `reservas`, `estadias`, `limpezas`, `financeiro`, `caixas` e `historicos_flat`, sem criar uma camada paralela de auditoria.
- O `Dashboard Operacional` agrega leituras prontas para o frontend, mas nao move estado sozinho.
- O `NoShow` manual altera apenas a reserva alvo e registra o evento em `historicos_flat`.
- Observacoes operacionais, correcoes e cancelamentos administrativos usam novos tipos de historico para manter o fluxo append-only.
- O dia operacional e calculado no timezone `America/Sao_Paulo` para avisos e totais diarios do dashboard.
