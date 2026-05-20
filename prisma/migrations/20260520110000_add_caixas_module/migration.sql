ALTER TABLE "caixas"
ADD COLUMN "turno" TEXT,
ADD COLUMN "observacoesFechamento" TEXT,
ADD COLUMN "valoresConferidos" JSONB,
ADD COLUMN "resumoCalculado" JSONB;

CREATE TABLE "ajustes_caixa" (
    "id" SERIAL NOT NULL,
    "caixaId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "observacoes" TEXT,
    "valores" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ajustes_caixa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ajustes_caixa_caixaId_idx" ON "ajustes_caixa"("caixaId");
CREATE INDEX "ajustes_caixa_usuarioId_idx" ON "ajustes_caixa"("usuarioId");

CREATE UNIQUE INDEX "caixas_usuario_aberto_unique" ON "caixas"("usuarioId") WHERE "status" = 'Aberto';

ALTER TABLE "ajustes_caixa"
ADD CONSTRAINT "ajustes_caixa_caixaId_fkey"
FOREIGN KEY ("caixaId") REFERENCES "caixas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ajustes_caixa"
ADD CONSTRAINT "ajustes_caixa_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
