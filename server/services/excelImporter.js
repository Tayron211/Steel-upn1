const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

function formatExcelTime(val) {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') {
    if (val < 1) {
      const totalMinutes = Math.round(val * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    } else {
      // Sometimes time has a date portion
      const frac = val - Math.floor(val);
      if (frac > 0) {
        const totalMinutes = Math.round(frac * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      }
    }
  }
  return String(val);
}

function formatExcelDate(val) {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') {
    if (val > 20000 && val < 60000) {
      // Valid Excel date serial
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    return String(val);
  }
  return String(val);
}

function importExcelData(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo Excel no encontrado en: ${filePath}`);
  }

  // Read with read-only options to guarantee master file is never modified
  const wb = XLSX.readFile(filePath, { cellDates: false });

  // 1. CONTROL ASISTENCIA
  const sheetAsistencia = wb.Sheets['CONTROL ASISTENCIA'];
  const rawAsistencia = XLSX.utils.sheet_to_json(sheetAsistencia, { header: 1 });
  const asistenciaList = [];

  for (let i = 1; i < rawAsistencia.length; i++) {
    const r = rawAsistencia[i];
    if (!r || !r[6] || !r[10]) continue; // Needs at least AULA and DOCENTE

    asistenciaList.push({
      id: `asist_${i}`,
      pisoPabellon: r[0] ? String(r[0]).trim() : '',
      sede: r[1] ? String(r[1]).trim() : 'Comas',
      periodo: r[2] ? String(r[2]).trim() : '2026-2',
      dia: r[3] ? String(r[3]).trim().toUpperCase() : '',
      horaInicioProg: formatExcelTime(r[4]),
      horaFinalProg: formatExcelTime(r[5]),
      aula: r[6] ? String(r[6]).trim() : '',
      nrc: r[7] ? String(r[7]).trim() : '',
      listaCruzada: r[8] ? String(r[8]).trim() : '',
      codigoDocente: r[9] ? String(r[9]).trim() : '',
      docente: r[10] ? String(r[10]).trim() : '',
      curso: r[11] ? String(r[11]).trim() : '',
      carrera: r[12] ? String(r[12]).trim() : '',
      horaInicioReal: formatExcelTime(r[13]),
      horaFinalReal: formatExcelTime(r[14]),
      asistencia: r[15] ? String(r[15]).trim().toUpperCase() : 'PENDIENTE',
      puntualidad: r[16] ? String(r[16]).trim().toUpperCase() : '-',
      observacion: r[17] ? String(r[17]).trim() : '',
      real: r[18] !== undefined ? Number(r[18]) : null,
      ciclo: r[19] !== undefined ? String(r[19]).trim() : ''
    });
  }

  // 2. ATENCIONES (Combining 2026-2 and 2026-1)
  const ticketsList = [];
  ['ATENCIONES 2026-2', 'ATENCIONES 2026-1'].forEach((sName) => {
    const s = wb.Sheets[sName];
    if (!s) return;
    const raw = XLSX.utils.sheet_to_json(s, { header: 1 });
    // Header is row 1
    for (let i = 2; i < raw.length; i++) {
      const r = raw[i];
      if (!r || (!r[4] && !r[7])) continue;

      const dateStr = formatExcelDate(r[0]);
      ticketsList.push({
        id: `ticket_${sName.includes('2026-2') ? '2' : '1'}_${i}`,
        periodo: sName.includes('2026-2') ? '2026-2' : '2026-1',
        fecha: dateStr,
        dia: r[1] ? String(r[1]).trim().toUpperCase() : '',
        horaReporte: formatExcelTime(r[2]),
        rango: r[3] ? String(r[3]).trim() : '',
        ambiente: r[4] ? String(r[4]).trim() : '',
        piso: r[5] ? String(r[5]).trim() : '',
        pabellon: r[6] ? String(r[6]).trim() : '',
        tipoSolicitud: r[7] ? String(r[7]).trim() : 'Soporte General',
        estado: r[8] ? String(r[8]).trim().toUpperCase() : 'PENDIENTE',
        descripcionSolucion: r[9] ? String(r[9]).trim() : '',
        responsable: r[10] ? String(r[10]).trim() : 'Sin Asignar'
      });
    }
  });

  // 3. HOJA DE ASISTENCIA MANUAL
  const manualSheetsList = [];
  ['HOJA DE ASISTENCIA 2026-2', 'HOJA DE ASISTENCIA 2026-1'].forEach(sName => {
    const s = wb.Sheets[sName];
    if (!s) return;
    const raw = XLSX.utils.sheet_to_json(s, { header: 1 });
    for (let i = 2; i < raw.length; i++) {
      const r = raw[i];
      if (!r || !r[0]) continue;
      const hasContent = (r[2] && String(r[2]).trim()) || (r[3] && String(r[3]).trim()) || (r[4] && String(r[4]).trim());
      if (!hasContent) continue;
      manualSheetsList.push({
        id: `manual_${sName.includes('2026-2') ? '2' : '1'}_${i}`,
        periodo: sName.includes('2026-2') ? '2026-2' : '2026-1',
        codigo: String(r[0]).trim(),
        fecha: formatExcelDate(r[1]),
        nrc: r[2] ? String(r[2]).trim() : '',
        docente: r[3] ? String(r[3]).trim() : '',
        curso: r[4] ? String(r[4]).trim() : '',
        carrera: r[5] ? String(r[5]).trim() : '',
        motivo: r[6] ? String(r[6]).trim() : '',
        asistente: r[7] ? String(r[7]).trim() : ''
      });
    }
  });

  // 4. RESERVAS
  const reservasList = [];
  const sRes = wb.Sheets['RESERVAS'];
  if (sRes) {
    const rawRes = XLSX.utils.sheet_to_json(sRes, { header: 1 });
    // Headers start around row 3
    for (let i = 4; i < rawRes.length; i++) {
      const r = rawRes[i];
      if (!r || (!r[1] && !r[6])) continue;
      reservasList.push({
        id: `reserva_${i}`,
        fecha: formatExcelDate(r[1]),
        mes: r[2] ? String(r[2]).trim().toUpperCase() : '',
        dia: r[3] ? String(r[3]).trim().toUpperCase() : '',
        inicio: formatExcelTime(r[4]),
        final: formatExcelTime(r[5]),
        aula: r[6] ? String(r[6]).trim() : '',
        ubicacion: r[7] ? String(r[7]).trim() : '',
        docente: r[8] ? String(r[8]).trim() : '',
        detalle: r[9] ? String(r[9]).trim() : '',
        usuario: r[10] ? String(r[10]).trim() : '',
        prioridad: r[11] ? String(r[11]).trim().toUpperCase() : 'NORMAL'
      });
    }
  }

  // 5. AMBIENTES & UBICACION AULAS
  const ambientesMap = new Map();
  const sAmb = wb.Sheets['AMBIENTES'];
  if (sAmb) {
    const rawAmb = XLSX.utils.sheet_to_json(sAmb, { header: 1 });
    for (let i = 2; i < rawAmb.length; i++) {
      const r = rawAmb[i];
      if (!r || !r[1]) continue;
      const abrv = r[2] ? String(r[2]).trim() : String(r[1]).trim();
      ambientesMap.set(abrv, {
        abrv,
        nombre: String(r[1]).trim(),
        pc: null, // Column 0 in Excel is only an item counter, not real PC count
        aforo: typeof r[3] === 'number' ? r[3] : 30,
        pabellon: r[4] ? String(r[4]).trim() : '',
        piso: r[5] ? String(r[5]).trim() : '',
        ubicacion: r[6] ? String(r[6]).trim() : '',
        tipo: r[7] ? String(r[7]).trim() : 'AULA REGULAR'
      });
    }
  }

  const sUbic = wb.Sheets['UBICACION AULAS'];
  if (sUbic) {
    const rawUbic = XLSX.utils.sheet_to_json(sUbic, { header: 1 });
    for (let i = 1; i < rawUbic.length; i++) {
      const r = rawUbic[i];
      if (!r || !r[0]) continue;
      const abrv = String(r[0]).trim();
      if (!ambientesMap.has(abrv)) {
        ambientesMap.set(abrv, {
          abrv,
          ubicacion: r[1] ? String(r[1]).trim() : '',
          nombre: r[2] ? String(r[2]).trim() : abrv,
          aforo: typeof r[3] === 'number' ? r[3] : 30,
          pabellon: abrv.startsWith('B') ? 'B' : 'A',
          piso: r[1] ? String(r[1]).trim() : '',
          tipo: 'AULA'
        });
      }
    }
  }

  // 6. CATÁLOGOS / LISTAS
  const catalogo = {
    motivosIncidencias: [
      "CLASE ADELANTADA",
      "CLASE FUERA DE CAMPUS",
      "DISTANCIA/TRÁFICO VEHICULAR",
      "DOCENTE DE LICENCIA",
      "MOTIVO DE DUELO",
      "MOTIVO DE SALUD",
      "MOTIVO DE VIAJE",
      "MOTIVO LABORAL",
      "MOTIVO PERSONAL",
      "CLASE REMOTA",
      "SALUD FAMILIAR",
      "SOLICITUD DE ESTUDIANTES",
      "RESERVA MANUAL",
      "DOCENTE REEMPLAZO",
      "OTRO (ESPECIFICAR)"
    ],
    tiposSolicitudTicket: [
      "PROYECCIÓN",
      "AULA HIBRIDA",
      "INTERNET / WIFI",
      "APERTURA DE AMBIENTE",
      "INFRAESTRUCTURA (Luminaria, Clima)",
      "PC / PERIFERICOS",
      "SOFTWARE",
      "PLATAFORMAS (INTRANET - BLACKBOARD)",
      "PRESTAMO DE AMBIENTE",
      "OBJETOS REPORTADOS",
      "REQUERIMIENTOS EVENTUALES",
      "ASISTENCIA SUMADI"
    ],
    estadosTicket: ["PENDIENTE", "EN PROCESO", "ATENDIDO"],
    responsables: [
      "JOSE MIRANDA",
      "FRANCISCO VILLAFAN",
      "JHONAYKER MAGUIÑA",
      "ANTHONY PALOMINO",
      "JAEL GALLARDO",
      "ALESSANDRO PASCUAL",
      "JAVIER BENITES",
      "JANETH VIVAR"
    ],
    motivosHojaManual: [
      "DOCENTE SIN ACCESOS",
      "PROBLEMA CON AUTENTICADOR",
      "PROBLEMA CON EL SISTEMA",
      "CLASE NO FIGURA EN EL PORTAL",
      "DOCENTE DE REEMPLAZO",
      "RECUPERACIÓN DE CLASE",
      "ADELANTO DE CLASE",
      "ASISTENCIA DE ESTUDIANTES"
    ]
  };

  return {
    asistencia: asistenciaList,
    tickets: ticketsList,
    manualSheets: manualSheetsList,
    reservas: reservasList,
    ambientes: Array.from(ambientesMap.values()),
    catalogo
  };
}

module.exports = { importExcelData };

