const XLSX = require('xlsx');

function exportToExcelBuffer(data) {
  const wb = XLSX.utils.book_new();

  // 1. CONTROL ASISTENCIA
  const asistHeaders = [
    "PISO/PABELLON", "SEDE", "PERIODO", "DÍAS", "HORA INICIO PROGRAMADA",
    "HORA FINAL PROGRAMADA", "AULA", "NRC.", "LISTA CRUZADA", "CÓDIGO DE DOCENTE",
    "DOCENTE", "CURSO", "CARRERA", "HORA INICIO REAL", "HORA FINAL REAL",
    "ASISTENCIA", "PUNTUALIDAD", "OBSERVACIÓN", "REAL", "CICLO"
  ];
  const asistRows = [asistHeaders];
  data.asistencia.forEach(a => {
    asistRows.push([
      a.pisoPabellon, a.sede, a.periodo, a.dia, a.horaInicioProg,
      a.horaFinalProg, a.aula, a.nrc, a.listaCruzada, a.codigoDocente,
      a.docente, a.curso, a.carrera, a.horaInicioReal, a.horaFinalReal,
      a.asistencia, a.puntualidad, a.observacion, a.real, a.ciclo
    ]);
  });
  const wsAsist = XLSX.utils.aoa_to_sheet(asistRows);
  XLSX.utils.book_append_sheet(wb, wsAsist, "CONTROL ASISTENCIA");

  // 2. ATENCIONES
  const ticketHeaders = [
    "FECHA", "DIA", "HORA DE REPORTE", "RANGO", "AMBIENTE",
    "PISO", "PABELLÓN", "TIPO DE SOLICITUD", "ESTADO",
    "DESCRIPCIÓN / SOLUCIÓN", "RESPONSABLE"
  ];
  const ticketRows = [ticketHeaders];
  data.tickets.forEach(t => {
    ticketRows.push([
      t.fecha, t.dia, t.horaReporte, t.rango, t.ambiente,
      t.piso, t.pabellon, t.tipoSolicitud, t.estado,
      t.descripcionSolucion, t.responsable
    ]);
  });
  const wsTickets = XLSX.utils.aoa_to_sheet(ticketRows);
  XLSX.utils.book_append_sheet(wb, wsTickets, "ATENCIONES");

  // 3. HOJA DE ASISTENCIA MANUAL
  const manualHeaders = [
    "CÓDIGO", "FECHA", "NRC", "DOCENTE", "CURSO", "CARRERA", "MOTIVO", "ASISTENTE"
  ];
  const manualRows = [manualHeaders];
  data.manualSheets.forEach(m => {
    manualRows.push([
      m.codigo, m.fecha, m.nrc, m.docente, m.curso, m.carrera, m.motivo, m.asistente
    ]);
  });
  const wsManual = XLSX.utils.aoa_to_sheet(manualRows);
  XLSX.utils.book_append_sheet(wb, wsManual, "HOJAS MANUALES");

  // 4. RESERVAS
  const reservaHeaders = [
    "FECHA", "MES", "DIA", "INICIO", "FINAL", "AULA",
    "UBICACIÓN", "DOCENTE", "DETALLE", "USUARIO", "PRIORIDAD"
  ];
  const reservaRows = [reservaHeaders];
  data.reservas.forEach(r => {
    reservaRows.push([
      r.fecha, r.mes, r.dia, r.inicio, r.final, r.aula,
      r.ubicacion, r.docente, r.detalle, r.usuario, r.prioridad
    ]);
  });
  const wsRes = XLSX.utils.aoa_to_sheet(reservaRows);
  XLSX.utils.book_append_sheet(wb, wsRes, "RESERVAS");

  // 5. AMBIENTES
  const ambHeaders = ["ABRV", "NOMBRE", "PC", "AFORO", "PABELLON", "PISO", "TIPO"];
  const ambRows = [ambHeaders];
  data.ambientes.forEach(a => {
    ambRows.push([
      a.abrv, a.nombre, a.pc, a.aforo, a.pabellon, a.piso, a.tipo
    ]);
  });
  const wsAmb = XLSX.utils.aoa_to_sheet(ambRows);
  XLSX.utils.book_append_sheet(wb, wsAmb, "AMBIENTES");

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { exportToExcelBuffer };

