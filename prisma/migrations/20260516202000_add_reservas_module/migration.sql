-- CreateEnum
CREATE TYPE "StatusReserva" AS ENUM (
    'Confirmada',
    'Cancelada',
    'NoShow'
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" SERIAL NOT NULL,
    "flatId" INTEGER NOT NULL,
    "subcategoriaId" INTEGER NOT NULL,
    "hospedeResponsavelId" INTEGER NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "status" "StatusReserva" NOT NULL DEFAULT 'Confirmada',
    "quantidadeHospedes" INTEGER NOT NULL,
    "cafeContratado" BOOLEAN NOT NULL DEFAULT false,
    "valorBaseContratado" DECIMAL(10,2) NOT NULL,
    "valorCafePorPessoa" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valorCafeContratado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valorTotalContratado" DECIMAL(10,2) NOT NULL,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_hospedes" (
    "reservaId" INTEGER NOT NULL,
    "acompanhanteId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservas_hospedes_pkey" PRIMARY KEY ("reservaId","acompanhanteId")
);

-- CreateIndex
CREATE INDEX "reservas_flatId_dataInicio_dataFim_idx" ON "reservas"("flatId", "dataInicio", "dataFim");

-- CreateIndex
CREATE INDEX "reservas_hospedeResponsavelId_idx" ON "reservas"("hospedeResponsavelId");

-- CreateIndex
CREATE INDEX "reservas_status_idx" ON "reservas"("status");

-- CreateIndex
CREATE INDEX "reservas_dataInicio_idx" ON "reservas"("dataInicio");

-- CreateIndex
CREATE INDEX "reservas_hospedes_acompanhanteId_idx" ON "reservas_hospedes"("acompanhanteId");

-- AddForeignKey
ALTER TABLE "reservas"
ADD CONSTRAINT "reservas_flatId_fkey"
FOREIGN KEY ("flatId") REFERENCES "flats"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas"
ADD CONSTRAINT "reservas_subcategoriaId_fkey"
FOREIGN KEY ("subcategoriaId") REFERENCES "subcategorias_flat"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas"
ADD CONSTRAINT "reservas_hospedeResponsavelId_fkey"
FOREIGN KEY ("hospedeResponsavelId") REFERENCES "hospedes_responsaveis"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_hospedes"
ADD CONSTRAINT "reservas_hospedes_reservaId_fkey"
FOREIGN KEY ("reservaId") REFERENCES "reservas"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_hospedes"
ADD CONSTRAINT "reservas_hospedes_acompanhanteId_fkey"
FOREIGN KEY ("acompanhanteId") REFERENCES "hospedes_acompanhantes"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
