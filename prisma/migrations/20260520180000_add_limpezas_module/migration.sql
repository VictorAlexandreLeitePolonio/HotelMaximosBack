-- CreateEnum
CREATE TYPE "TipoLimpeza" AS ENUM ('Semanal', 'Checkout');

-- CreateEnum
CREATE TYPE "StatusLimpeza" AS ENUM ('Pendente', 'Concluida', 'Atrasada', 'Suspensa');

-- CreateTable
CREATE TABLE "limpezas" (
    "id" SERIAL NOT NULL,
    "chaveGeracao" TEXT NOT NULL,
    "flatId" INTEGER NOT NULL,
    "estadiaId" INTEGER,
    "tipo" "TipoLimpeza" NOT NULL,
    "status" "StatusLimpeza" NOT NULL DEFAULT 'Pendente',
    "dataProgramada" TIMESTAMP(3) NOT NULL,
    "atrasaEm" TIMESTAMP(3) NOT NULL,
    "concluidaEm" TIMESTAMP(3),
    "usuarioConclusaoId" INTEGER,
    "observacoesConclusao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "limpezas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "limpezas_chaveGeracao_key" ON "limpezas"("chaveGeracao");

-- CreateIndex
CREATE INDEX "limpezas_flatId_idx" ON "limpezas"("flatId");

-- CreateIndex
CREATE INDEX "limpezas_estadiaId_idx" ON "limpezas"("estadiaId");

-- CreateIndex
CREATE INDEX "limpezas_status_idx" ON "limpezas"("status");

-- CreateIndex
CREATE INDEX "limpezas_tipo_idx" ON "limpezas"("tipo");

-- CreateIndex
CREATE INDEX "limpezas_dataProgramada_idx" ON "limpezas"("dataProgramada");

-- CreateIndex
CREATE INDEX "limpezas_atrasaEm_idx" ON "limpezas"("atrasaEm");

-- CreateIndex
CREATE INDEX "limpezas_usuarioConclusaoId_idx" ON "limpezas"("usuarioConclusaoId");

-- AddForeignKey
ALTER TABLE "limpezas" ADD CONSTRAINT "limpezas_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "limpezas" ADD CONSTRAINT "limpezas_estadiaId_fkey" FOREIGN KEY ("estadiaId") REFERENCES "estadias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "limpezas" ADD CONSTRAINT "limpezas_usuarioConclusaoId_fkey" FOREIGN KEY ("usuarioConclusaoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
