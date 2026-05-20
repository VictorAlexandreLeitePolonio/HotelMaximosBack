# Sprint 8: Checkout e recibos

## Objetivo

Entregar o checkout operacional do backend com validacao financeira, encerramento da estadia, recibo final e transicao do flat para limpeza.

## Escopo tecnico

- Encerrar estadias ativas via endpoint dedicado de checkout.
- Bloquear checkout de recepcionista quando houver debitos pendentes.
- Permitir override administrativo apenas para `Admin`, com motivo obrigatorio e trilha auditavel.
- Atualizar o flat para `AguardandoLimpeza` ao final do checkout.
- Manter o bloqueio natural de novo check-in enquanto o flat permanecer em `AguardandoLimpeza`.
- Gerar resumo de recibo final no retorno do checkout e disponibilizar exportacao server-side do recibo.

## Regras de negocio

1. Checkout so pode ocorrer para estadia com status `Ativa`.
2. Debito pendente considera qualquer cobranca com status `Pendente`, incluindo cobrancas originadas de extras.
3. Recepcionista nao pode concluir checkout com debito pendente.
4. Admin pode concluir checkout com debito pendente apenas informando `motivoOverride`.
5. Ao concluir checkout:
   - a estadia muda para `Encerrada`;
   - `dataFimEfetiva` recebe a data/hora atual;
   - o flat muda para `AguardandoLimpeza`;
   - um historico auditavel do checkout e registrado.
6. O recibo final e gerado a partir da fotografia da estadia encerrada, das cobrancas e dos pagamentos vinculados.

## Contratos planejados

### POST `/api/estadias/:id/checkout`

Executa o checkout da estadia.

Body:

```json
{
  "motivoOverride": "Checkout autorizado pelo admin com debito residual acordado."
}
```

Observacoes:

- `motivoOverride` e opcional quando nao existe debito pendente.
- `motivoOverride` e obrigatorio quando o usuario autenticado for `Admin` e houver debito pendente.

### GET `/api/estadias/:id/checkout/recibo`

Retorna o PDF do recibo final da estadia encerrada.

## Decisoes tecnicas

- Nao sera criada uma tabela dedicada de recibo nesta sprint.
- A auditoria do checkout ficara em `HistoricoFlat`, com tipo `CheckOut` e metadados do override financeiro quando aplicavel.
- O status `AguardandoLimpeza` continuara sendo o bloqueio operacional para novos check-ins ate a Sprint 9 formalizar o modulo de limpezas.
