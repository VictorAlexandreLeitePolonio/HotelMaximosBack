const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN_X = 40;
const PAGE_MARGIN_Y = 40;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN_X * 2;
const SECTION_GAP = 18;
const CARD_GAP = 12;
const ROW_HEIGHT = 22;

const COLORS = {
  white: [1, 1, 1] as const,
  slate900: [0.09, 0.13, 0.17] as const,
  slate700: [0.31, 0.38, 0.43] as const,
  slate300: [0.84, 0.88, 0.91] as const,
  slate100: [0.95, 0.97, 0.98] as const,
  teal700: [0.06, 0.46, 0.43] as const,
  teal050: [0.93, 0.98, 0.97] as const,
  red050: [0.99, 0.95, 0.95] as const,
} satisfies Record<string, readonly [number, number, number]>;

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

type PdfWriter = {
  pages: PdfPage[];
};

type PdfPage = {
  commands: string[];
  cursorY: number;
};

type TableColumn = {
  align?: 'left' | 'right';
  key: string;
  title: string;
  width: number;
};

export function buildCashRegisterPdf(data: CashRegisterPdfData): Buffer {
  const writer = createWriter();

  drawHeader(writer, data);
  drawMetaCards(writer, data);

  if (data.resumoFechamento) {
    drawResumoCards(writer, data.resumoFechamento);
    drawTable(writer, {
      columns: [
        { key: 'formaPagamento', title: 'Forma', width: 120 },
        { key: 'valorCalculado', title: 'Calculado', width: 92, align: 'right' },
        { key: 'valorConferido', title: 'Conferido', width: 92, align: 'right' },
        { key: 'valorAjuste', title: 'Ajuste', width: 92, align: 'right' },
        { key: 'valorFinal', title: 'Final', width: 119, align: 'right' },
      ],
      rows: data.resumoFechamento.itens.map((item) => ({
        formaPagamento: item.formaPagamento,
        valorAjuste: formatMoney(item.valorAjuste),
        valorCalculado: formatMoney(item.valorCalculado),
        valorConferido: formatOptionalMoney(item.valorConferido),
        valorFinal: formatMoney(item.valorFinal),
      })),
      subtitle: 'Resumo consolidado por forma de pagamento.',
      title: 'Resumo por forma',
    });
  }

  drawTable(writer, {
    columns: [
      { key: 'momento', title: 'Momento', width: 78 },
      { key: 'formaPagamento', title: 'Forma', width: 80 },
      { key: 'valor', title: 'Valor', width: 78, align: 'right' },
      { key: 'origem', title: 'Origem', width: 116 },
      { key: 'estadia', title: 'Estadia', width: 85 },
      { key: 'extra', title: 'Extra', width: 78 },
    ],
    emptyMessage: 'Sem pagamentos registrados neste caixa.',
    rows: data.pagamentos.map((payment) => ({
      estadia: `#${payment.estadiaId}`,
      extra: payment.estadiaExtraId ? `#${payment.estadiaExtraId}` : '-',
      formaPagamento: payment.formaPagamento,
      momento: formatDateTimeCompact(payment.criadoEm),
      origem: truncateText(payment.origemCobranca, 22),
      valor: formatMoney(payment.valor),
    })),
    subtitle: 'Lancamentos vinculados ao caixa durante a operacao.',
    title: 'Pagamentos vinculados',
  });

  drawTable(writer, {
    columns: [
      { key: 'momento', title: 'Momento', width: 78 },
      { key: 'usuario', title: 'Usuario', width: 120 },
      { key: 'motivo', title: 'Motivo', width: 185 },
      { key: 'impacto', title: 'Impacto', width: 132 },
    ],
    emptyMessage: 'Sem ajustes administrativos.',
    rows: data.ajustes.map((adjustment) => ({
      impacto:
        adjustment.valores
          .filter((item) => item.valor !== 0)
          .map((item) => `${item.formaPagamento}: ${formatMoney(item.valor)}`)
          .join(' | ') || 'Sem impacto financeiro',
      momento: formatDateTimeCompact(adjustment.criadoEm),
      motivo: truncateText(adjustment.motivo, 40),
      usuario: truncateText(adjustment.usuario.nomeCompleto, 18),
    })),
    notes: data.ajustes
      .filter((adjustment) => adjustment.observacoes)
      .map((adjustment) => `Ajuste #${adjustment.id}: ${adjustment.observacoes}`),
    subtitle: 'Intervencoes administrativas aplicadas apos o fechamento.',
    title: 'Ajustes administrativos',
  });

  if (data.observacoesFechamento) {
    drawNotesBlock(
      writer,
      'Observacoes do fechamento',
      data.observacoesFechamento,
      COLORS.red050,
    );
  }

  appendPageFooters(writer);

  const objects: string[] = [];

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  );

  const pageRefs: string[] = [];

  for (const page of writer.pages) {
    const contentObjectNumber = objects.length + 2;
    const pageObjectNumber = objects.length + 1;
    const contentStream = page.commands.join('\n');

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
    );
    objects.push(
      `<< /Length ${Buffer.byteLength(contentStream, 'latin1')} >>\nstream\n${contentStream}\nendstream`,
    );
    pageRefs.push(`${pageObjectNumber} 0 R`);
  }

  objects[1] = `<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.join(' ')}] >>`;

  return serializePdf(objects);
}

function createWriter(): PdfWriter {
  return {
    pages: [{ commands: [], cursorY: PAGE_MARGIN_Y }],
  };
}

function currentPage(writer: PdfWriter) {
  return writer.pages[writer.pages.length - 1];
}

function createPage(writer: PdfWriter) {
  writer.pages.push({ commands: [], cursorY: PAGE_MARGIN_Y });
}

function ensureSpace(writer: PdfWriter, requiredHeight: number) {
  const page = currentPage(writer);

  if (page.cursorY + requiredHeight > PAGE_HEIGHT - PAGE_MARGIN_Y) {
    createPage(writer);
  }
}

function advanceCursor(writer: PdfWriter, value: number) {
  currentPage(writer).cursorY += value;
}

function drawHeader(writer: PdfWriter, data: CashRegisterPdfData) {
  ensureSpace(writer, 92);
  const page = currentPage(writer);
  const top = page.cursorY;

  drawRect(page, PAGE_MARGIN_X, top, CONTENT_WIDTH, 78, COLORS.teal700, COLORS.teal700);
  drawText(page, PAGE_MARGIN_X + 18, top + 24, 10, 'F1', COLORS.white, 'DOCUMENTO FINANCEIRO');
  drawText(page, PAGE_MARGIN_X + 18, top + 46, 20, 'F2', COLORS.white, `Fechamento de caixa #${data.id}`);
  drawText(
    page,
    PAGE_MARGIN_X + CONTENT_WIDTH - 18,
    top + 24,
    10,
    'F1',
    COLORS.white,
    `Emitido em ${formatDateTime(data.fechadoEm ?? data.abertoEm)}`,
    'right',
  );
  drawText(
    page,
    PAGE_MARGIN_X + CONTENT_WIDTH - 18,
    top + 46,
    10,
    'F1',
    COLORS.white,
    `Operador ${truncateText(data.usuario.nomeCompleto, 32)}`,
    'right',
  );

  advanceCursor(writer, 96);
}

function drawMetaCards(writer: PdfWriter, data: CashRegisterPdfData) {
  const items = [
    {
      label: 'Responsavel',
      value: truncateText(`${data.usuario.nomeCompleto} (${data.usuario.login})`, 34),
    },
    { label: 'Perfil', value: data.usuario.perfil },
    { label: 'Turno', value: data.turno ?? 'Nao informado' },
    { label: 'Abertura', value: formatDateTime(data.abertoEm) },
    { label: 'Fechamento', value: formatDateTime(data.fechadoEm ?? data.abertoEm) },
  ];

  const cardWidth = (CONTENT_WIDTH - CARD_GAP) / 2;
  const cardHeight = 54;
  const totalHeight = Math.ceil(items.length / 2) * (cardHeight + CARD_GAP) - CARD_GAP;

  ensureSpace(writer, totalHeight + SECTION_GAP);
  const page = currentPage(writer);
  const top = page.cursorY;

  items.forEach((item, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = PAGE_MARGIN_X + column * (cardWidth + CARD_GAP);
    const y = top + row * (cardHeight + CARD_GAP);

    drawRect(page, x, y, cardWidth, cardHeight, COLORS.slate100, COLORS.slate300);
    drawText(page, x + 14, y + 18, 9, 'F1', COLORS.slate700, item.label);
    drawText(page, x + 14, y + 38, 12, 'F2', COLORS.slate900, item.value);
  });

  advanceCursor(writer, totalHeight + SECTION_GAP);
}

function drawResumoCards(writer: PdfWriter, resumo: NonNullable<CashRegisterPdfData['resumoFechamento']>) {
  const cards = [
    { label: 'Total calculado', value: formatMoney(resumo.totalCalculado) },
    { label: 'Total conferido', value: formatOptionalMoney(resumo.totalConferido) },
    { label: 'Ajustes', value: formatMoney(resumo.totalAjustes) },
    { label: 'Total final', value: formatMoney(resumo.totalFinal) },
  ];

  const cardWidth = (CONTENT_WIDTH - CARD_GAP) / 2;
  const cardHeight = 64;
  const totalHeight = 2 * cardHeight + CARD_GAP;

  ensureSpace(writer, totalHeight + SECTION_GAP);
  const page = currentPage(writer);
  const top = page.cursorY;

  cards.forEach((card, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = PAGE_MARGIN_X + column * (cardWidth + CARD_GAP);
    const y = top + row * (cardHeight + CARD_GAP);

    drawRect(page, x, y, cardWidth, cardHeight, COLORS.teal050, COLORS.slate300);
    drawText(page, x + 14, y + 20, 9, 'F1', COLORS.slate700, card.label);
    drawText(page, x + 14, y + 44, 16, 'F2', COLORS.slate900, card.value);
  });

  advanceCursor(writer, totalHeight + SECTION_GAP);
}

function drawTable(
  writer: PdfWriter,
  {
    columns,
    rows,
    title,
    subtitle,
    emptyMessage,
    notes,
  }: {
    columns: TableColumn[];
    rows: Array<Record<string, string>>;
    title: string;
    subtitle: string;
    emptyMessage?: string;
    notes?: string[];
  },
) {
  renderTableHeader(writer, title, subtitle, columns);

  if (rows.length === 0) {
    ensureSpace(writer, 54);
    const page = currentPage(writer);
    const top = page.cursorY;

    drawRect(page, PAGE_MARGIN_X, top, CONTENT_WIDTH, 44, COLORS.slate100, COLORS.slate300);
    drawText(
      page,
      PAGE_MARGIN_X + 14,
      top + 26,
      10,
      'F1',
      COLORS.slate700,
      emptyMessage ?? 'Nenhum registro encontrado.',
    );

    advanceCursor(writer, 44 + SECTION_GAP);
  } else {
    rows.forEach((row, index) => {
      ensureSpace(writer, ROW_HEIGHT + 6);

      if (currentPage(writer).cursorY + ROW_HEIGHT > PAGE_HEIGHT - PAGE_MARGIN_Y) {
        renderTableHeader(writer, `${title} (continua)`, subtitle, columns);
      }

      const page = currentPage(writer);
      const top = page.cursorY;

      drawRect(
        page,
        PAGE_MARGIN_X,
        top,
        CONTENT_WIDTH,
        ROW_HEIGHT,
        index % 2 === 0 ? COLORS.white : COLORS.slate100,
        COLORS.slate300,
      );

      let currentX = PAGE_MARGIN_X;

      columns.forEach((column) => {
        const value = truncateText(row[column.key] ?? '-', column.align === 'right' ? 18 : 28);
        drawText(
          page,
          currentX + (column.align === 'right' ? column.width - 8 : 8),
          top + 15,
          9,
          'F1',
          COLORS.slate900,
          value,
          column.align === 'right' ? 'right' : 'left',
        );
        currentX += column.width;
      });

      advanceCursor(writer, ROW_HEIGHT);
    });

    advanceCursor(writer, SECTION_GAP);
  }

  if (notes?.length) {
    drawNotesBlock(writer, `${title} - observacoes`, notes.join(' | '), COLORS.slate100);
  }
}

function renderTableHeader(writer: PdfWriter, title: string, subtitle: string, columns: TableColumn[]) {
  ensureSpace(writer, 82);
  const page = currentPage(writer);
  const top = page.cursorY;

  drawText(page, PAGE_MARGIN_X, top + 10, 14, 'F2', COLORS.slate900, title);
  drawText(page, PAGE_MARGIN_X, top + 28, 10, 'F1', COLORS.slate700, subtitle);

  const headerTop = top + 42;
  drawRect(page, PAGE_MARGIN_X, headerTop, CONTENT_WIDTH, 24, COLORS.slate900, COLORS.slate900);

  let currentX = PAGE_MARGIN_X;

  columns.forEach((column) => {
    drawText(
      page,
      currentX + (column.align === 'right' ? column.width - 8 : 8),
      headerTop + 16,
      9,
      'F2',
      COLORS.white,
      column.title,
      column.align === 'right' ? 'right' : 'left',
    );
    currentX += column.width;
  });

  advanceCursor(writer, 42 + 24);
}

function drawNotesBlock(
  writer: PdfWriter,
  title: string,
  content: string,
  backgroundColor: readonly [number, number, number],
) {
  const lines = wrapText(content, 86);
  const blockHeight = 38 + lines.length * 14;

  ensureSpace(writer, blockHeight + SECTION_GAP);
  const page = currentPage(writer);
  const top = page.cursorY;

  drawRect(page, PAGE_MARGIN_X, top, CONTENT_WIDTH, blockHeight, backgroundColor, COLORS.slate300);
  drawText(page, PAGE_MARGIN_X + 14, top + 18, 11, 'F2', COLORS.slate900, title);

  lines.forEach((line, index) => {
    drawText(page, PAGE_MARGIN_X + 14, top + 38 + index * 14, 10, 'F1', COLORS.slate700, line);
  });

  advanceCursor(writer, blockHeight + SECTION_GAP);
}

function appendPageFooters(writer: PdfWriter) {
  const totalPages = writer.pages.length;

  writer.pages.forEach((page, index) => {
    drawText(
      page,
      PAGE_MARGIN_X,
      PAGE_HEIGHT - PAGE_MARGIN_Y + 10,
      9,
      'F1',
      COLORS.slate700,
      'Hotel Maximos',
    );
    drawText(
      page,
      PAGE_WIDTH - PAGE_MARGIN_X,
      PAGE_HEIGHT - PAGE_MARGIN_Y + 10,
      9,
      'F1',
      COLORS.slate700,
      `Pagina ${index + 1} de ${totalPages}`,
      'right',
    );
  });
}

function drawRect(
  page: PdfPage,
  x: number,
  yTop: number,
  width: number,
  height: number,
  fill: readonly [number, number, number],
  stroke: readonly [number, number, number],
) {
  page.commands.push('q');
  page.commands.push(`${stroke[0]} ${stroke[1]} ${stroke[2]} RG`);
  page.commands.push(`${fill[0]} ${fill[1]} ${fill[2]} rg`);
  page.commands.push(`${x} ${PAGE_HEIGHT - yTop - height} ${width} ${height} re B`);
  page.commands.push('Q');
}

function drawText(
  page: PdfPage,
  x: number,
  yTop: number,
  size: number,
  font: 'F1' | 'F2',
  color: readonly [number, number, number],
  value: string,
  align: 'left' | 'right' = 'left',
) {
  const safeValue = escapePdfText(value);
  const textWidthOffset = align === 'right' ? estimateTextWidth(value, size) : 0;
  const drawX = align === 'right' ? x - textWidthOffset : x;

  page.commands.push(
    `BT /${font} ${size} Tf ${color[0]} ${color[1]} ${color[2]} rg 1 0 0 1 ${drawX} ${PAGE_HEIGHT - yTop} Tm (${safeValue}) Tj ET`,
  );
}

function serializePdf(objects: string[]) {
  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((objectBody, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${objectBody}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');

  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
}

function wrapText(value: string, maxCharactersPerLine: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length > maxCharactersPerLine && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    currentLine = candidate;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function estimateTextWidth(value: string, size: number) {
  return value.length * (size * 0.5);
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(value);
}

function formatDateTimeCompact(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatOptionalMoney(value: number | null) {
  return value === null ? '-' : formatMoney(value);
}
