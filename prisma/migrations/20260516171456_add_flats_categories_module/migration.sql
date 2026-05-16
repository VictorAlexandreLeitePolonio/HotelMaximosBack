-- CreateEnum
CREATE TYPE "StatusOperacionalFlat" AS ENUM (
    'Livre',
    'Reservado',
    'Ocupado',
    'AguardandoLimpeza',
    'Manutencao'
);

-- CreateTable
CREATE TABLE "categorias_flat" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_flat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategorias_flat" (
    "id" SERIAL NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "precoBase" DECIMAL(10,2) NOT NULL,
    "capacidadeMaxima" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcategorias_flat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flats" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "numeroNormalizado" TEXT NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "subcategoriaId" INTEGER NOT NULL,
    "statusOperacional" "StatusOperacionalFlat" NOT NULL DEFAULT 'Livre',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_flat_nomeNormalizado_key" ON "categorias_flat"("nomeNormalizado");

-- CreateIndex
CREATE INDEX "categorias_flat_ativo_idx" ON "categorias_flat"("ativo");

-- CreateIndex
CREATE INDEX "categorias_flat_nome_idx" ON "categorias_flat"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "subcategorias_flat_categoriaId_nomeNormalizado_key"
ON "subcategorias_flat"("categoriaId", "nomeNormalizado");

-- CreateIndex
CREATE INDEX "subcategorias_flat_categoriaId_idx" ON "subcategorias_flat"("categoriaId");

-- CreateIndex
CREATE INDEX "subcategorias_flat_ativo_idx" ON "subcategorias_flat"("ativo");

-- CreateIndex
CREATE INDEX "subcategorias_flat_nome_idx" ON "subcategorias_flat"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "flats_numeroNormalizado_key" ON "flats"("numeroNormalizado");

-- CreateIndex
CREATE INDEX "flats_categoriaId_idx" ON "flats"("categoriaId");

-- CreateIndex
CREATE INDEX "flats_subcategoriaId_idx" ON "flats"("subcategoriaId");

-- CreateIndex
CREATE INDEX "flats_statusOperacional_idx" ON "flats"("statusOperacional");

-- CreateIndex
CREATE INDEX "flats_ativo_idx" ON "flats"("ativo");

-- AddForeignKey
ALTER TABLE "subcategorias_flat"
ADD CONSTRAINT "subcategorias_flat_categoriaId_fkey"
FOREIGN KEY ("categoriaId") REFERENCES "categorias_flat"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flats"
ADD CONSTRAINT "flats_categoriaId_fkey"
FOREIGN KEY ("categoriaId") REFERENCES "categorias_flat"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flats"
ADD CONSTRAINT "flats_subcategoriaId_fkey"
FOREIGN KEY ("subcategoriaId") REFERENCES "subcategorias_flat"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
