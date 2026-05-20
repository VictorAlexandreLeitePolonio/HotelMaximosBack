-- CreateEnum
CREATE TYPE "OrigemCobranca" AS ENUM ('Mensalidade', 'Extra');

-- CreateEnum
CREATE TYPE "StatusEstadiaExtra" AS ENUM ('Pendente', 'Pago');

-- AlterTable
ALTER TABLE "cobrancas"
ADD COLUMN "origem" "OrigemCobranca" NOT NULL DEFAULT 'Mensalidade',
ADD COLUMN "estadiaExtraId" INTEGER;

-- CreateTable
CREATE TABLE "tipos_extra" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "valorPadrao" DECIMAL(10,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_extra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estadias_extras" (
    "id" SERIAL NOT NULL,
    "estadiaId" INTEGER NOT NULL,
    "tipoExtraId" INTEGER NOT NULL,
    "descricaoSnapshot" TEXT NOT NULL,
    "valorUnitario" DECIMAL(10,2) NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "status" "StatusEstadiaExtra" NOT NULL DEFAULT 'Pendente',
    "pagoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estadias_extras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cobrancas_estadiaExtraId_key" ON "cobrancas"("estadiaExtraId");

-- CreateIndex
CREATE INDEX "cobrancas_origem_idx" ON "cobrancas"("origem");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_extra_nomeNormalizado_key" ON "tipos_extra"("nomeNormalizado");

-- CreateIndex
CREATE INDEX "tipos_extra_ativo_idx" ON "tipos_extra"("ativo");

-- CreateIndex
CREATE INDEX "tipos_extra_nome_idx" ON "tipos_extra"("nome");

-- CreateIndex
CREATE INDEX "estadias_extras_estadiaId_idx" ON "estadias_extras"("estadiaId");

-- CreateIndex
CREATE INDEX "estadias_extras_tipoExtraId_idx" ON "estadias_extras"("tipoExtraId");

-- CreateIndex
CREATE INDEX "estadias_extras_status_idx" ON "estadias_extras"("status");

-- AddForeignKey
ALTER TABLE "cobrancas"
ADD CONSTRAINT "cobrancas_estadiaExtraId_fkey" FOREIGN KEY ("estadiaExtraId") REFERENCES "estadias_extras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estadias_extras"
ADD CONSTRAINT "estadias_extras_estadiaId_fkey" FOREIGN KEY ("estadiaId") REFERENCES "estadias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estadias_extras"
ADD CONSTRAINT "estadias_extras_tipoExtraId_fkey" FOREIGN KEY ("tipoExtraId") REFERENCES "tipos_extra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
