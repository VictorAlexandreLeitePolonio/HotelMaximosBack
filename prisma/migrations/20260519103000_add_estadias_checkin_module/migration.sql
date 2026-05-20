-- CreateEnum
CREATE TYPE "StatusEstadia" AS ENUM ('Ativa', 'Encerrada');

-- CreateEnum
CREATE TYPE "StatusCobranca" AS ENUM ('Pendente', 'Paga', 'Cancelada');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('Pix', 'Dinheiro', 'CartaoCredito', 'CartaoDebito', 'Transferencia');

-- CreateEnum
CREATE TYPE "StatusCaixa" AS ENUM ('Aberto', 'Fechado');

-- CreateEnum
CREATE TYPE "TipoHistoricoFlat" AS ENUM ('CheckIn', 'TransferenciaSaida', 'TransferenciaEntrada', 'Renovacao');

-- CreateTable
CREATE TABLE "estadias" (
    "id" SERIAL NOT NULL,
    "reservaId" INTEGER,
    "flatId" INTEGER NOT NULL,
    "subcategoriaId" INTEGER NOT NULL,
    "hospedeResponsavelId" INTEGER NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFimPrevista" TIMESTAMP(3) NOT NULL,
    "dataFimEfetiva" TIMESTAMP(3),
    "status" "StatusEstadia" NOT NULL DEFAULT 'Ativa',
    "quantidadeHospedes" INTEGER NOT NULL,
    "cafeContratado" BOOLEAN NOT NULL DEFAULT false,
    "valorBaseContratado" DECIMAL(10,2) NOT NULL,
    "valorCafePorPessoa" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valorCafeContratado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valorTotalContratado" DECIMAL(10,2) NOT NULL,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estadias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estadias_hospedes" (
    "estadiaId" INTEGER NOT NULL,
    "acompanhanteId" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estadias_hospedes_pkey" PRIMARY KEY ("estadiaId","acompanhanteId")
);

-- CreateTable
CREATE TABLE "cobrancas" (
    "id" SERIAL NOT NULL,
    "estadiaId" INTEGER NOT NULL,
    "competenciaInicio" TIMESTAMP(3) NOT NULL,
    "competenciaFim" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" "StatusCobranca" NOT NULL DEFAULT 'Pendente',
    "geradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liquidadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cobrancas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caixas" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "status" "StatusCaixa" NOT NULL DEFAULT 'Aberto',
    "abertoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caixas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" SERIAL NOT NULL,
    "cobrancaId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "caixaId" INTEGER NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "comprovante" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historicos_flat" (
    "id" SERIAL NOT NULL,
    "flatId" INTEGER NOT NULL,
    "estadiaId" INTEGER,
    "usuarioId" INTEGER,
    "tipo" "TipoHistoricoFlat" NOT NULL,
    "descricao" TEXT NOT NULL,
    "metadata" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historicos_flat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estadias_reservaId_key" ON "estadias"("reservaId");

-- CreateIndex
CREATE INDEX "estadias_flatId_idx" ON "estadias"("flatId");

-- CreateIndex
CREATE INDEX "estadias_subcategoriaId_idx" ON "estadias"("subcategoriaId");

-- CreateIndex
CREATE INDEX "estadias_hospedeResponsavelId_idx" ON "estadias"("hospedeResponsavelId");

-- CreateIndex
CREATE INDEX "estadias_status_idx" ON "estadias"("status");

-- CreateIndex
CREATE INDEX "estadias_dataInicio_idx" ON "estadias"("dataInicio");

-- CreateIndex
CREATE INDEX "estadias_hospedes_acompanhanteId_idx" ON "estadias_hospedes"("acompanhanteId");

-- CreateIndex
CREATE INDEX "cobrancas_estadiaId_idx" ON "cobrancas"("estadiaId");

-- CreateIndex
CREATE INDEX "cobrancas_status_idx" ON "cobrancas"("status");

-- CreateIndex
CREATE INDEX "cobrancas_competenciaInicio_idx" ON "cobrancas"("competenciaInicio");

-- CreateIndex
CREATE INDEX "caixas_usuarioId_idx" ON "caixas"("usuarioId");

-- CreateIndex
CREATE INDEX "caixas_status_idx" ON "caixas"("status");

-- CreateIndex
CREATE INDEX "pagamentos_cobrancaId_idx" ON "pagamentos"("cobrancaId");

-- CreateIndex
CREATE INDEX "pagamentos_usuarioId_idx" ON "pagamentos"("usuarioId");

-- CreateIndex
CREATE INDEX "pagamentos_caixaId_idx" ON "pagamentos"("caixaId");

-- CreateIndex
CREATE INDEX "pagamentos_formaPagamento_idx" ON "pagamentos"("formaPagamento");

-- CreateIndex
CREATE INDEX "historicos_flat_flatId_idx" ON "historicos_flat"("flatId");

-- CreateIndex
CREATE INDEX "historicos_flat_estadiaId_idx" ON "historicos_flat"("estadiaId");

-- CreateIndex
CREATE INDEX "historicos_flat_usuarioId_idx" ON "historicos_flat"("usuarioId");

-- CreateIndex
CREATE INDEX "historicos_flat_tipo_idx" ON "historicos_flat"("tipo");

-- AddForeignKey
ALTER TABLE "estadias" ADD CONSTRAINT "estadias_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estadias" ADD CONSTRAINT "estadias_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estadias" ADD CONSTRAINT "estadias_subcategoriaId_fkey" FOREIGN KEY ("subcategoriaId") REFERENCES "subcategorias_flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estadias" ADD CONSTRAINT "estadias_hospedeResponsavelId_fkey" FOREIGN KEY ("hospedeResponsavelId") REFERENCES "hospedes_responsaveis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estadias_hospedes" ADD CONSTRAINT "estadias_hospedes_estadiaId_fkey" FOREIGN KEY ("estadiaId") REFERENCES "estadias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estadias_hospedes" ADD CONSTRAINT "estadias_hospedes_acompanhanteId_fkey" FOREIGN KEY ("acompanhanteId") REFERENCES "hospedes_acompanhantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobrancas" ADD CONSTRAINT "cobrancas_estadiaId_fkey" FOREIGN KEY ("estadiaId") REFERENCES "estadias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "caixas" ADD CONSTRAINT "caixas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "cobrancas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_caixaId_fkey" FOREIGN KEY ("caixaId") REFERENCES "caixas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historicos_flat" ADD CONSTRAINT "historicos_flat_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "flats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historicos_flat" ADD CONSTRAINT "historicos_flat_estadiaId_fkey" FOREIGN KEY ("estadiaId") REFERENCES "estadias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historicos_flat" ADD CONSTRAINT "historicos_flat_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
