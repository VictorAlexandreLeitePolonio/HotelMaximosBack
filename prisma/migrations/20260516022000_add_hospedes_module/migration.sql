CREATE TABLE "hospedes_responsaveis" (
    "id" SERIAL NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "cpfNormalizado" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "empresa" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospedes_responsaveis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hospedes_acompanhantes" (
    "id" SERIAL NOT NULL,
    "hospedeResponsavelId" INTEGER NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "documento" TEXT,
    "menorDeIdade" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospedes_acompanhantes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hospedes_responsaveis_cpfNormalizado_key" ON "hospedes_responsaveis"("cpfNormalizado");
CREATE INDEX "hospedes_responsaveis_ativo_idx" ON "hospedes_responsaveis"("ativo");
CREATE INDEX "hospedes_responsaveis_nomeCompleto_idx" ON "hospedes_responsaveis"("nomeCompleto");
CREATE INDEX "hospedes_acompanhantes_hospedeResponsavelId_idx" ON "hospedes_acompanhantes"("hospedeResponsavelId");

ALTER TABLE "hospedes_acompanhantes"
ADD CONSTRAINT "hospedes_acompanhantes_hospedeResponsavelId_fkey"
FOREIGN KEY ("hospedeResponsavelId") REFERENCES "hospedes_responsaveis"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
