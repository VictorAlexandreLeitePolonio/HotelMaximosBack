# Sprint 9: Limpezas

## Objetivo

Entregar o backend operacional do modulo de limpezas semanais e de checkout, com geracao consistente, atraso por regra de negocio e conclusao manual pela recepcao.

## Escopo tecnico

- Gerar limpezas semanais para flats com estadia ativa nas janelas operacionais de sexta e sabado.
- Gerar limpeza de checkout para a estadia encerrada no momento do checkout.
- Marcar limpezas semanais como atrasadas a partir de domingo 00:00 no timezone `America/Sao_Paulo`.
- Marcar limpezas de checkout como atrasadas apos 24h da geracao.
- Expor listagem operacional de limpezas.
- Permitir conclusao manual de limpeza por `Admin` ou `Recepcionista`.
- Devolver o flat para `Livre` apos conclusao de limpeza de checkout, preservando a ocupacao nas limpezas semanais.

## Regras de negocio

1. Limpeza semanal so pode ser gerada para estadia com status `Ativa`.
2. Sexta e sabado geram registros independentes de limpeza semanal.
3. O atraso semanal usa a virada para domingo em `America/Sao_Paulo`, nao apenas `UTC`.
4. Limpeza de checkout nasce no mesmo fluxo transacional que encerra a estadia e move o flat para `AguardandoLimpeza`.
5. Limpezas abertas em flat com status `Manutencao` ficam `Suspensa` enquanto a manutencao estiver vigente.
6. Limpeza `Suspensa` nao pode ser concluida manualmente nesta sprint.
7. Concluir limpeza de checkout devolve o flat para `Livre` quando ele ainda estiver em `AguardandoLimpeza`.
8. Concluir limpeza semanal nao altera um flat ocupado.

## Contratos planejados

### GET `/api/limpezas`

Lista limpezas operacionais.

Query params:

```json
{
  "page": 1,
  "pageSize": 10,
  "tipo": "Semanal",
  "status": "Pendente",
  "flatId": 101,
  "sortOrder": "desc"
}
```

### POST `/api/limpezas/:id/concluir`

Conclui manualmente uma limpeza.

Body:

```json
{
  "observacoes": "Limpeza concluida e flat liberado."
}
```

## Decisoes tecnicas

- O backend nao depende de scheduler nesta sprint: a sincronizacao operacional das limpezas acontece ao consultar ou concluir o modulo.
- Limpeza de checkout e criada diretamente no fluxo da Sprint 8 para manter o contrato entre checkout e bloqueio do flat.
- A identificacao idempotente de cada limpeza usa `chaveGeracao`, evitando duplicidade entre sincronizacoes.
- O modelo persiste `dataProgramada`, `atrasaEm`, `concluidaEm` e `status` para permitir rastreabilidade operacional simples sem criar um submodulo de agenda.
