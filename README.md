# HotelMaximosBack

Backend do sistema Hotel Maximos.

## Stack

- .NET 10
- ASP.NET Core Web API
- PostgreSQL
- Entity Framework Core
- Serilog
- JWT
- BCrypt
- Swagger/OpenAPI
- Docker Compose para PostgreSQL local

## Requisitos locais

- .NET SDK 10
- Docker Desktop
- DBeaver ou TablePlus para manusear o banco

## Banco local

```bash
docker compose up -d
```

Conexao local:

```txt
Host: localhost
Port: 5432
Database: hotel_maximos
User: hotel_user
Password: hotel_password
```

## API local

```bash
dotnet restore
dotnet run --project src/HotelMaximos.Api/HotelMaximos.Api.csproj
```

Swagger:

```txt
https://localhost:<porta>/swagger
```

## Connection string

Use `.env.example` como referencia. Nao versionar credenciais reais.
Repo do Sistema de Gestão do Hotel Maximos
