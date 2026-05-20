# Sprint 05 - Check-in e Estadias Ativas

## Objetivo

Formalizar a modelagem técnica da Sprint 5 e implementar o núcleo backend de check-in, estadias ativas, troca de flat e renovação com consistência transacional.

## Decisões de modelagem

- `Reserva` continua separada de `Estadia`.
- `Estadia` pode nascer de uma `Reserva` existente ou de `check-in direto`.
- `Estadia` mantém snapshot próprio de preço, café, quantidade de hóspedes e subcategoria contratada.
- `EstadiaHospede` replica os acompanhantes efetivamente vinculados à ocupação.
- A primeira `Cobranca` nasce no check-in com competência fixa de 30 dias corridos a partir da data efetiva do check-in.
- `Pagamento` inicial precisa liquidar integralmente a primeira cobrança.
- `Pagamento` exige `Caixa` aberto do usuário autenticado.
- Enquanto o upload binário não existe no backend, formas diferentes de dinheiro exigem um `comprovante` textual não vazio; o fluxo `multipart/form-data` fica para a Sprint 6.
- `HistoricoFlat` registra pelo menos `CheckIn`, `TransferenciaSaida`, `TransferenciaEntrada` e `Renovacao`.

## Escopo desta sprint no backend

- `POST /api/reservas/:id/check-in`
- `POST /api/estadias/check-in-direto`
- `GET /api/estadias/check-in-do-dia`
- `GET /api/estadias/ativas`
- `POST /api/estadias/:id/trocar-flat`
- `POST /api/estadias/:id/renovar`

## Regras críticas

- Check-in de reserva só aceita reservas `Confirmada` sem estadia prévia vinculada.
- A data efetiva do check-in usa o horário informado ou `now()`; não reaproveita automaticamente a data planejada da reserva.
- `DataFimPrevista` é obrigatória na estadia, mas pode ser omitida no request para cair no padrão `DataInicio + 30 dias corridos`.
- A primeira cobrança usa a competência `[dataInicio, dataInicio + 30 dias]`, mesmo que a `DataFimPrevista` seja menor.
- O valor do pagamento inicial deve ser exatamente igual ao `valorTotalContratado` da estadia.
- Troca de flat não recalcula o valor contratado da estadia.
- Renovação só é permitida para data futura maior que a `DataFimPrevista` atual e sem conflito de reserva no flat atual.

## Pendências deliberadamente fora da Sprint 5

- Upload real de comprovantes por arquivo.
- CRUD e fechamento operacional de caixas.
- Cobranças subsequentes, extras, checkout e limpeza pós-checkout.
- No-show manual e ajustes administrativos/auditoria ampla.
