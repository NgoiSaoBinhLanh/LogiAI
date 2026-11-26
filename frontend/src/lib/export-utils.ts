let cachedFontBase64: string | null = null;

async function loadRobotoBase64(): Promise<string | null> {
  if (cachedFontBase64) return cachedFontBase64;
  try {
    const res = await fetch('/fonts/Roboto-Regular.ttf');
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    cachedFontBase64 = btoa(binary);
    return cachedFontBase64;
  } catch {
    return null;
  }
}

export async function exportToExcel(
  filename: string,
  sheetName: string,
  rows: Array<Record<string, string | number | boolean | null | undefined>>
): Promise<void> {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export async function exportToPdf(
  filename: string,
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }, fontBase64] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadRobotoBase64(),
  ]);

  const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' });

  if (fontBase64) {
    doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto', 'normal');
  }

  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`Ngày xuất: ${new Date().toLocaleString('vi-VN')}`, 14, 23);

  autoTable(doc, {
    startY: 28,
    head: [headers],
    body: rows,
    styles: {
      font: fontBase64 ? 'Roboto' : 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.5,
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      font: fontBase64 ? 'Roboto' : 'helvetica',
      fontStyle: 'normal',
    },
  });

  doc.save(`${filename}.pdf`);
}

export async function parseExcelRows(
  file: File
): Promise<Array<Record<string, unknown>>> {
  const [XLSX, buffer] = await Promise.all([import('xlsx'), file.arrayBuffer()]);
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  const sheet = workbook.Sheets[firstSheet];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
}
