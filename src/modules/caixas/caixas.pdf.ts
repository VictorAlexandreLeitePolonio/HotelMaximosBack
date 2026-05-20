const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN_X = 40;
const PAGE_START_Y = 800;
const PAGE_LINE_HEIGHT = 14;
const MAX_LINES_PER_PAGE = 48;

type CashRegisterPdfData = {
  id: number;
  usuario: {
    nomeCompleto: string;
    login: string;
    perfil: string;
  };
  turno: string | null;
  abertoEm: Date;
  fechadoEm: Date | null;
  observacoesFechamento: string | null;
  pagamentos: Array<{
    id: number;
    origemCobranca: string;
    estadiaId: number;
    estadiaExtraId: number | null;
    formaPagamento: string;
    valor: number;
    criadoEm: Date;
  }>;
  ajustes: Array<{
    id: number;
    usuario: {
      nomeCompleto: string;
    };
    motivo: string;
    observacoes: string | null;
    valores: Array<{
      formaPagamento: string;
      valor: number;
    }>;
    criadoEm: Date;
  }>;
  resumoFechamento: {
    itens: Array<{
      formaPagamento: string;
      valorCalculado: number;
      valorConferido: number | null;
      diferenca: number | null;
      valorAjuste: number;
      valorFinal: number;
    }>;
    totalCalculado: number;
    totalConferido: number | null;
    diferencaTotal: number | null;
    totalAjustes: number;
    totalFinal: number;
  } | null;
};

export function buildCashRegisterPdf(data: CashRegisterPdfData): Buffer {
  const lines = buildLines(data);
  const pages = chunkLines(lines, MAX_LINES_PER_PAGE);
  const objects: string[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  const pageRefs: string[] = [];

  for (const pageLines of pages) {
    const contentObjectNumber = objects.length + 2;
    const pageObjectNumber = objects.length + 1;
    const contentStream = buildContentStream(pageLines);

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(contentStream, "latin1")} >>\nstream\n${contentStream}\nendstream`
    );
    pageRefs.push(`${pageObjectNumber} 0 R`);
  }

  objects[1] = `<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.join(" ")}] >>`;

  return serializePdf(objects);
}

function buildLines(data: CashRegisterPdfData) {
  const lines: string[] = [
    `Fechamento de Caixa #${data.id}`,
    "",
    `Operador: ${data.usuario.nomeCompleto} (${data.usuario.login})`,
    `Perfil: ${data.usuario.perfil}`,
    `Turno: ${data.turno ?? "Nao informado"}`,
    `Aberto em: ${formatDateTime(data.abertoEm)}`,
    `Fechado em: ${formatDateTime(data.fechadoEm ?? data.abertoEm)}`,
    ""
  ];

  if (data.resumoFechamento) {
    lines.push("Resumo por forma de pagamento");

    for (const item of data.resumoFechamento.itens) {
      lines.push(
        `${item.formaPagamento}: calc ${formatMoney(item.valorCalculado)} | conf ${formatOptionalMoney(item.valorConferido)} | dif ${formatOptionalMoney(item.diferenca)} | ajuste ${formatMoney(item.valorAjuste)} | final ${formatMoney(item.valorFinal)}`
      );
    }

    lines.push(
      `Totais: calc ${formatMoney(data.resumoFechamento.totalCalculado)} | conf ${formatOptionalMoney(data.resumoFechamento.totalConferido)} | dif ${formatOptionalMoney(data.resumoFechamento.diferencaTotal)} | ajustes ${formatMoney(data.resumoFechamento.totalAjustes)} | final ${formatMoney(data.resumoFechamento.totalFinal)}`
    );
    lines.push("");
  }

  lines.push("Pagamentos vinculados");

  if (data.pagamentos.length === 0) {
    lines.push("Sem pagamentos registrados neste caixa.");
  } else {
    for (const payment of data.pagamentos) {
      lines.push(
        `#${payment.id} | ${payment.formaPagamento} | ${formatMoney(payment.valor)} | ${payment.origemCobranca} | estadia ${payment.estadiaId}${payment.estadiaExtraId ? ` | extra ${payment.estadiaExtraId}` : ""} | ${formatDateTime(payment.criadoEm)}`
      );
    }
  }

  lines.push("");
  lines.push("Ajustes administrativos");

  if (data.ajustes.length === 0) {
    lines.push("Sem ajustes administrativos.");
  } else {
    for (const adjustment of data.ajustes) {
      const values = adjustment.valores
        .filter((item) => item.valor !== 0)
        .map((item) => `${item.formaPagamento}: ${formatMoney(item.valor)}`)
        .join(", ");

      lines.push(
        `#${adjustment.id} | ${adjustment.usuario.nomeCompleto} | ${adjustment.motivo} | ${values || "sem impacto"} | ${formatDateTime(adjustment.criadoEm)}`
      );

      if (adjustment.observacoes) {
        lines.push(`Obs: ${adjustment.observacoes}`);
      }
    }
  }

  if (data.observacoesFechamento) {
    lines.push("");
    lines.push(`Observacoes do fechamento: ${data.observacoesFechamento}`);
  }

  return lines;
}

function buildContentStream(lines: string[]) {
  const commands = ["BT", "/F1 12 Tf", `${PAGE_MARGIN_X} ${PAGE_START_Y} Td`];

  lines.forEach((line, index) => {
    const escapedLine = escapePdfText(line);

    if (index === 0) {
      commands.push(`(${escapedLine}) Tj`);
    } else {
      commands.push(`0 -${PAGE_LINE_HEIGHT} Td`);
      commands.push(`(${escapedLine}) Tj`);
    }
  });

  commands.push("ET");

  return commands.join("\n");
}

function serializePdf(objects: string[]) {
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((objectBody, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${objectBody}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");

  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

function chunkLines<T>(lines: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < lines.length; index += size) {
    chunks.push(lines.slice(index, index + size));
  }

  return chunks.length > 0 ? chunks : [[]];
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatDateTime(value: Date) {
  return value.toISOString().replace("T", " ").slice(0, 16);
}

function formatMoney(value: number) {
  return `R$ ${value.toFixed(2)}`;
}

function formatOptionalMoney(value: number | null) {
  return value === null ? "-" : formatMoney(value);
}
