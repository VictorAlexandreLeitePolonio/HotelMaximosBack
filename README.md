# Hotel Maximos Back

Backend do sistema de gestao do Hotel Maximos, criado com Node.js 22, TypeScript, Fastify, Prisma, PostgreSQL, Zod, Swagger e Vitest.

## Requisitos

- Node.js 22+
- npm
- Docker e Docker Compose
- DBeaver ou outro cliente PostgreSQL opcional

## Variaveis de ambiente

Crie um arquivo `.env` localmente, sem commitar, com as chaves abaixo:

```txt
NODE_ENV=development
HOST=0.0.0.0
PORT=3333
DATABASE_URL=postgresql://hotel_maximos:hotel_maximos@localhost:5432/hotel_maximos
JWT_SECRET=troque-por-um-segredo-local-com-32-caracteres
JWT_EXPIRES_IN=15m
```

Arquivos `.env`, `.env.*` e `.env.example` ficam ignorados pelo Git por decisao do projeto.

## Banco local

Suba o PostgreSQL:

```sh
docker compose up -d
```

Conexao sugerida no DBeaver:

- Host: `localhost`
- Port: `5432`
- Database: `hotel_maximos`
- User: `hotel_maximos`
- Password: `hotel_maximos`

## Comandos

Instale dependencias:

```sh
npm install
```

Gere o Prisma Client:

```sh
npm run prisma:generate
```

Rode migrations quando houver modelos:

```sh
npm run prisma:migrate
```

Execute em desenvolvimento:

```sh
npm run dev
```

Valide a sprint:

```sh
npm run typecheck
npm run build
npm run test
docker compose config
```

## Endpoints base

- Health: `GET /api/health`
- Swagger UI: `GET /docs`

## Contratos compartilhados

- Erros seguem o formato `{ error: { code, message, traceId, details? } }`.
- Respostas paginadas devem usar `{ data, meta: { page, pageSize, total, totalPages } }`.
- Logs usam o logger do Fastify/Pino e redigem tokens, senhas e headers de autorizacao.
