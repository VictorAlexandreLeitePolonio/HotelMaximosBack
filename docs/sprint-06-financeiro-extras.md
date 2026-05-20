# Sprint 06 - Financeiro, Cobranças e Extras

## Objetivo

Formalizar a modelagem técnica da Sprint 6 e implementar o núcleo backend de cobranças mensais, pagamentos e extras vinculados à estadia, incluindo suporte a comprovante por `multipart/form-data`.

## Decisões de modelagem

- A primeira cobrança continua nascendo no check-in pela Sprint 5 e passa a ser tratada como origem `Mensalidade`.
- Cobranças subsequentes são geradas a cada 30 dias corridos a partir da competência imediatamente anterior.
- Saída antecipada não reduz a competência vigente: se a estadia terminou depois do início da próxima competência, essa cobrança ainda precisa existir com valor integral.
- O pagamento continua exigindo usuário autenticado com caixa aberto.
- O backend passa a aceitar `comprovanteArquivo` via `multipart/form-data` e mantém `comprovante` textual apenas como compatibilidade de transição.
- Tipos de extras ficam em cadastro próprio com `nome` e `valorPadrao`.
- Cada extra lançado salva snapshot de descrição, valor unitário, quantidade e total.
- Cada extra gera sua própria cobrança com origem `Extra`, o que permite pagar extras individualmente sem criar uma modelagem paralela de pagamentos.
- O armazenamento do comprovante fica local no backend em `storage/comprovantes` nesta fase, preservando o contrato de upload para futura troca por S3 privado sem refazer as rotas.

## Escopo desta sprint no backend

- `GET /api/estadias/:id/financeiro`
- `POST /api/estadias/:id/cobrancas/gerar`
- `POST /api/cobrancas/:id/pagar`
- `GET /api/tipos-extras`
- `POST /api/tipos-extras`
- `GET /api/tipos-extras/:id`
- `PUT /api/tipos-extras/:id`
- `DELETE /api/tipos-extras/:id`
- `POST /api/estadias/:id/extras`
- `POST /api/extras/:id/pagar`
- Ajuste dos endpoints de check-in da Sprint 5 para aceitar `comprovanteArquivo` multipart.

## Regras críticas

- Pagamento sem caixa aberto retorna erro de domínio.
- Formas diferentes de dinheiro exigem ao menos um comprovante válido, textual legado ou arquivo enviado.
- O valor do pagamento da cobrança deve quitar integralmente a cobrança no MVP.
- Cobrança já paga ou cancelada não pode receber novo pagamento.
- Extra só pode ser lançado para estadia existente.
- Extra pago na criação precisa receber os dados de pagamento no mesmo request.
- Tipo de extra inativado não some do histórico; apenas deixa de ser usado em novos lançamentos.

## Pendências deliberadamente fora da Sprint 6

- Download autenticado de comprovantes e módulo genérico de arquivos.
- Fechamento operacional de caixa e PDF de conferência da Sprint 7.
- Checkout com bloqueio por extras pendentes.
- Storage definitivo em S3 privado e política de retenção de arquivos.
