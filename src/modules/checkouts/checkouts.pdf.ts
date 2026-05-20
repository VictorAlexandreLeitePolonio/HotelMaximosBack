const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN_X = 40;
const PAGE_START_Y = 800;
const PAGE_LINE_HEIGHT = 14;
const MAX_LINES_PER_PAGE = 48;

export type CheckoutReceiptPdfData = {
  numero: string;
  geradoEm: Date;
  estadiaId: number;
  hospedeResponsavel: {
    nomeCompleto: string;
    cpf: string;
  };
  flat: {
    numero: string;
  };
  periodo: {
    dataInicio: Date;
    dataFimPrevista: Date;
    dataFimEfetiva: Date;
  };
  totais: {
    totalCobrado: number;
    totalPago: number;
    totalPendente: number;
  };
  itens: Array<{
    tipo: "Mensalidade" | "Extra";
    descricao: string;
    valor: number;
    status: "Pendente" | "Pago" | "Cancelada";
  }>;
  motivoOverride: string | null;
};

export function buildCheckoutReceiptPdf(data: CheckoutReceiptPdfData): Buffer {
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

function buildLines(data: CheckoutReceiptPdfData) {
  const lines: string[] = [
    `Recibo final de checkout ${data.numero}`,
    "",
    `Estadia: #${data.estadiaId}`,
    `Gerado em: ${formatDateTime(data.geradoEm)}`,
    `Hospede: ${data.hospedeResponsavel.nomeCompleto}`,
    `CPF: ${data.hospedeResponsavel.cpf}`,
    `Flat: ${data.flat.numero}`,
    `Inicio: ${formatDateTime(data.periodo.dataInicio)}`,
    `Fim previsto: ${formatDateTime(data.periodo.dataFimPrevista)}`,
    `Fim efetivo: ${formatDateTime(data.periodo.dataFimEfetiva)}`,
    "",
    `Totais: cobrado ${formatMoney(data.totais.totalCobrado)} | pago ${formatMoney(data.totais.totalPago)} | pendente ${formatMoney(data.totais.totalPendente)}`,
    "",
    "Itens do checkout"
  ];

  if (data.itens.length === 0) {
    lines.push("Sem itens financeiros registrados para esta estadia.");
  } else {
    for (const item of data.itens) {
      lines.push(`${item.tipo} | ${item.status} | ${formatMoney(item.valor)} | ${item.descricao}`);
    }
  }

  if (data.motivoOverride) {
    lines.push("");
    lines.push(`Override administrativo: ${data.motivoOverride}`);
  }

  lines.push("");
  lines.push("Aviso: imprimir este recibo antes de liberar o flat para limpeza.");

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
