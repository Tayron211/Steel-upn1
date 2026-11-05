import { jsPDF } from 'jspdf';

/**
 * Generates an official "Acta de Cargo" PDF matching the exact UPN format
 * with double-bordered frame, Cargo N°, Señor(es), Remitimos con el portador,
 * Fecha/Hora, and both digital signatures (Entregué & Recibí conforme).
 * 
 * Formato rectangular alargado tipo vale/comprobante físico (210mm x 96mm)
 * sin espacios en blanco excesivos y sin superposición de texto.
 */
export function generateCargoPdf({
  ticket,
  entregadoPor,
  recibidoPor,
  firmaEntrega,
  firmaRecepcion
}) {
  // Formato rectangular apaisado de vale de cargo (210mm x 96mm)
  const pageWidth = 210;
  const pageHeight = 96;
  const m = 8; // margen perimetral

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [pageWidth, pageHeight]
  });

  // Color de trazo institucional azul marino (#183153)
  const lineColor = [24, 49, 83];
  doc.setDrawColor(...lineColor);
  doc.setTextColor(15, 23, 42);

  // 1. Marco exterior redondeado
  doc.setLineWidth(0.75);
  doc.roundedRect(m, m, pageWidth - m * 2, pageHeight - m * 2, 5, 5);

  // 2. Marco interior (doble línea reglamentaria)
  doc.setLineWidth(0.35);
  doc.roundedRect(m + 1.5, m + 1.5, pageWidth - m * 2 - 3, pageHeight - m * 2 - 3, 3.8, 3.8);

  const rightEdge = pageWidth - m - 6; // 196 mm (dentro del doble borde)

  // 3. Marca superior izquierda UPN
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('UNIVERSIDAD PRIVADA DEL NORTE · OPERACIONES SEDE', m + 5, m + 7.5);

  // 4. Cargo N° [ _______ ]
  const cargoNum = (ticket.id || '').replace(/^ticket_/, 'CARGO-').slice(-8).toUpperCase();
  doc.setTextColor(...lineColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('Cargo N°', pageWidth - m - 54, m + 8);

  // Casilla redondeada para el número de cargo
  doc.setLineWidth(0.4);
  doc.roundedRect(pageWidth - m - 34, m + 3, 30, 7.5, 2, 2);
  doc.setFont('courier', 'bold');
  doc.setFontSize(10.5);
  doc.text(cargoNum, pageWidth - m - 19, m + 8.2, { align: 'center' });

  // 5. Campo: Señor(es)
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const labelSenor = 'Señor(es)';
  doc.text(labelSenor, m + 5, m + 18);

  const senorLabelW = doc.getTextWidth(labelSenor) + 3;
  const senorStartX = m + 5 + senorLabelW;
  const recipientName = (recibidoPor || ticket.recibidoPor || 'Docente / Solicitante').toUpperCase();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const senorMaxW = rightEdge - senorStartX;
  const senorLines = doc.splitTextToSize(recipientName, senorMaxW);
  doc.text(senorLines[0] || '', senorStartX, m + 17.5);

  // Subrayado de Señor(es)
  doc.setLineWidth(0.35);
  doc.line(senorStartX - 1, m + 19, rightEdge, m + 19);

  // 6. Campo: Remitimos con el portador
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const labelPortador = 'Remitimos con el portador';
  doc.text(labelPortador, m + 5, m + 27.5);

  // IMPORTANTE: Medir labelWidth MIENTRAS la fuente helvetica bold 11pt está activa
  // para que el texto subsiguiente NUNCA se monte sobre "portador"
  const labelWidth = doc.getTextWidth(labelPortador) + 3;
  const line1StartX = m + 5 + labelWidth;

  const cleanDesc = (ticket.descripcionSolucion || ticket.tipoSolicitud || 'Materiales y equipos de aula')
    .replace(/\[(🎓|👨‍🏫)?\s*(ALUMNO|DOCENTE)(?::[^\]]+)?\]/gi, '')
    .trim();

  let itemDetail = cleanDesc;
  if (ticket.tipoSolicitud && !itemDetail.toUpperCase().includes(ticket.tipoSolicitud.toUpperCase())) {
    itemDetail = `${ticket.tipoSolicitud} - ${itemDetail}`;
  }
  const roomPrefix = ticket.ambiente && ticket.ambiente !== 'DOCENCIA' && ticket.ambiente !== 'SEDE' && ticket.ambiente !== 'GENERAL'
    ? `[Aula ${ticket.ambiente}] `
    : (ticket.ambiente === 'DOCENCIA' ? '[Docencia Sede] ' : '');
  const rawItemText = `${roomPrefix}${itemDetail}`.toUpperCase();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);

  const line1MaxW = rightEdge - line1StartX;
  const subsequentMaxW = rightEdge - (m + 5);

  // Salto de línea inteligente por palabras
  const words = rawItemText.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const testLine = currentLine ? `${currentLine} ${w}` : w;
    const maxWForThisLine = lines.length === 0 ? line1MaxW : subsequentMaxW;

    if (doc.getTextWidth(testLine) <= maxWForThisLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = w;
      } else {
        lines.push(testLine);
        currentLine = '';
      }
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  // Dibuja al menos 2 renglones con sus subrayados completos
  const totalRenglones = Math.max(2, Math.min(lines.length, 3));
  const startRenglonY = m + 27;
  const renglonSpacing = 8.5; // Espaciado vertical óptimo para vale rectangular

  for (let r = 0; r < totalRenglones; r++) {
    const rY = startRenglonY + r * renglonSpacing;
    const textOnRenglon = lines[r] || '';

    doc.setLineWidth(0.35);
    if (r === 0) {
      if (textOnRenglon) {
        doc.text(textOnRenglon, line1StartX, rY);
      }
      doc.line(line1StartX - 1, rY + 1.5, rightEdge, rY + 1.5);
    } else {
      if (textOnRenglon) {
        doc.text(textOnRenglon, m + 5, rY);
      }
      doc.line(m + 5, rY + 1.5, rightEdge, rY + 1.5);
    }
  }

  // 7. Pie de Firmas y Fecha/Hora (Alineado proporcionalmente en formato rectangular)
  const footerY = 73;

  // --- Izquierda: ENTREGUÉ (Operaciones Sede) ---
  const leftX = m + 10;
  const leftWidth = 50;

  if (firmaEntrega) {
    try {
      doc.addImage(firmaEntrega, 'PNG', leftX + 2, footerY - 17, leftWidth - 4, 15);
    } catch (e) {
      console.warn('Error adding firmaEntrega to PDF', e);
    }
  }

  doc.setLineWidth(0.4);
  doc.line(leftX, footerY, leftX + leftWidth, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Entregué', leftX + leftWidth / 2, footerY + 4, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text((entregadoPor || ticket.entregadoPor || 'OPERACIONES SEDE').slice(0, 30), leftX + leftWidth / 2, footerY + 7.5, { align: 'center' });

  // --- Centro: FECHA y HORA ---
  const centerX = pageWidth / 2;
  doc.setTextColor(15, 23, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Fecha', centerX, footerY - 9, { align: 'center' });

  // Casilla de Fecha
  const dateStr = ticket.fecha || new Date().toISOString().split('T')[0];
  doc.setLineWidth(0.35);
  doc.roundedRect(centerX - 16, footerY - 7.5, 32, 6.5, 1.5, 1.5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text(dateStr, centerX, footerY - 3.2, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const timeStr = ticket.horaReporte || '--:--';
  doc.text(`Hora:  ${timeStr}`, centerX, footerY + 5, { align: 'center' });

  // --- Derecha: RECIBÍ CONFORME (Docente / Alumno) ---
  const rightX = pageWidth - m - 10 - leftWidth;

  if (firmaRecepcion) {
    try {
      doc.addImage(firmaRecepcion, 'PNG', rightX + 2, footerY - 17, leftWidth - 4, 15);
    } catch (e) {
      console.warn('Error adding firmaRecepcion to PDF', e);
    }
  }

  doc.setLineWidth(0.4);
  doc.line(rightX, footerY, rightX + leftWidth, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text('Recibí conforme', rightX + leftWidth / 2, footerY + 4, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(recipientName.slice(0, 30), rightX + leftWidth / 2, footerY + 7.5, { align: 'center' });

  // Descarga directa del comprobante
  const fileName = `Acta_Cargo_${ticket.ambiente || 'DOCENCIA'}_${cargoNum}.pdf`;
  doc.save(fileName);
}
