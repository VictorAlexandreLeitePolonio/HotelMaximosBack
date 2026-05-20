# Sprint 07 - Caixa

## Objetivo

Formalizar a modelagem técnica da Sprint 7 e implementar o backend de abertura, operação, fechamento e ajuste administrativo de caixa por usuário, reaproveitando `Pagamento` como fonte de verdade operacional.

## Decisões de modelagem

- `Caixa` continua sendo a unidade operacional vinculada a um único usuário, mas passa a registrar `turno`, `valoresConferidos`, `resumoCalculado` e `observacoesFechamento`.
- O sistema não cria uma modelagem paralela de lançamentos para o caixa: o resumo do fechamento nasce exclusivamente dos `Pagamento`s já vinculados ao `caixaId`.
- O fechamento salva snapshots JSON do resumo calculado e dos valores conferidos por forma de pagamento para preservar a conferência original, mesmo após ajustes administrativos futuros.
- `AjusteCaixa` nasce como entidade própria, sempre vinculada a um `Caixa` fechado e a um `Usuario` Admin, com `motivo`, `observacoes` e impacto por forma de pagamento.
- O ajuste administrativo nunca altera `Pagamento` nem reescreve o fechamento original; ele apenas compõe o resumo final auditável.
- O PDF de fechamento passa a ser gerado no backend sem dependência externa, a partir do snapshot do fechamento, da lista de pagamentos vinculados e dos ajustes administrativos aplicados.

## Escopo desta sprint no backend

- `POST /api/caixas/abrir`
- `GET /api/caixas/meu-caixa`
- `POST /api/caixas/:id/fechar`
- `GET /api/caixas/fechados`
- `GET /api/caixas/:id`
- `POST /api/caixas/:id/ajustes`
- `GET /api/caixas/:id/pdf`

## Contratos operacionais relevantes

- Abertura recebe `turno` e bloqueia mais de um caixa aberto para o mesmo usuário.
- Meu Caixa retorna o caixa aberto atual do usuário autenticado, com pagamentos individuais já vinculados.
- Fechamento recebe `valoresConferidos` por forma de pagamento antes do cálculo final.
- O resumo final devolve, para cada forma de pagamento:
  - `valorCalculado`
  - `valorConferido`
  - `diferenca`
  - `valorAjuste`
  - `valorFinal`
- A listagem de caixas fechados é administrativa, paginada e pode filtrar por usuário ou busca textual.
- O PDF é exportado a partir de um caixa já fechado.

## Regras críticas

- Um usuário não pode possuir mais de um caixa aberto ao mesmo tempo.
- Recepcionista só pode abrir, consultar e fechar o próprio caixa.
- Admin pode consultar qualquer caixa fechado e criar `AjusteCaixa`, mas não altera os pagamentos originais.
- Ajuste administrativo só pode ser criado para caixa fechado.
- Ajuste administrativo exige `motivo` e ao menos um valor diferente de zero.
- O resumo calculado do fechamento usa exclusivamente os pagamentos efetivamente ligados ao caixa.
- Divergência do fechamento é sempre `valorConferido - valorCalculado`.

## Pendências deliberadamente fora da Sprint 7

- Reabertura operacional de caixa fechado.
- Integração do PDF com um mecanismo visual mais rico ou layout institucional definitivo.
- Dashboard financeiro consolidado com agregações de múltiplos caixas.
- Checkout, recibo final e limpeza pós-checkout da Sprint 8.
