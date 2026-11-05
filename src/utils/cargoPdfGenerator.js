import { jsPDF } from 'jspdf';

/**
 * Generates an official "Acta de Cargo" PDF matching the exact UPN format
 * with double-bordered frame, Cargo N°, Señor(es), Remitimos con el portador,
 * Fecha/Hora, and both digital signatures (Entregué & Recibí conforme).
 */
export function generateCargoPdf({
  ticket,
  entregadoPor,
  recibidoPor,
  firmaEntrega,
  firmaRecepcion
}) {
  // A5 Landscape (210mm x 148mm) - Perfect voucher / slip format
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a5'
  });

  const pageWidth = 210;
  const pageHeight = 148;
  const m = 12; // margin

  // Primary Navy/Slate line color from format (#1e3a5f)
  const lineColor = [24, 49, 83];
  doc.setDrawColor(...lineColor);
  doc.setTextColor(15, 23, 42);

  // 1. Outer Rounded Rectangle
  doc.setLineWidth(0.8);
  doc.roundedRect(m, m, pageWidth - m * 2, pageHeight - m * 2, 6, 6);

  // 2. Inner Rounded Rectangle (Double Border)
  doc.setLineWidth(0.35);
  doc.roundedRect(m + 1.8, m + 1.8, pageWidth - m * 2 - 3.6, pageHeight - m * 2 - 3.6, 4.5, 4.5);

  // 3. Top Right: Cargo N° [ _______ ]
  const cargoNum = (ticket.id || '').replace(/^ticket_/, 'CARGO-').slice(-8).toUpperCase();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('Cargo N°', pageWidth - m - 58, m + 15);

  // Rounded box for Cargo Number
  doc.setLineWidth(0.4);
  doc.roundedRect(pageWidth - m - 36, m + 8, 30, 9, 2, 2);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text(cargoNum, pageWidth - m - 21, m + 14, { align: 'center' });

  // Optional subtle UPN header watermark / small label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('UNIVERSIDAD PRIVADA DEL NORTE · OPERACIONES SEDE', m + 6, m + 12);

  // 4. Field: Señor(es)
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Señor(es)', m + 8, m + 28);

  const recipientName = (recibidoPor || ticket.recibidoPor || 'Docente / Solicitante').toUpperCase();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(recipientName, m + 32, m + 27.5);

  // Underline for Señor(es)
  doc.setLineWidth(0.3);
  doc.line(m + 30, m + 29, pageWidth - m - 8, m + 29);

  // 5. Field: Remitimos con el portador
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Remitimos con el portador', m + 8, m + 42);

  const cleanDesc = (ticket.descripcionSolucion || ticket.tipoSolicitud || 'Materiales y equipos de aula')
    .replace(/\[(🎓|👨‍🏫)?\s*(ALUMNO|DOCENTE)(?::[^\]]+)?\]/gi, '')
    .trim();
  const itemText = `[Aula ${ticket.ambiente || 'General'}] ${ticket.tipoSolicitud} - ${cleanDesc}`.toUpperCase();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(itemText.slice(0, 75), m + 64, m + 41.5);

  // Underline for Remitimos con el portador
  doc.line(m + 62, m + 43, pageWidth - m - 8, m + 43);

  // 6. Signatures & Date/Time Footer (Positioned near bottom)
  const footerY = pageHeight - m - 24;

  // --- Left: ENTREGUÉ (Asistente / Operaciones) ---
  const leftX = m + 12;
  const leftWidth = 52;

  // Embed Delivery Signature Image if available
  if (firmaEntrega) {
    try {
      doc.addImage(firmaEntrega, 'PNG', leftX + 4, footerY - 22, leftWidth - 8, 19);
    } catch (e) {
      console.warn('Error adding firmaEntrega to PDF', e);
    }
  }

  // Line for Entregué
  doc.setLineWidth(0.4);
  doc.line(leftX, footerY, leftX + leftWidth, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Entregué', leftX + leftWidth / 2, footerY + 5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text((entregadoPor || ticket.entregadoPor || 'Operaciones Sede').slice(0, 28), leftX + leftWidth / 2, footerY + 9, { align: 'center' });

  // --- Center: FECHA y HORA ---
  const centerX = pageWidth / 2;
  doc.setTextColor(15, 23, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Fecha', centerX, footerY - 12, { align: 'center' });

  // Rounded Box for Date
  const dateStr = ticket.fecha || new Date().toISOString().split('T')[0];
  doc.setLineWidth(0.35);
  doc.roundedRect(centerX - 17, footerY - 10, 34, 7.5, 1.8, 1.8);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.text(dateStr, centerX, footerY - 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const timeStr = ticket.horaReporte || '--:--';
  doc.text(`Hora:  ${timeStr}`, centerX, footerY + 5, { align: 'center' });

  // --- Right: RECIBÍ CONFORME (Docente / Alumno) ---
  const rightX = pageWidth - m - 12 - leftWidth;

  // Embed Recipient Signature Image if available
  if (firmaRecepcion) {
    try {
      doc.addImage(firmaRecepcion, 'PNG', rightX + 4, footerY - 22, leftWidth - 8, 19);
    } catch (e) {
      console.warn('Error adding firmaRecepcion to PDF', e);
    }
  }

  // Line for Recibí conforme
  doc.setLineWidth(0.4);
  doc.line(rightX, footerY, rightX + leftWidth, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Recibí conforme', rightX + leftWidth / 2, footerY + 5, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(recipientName.slice(0, 28), rightX + leftWidth / 2, footerY + 9, { align: 'center' });

  // Trigger browser download
  const fileName = `Acta_Cargo_${ticket.ambiente || 'AULA'}_${cargoNum}.pdf`;
  doc.save(fileName);
}
