import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';

const DAYS_ES = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const MONTHS_ES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

export function escapeXml(val) {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Convierte "YYYY-MM-DD" o "DD/MM/YYYY" a número de serie de fecha de Excel (ej. 46296)
export function dateToExcelSerial(dateStr) {
  if (!dateStr) return null;
  if (typeof dateStr === 'number') return dateStr;
  const s = String(dateStr).trim();
  let yyyy, mm, dd;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    [yyyy, mm, dd] = s.split('T')[0].split('-').map(Number);
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    [dd, mm, yyyy] = s.split('/').map(Number);
  } else {
    return null;
  }
  if (!yyyy || !mm || !dd) return null;
  const utcMs = Date.UTC(yyyy, mm - 1, dd);
  return Math.round(utcMs / 86400000) + 25569;
}

// Convierte "HH:MM" a fracción de día de Excel (ej. "07:30" -> 0.3125)
export function timeToExcelFraction(timeStr) {
  if (timeStr === undefined || timeStr === null || timeStr === '') return null;
  if (typeof timeStr === 'number') return timeStr;
  const s = String(timeStr).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (isNaN(hh) || isNaN(mm)) return null;
  return (hh * 60 + mm) / (24 * 60);
}

// Obtiene el rango horario estilo "09:00 – 10:00" a partir de "09:15"
function computeRangoStr(timeStr) {
  const s = String(timeStr || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  const hh = parseInt(m[1], 10);
  const nextH = (hh + 1) % 24;
  return `${String(hh).padStart(2, '0')}:00 – ${String(nextH).padStart(2, '0')}:00`;
}

function getDayAndMonthFromDateStr(dateStr) {
  if (!dateStr) return { dia: '', mes: '' };
  const s = String(dateStr).trim().split('T')[0];
  const parts = s.split('-').map(Number);
  if (parts.length !== 3) return { dia: '', mes: '' };
  const dt = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  return {
    dia: DAYS_ES[dt.getDay()] || '',
    mes: MONTHS_ES[dt.getMonth()] || ''
  };
}

// Constructores de celdas OpenXML preservando el índice de estilo `s` original de CONTROL DOCENTE.xlsx
function xmlCellEmpty(ref, styleId) {
  return `<c r="${ref}" s="${styleId}"/>`;
}

function xmlCellString(ref, styleId, text) {
  if (text === undefined || text === null || String(text) === '') {
    return xmlCellEmpty(ref, styleId);
  }
  const str = String(text);
  const preserve = /^\s|\s$|\n/.test(str) ? ' xml:space="preserve"' : '';
  return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t${preserve}>${escapeXml(str)}</t></is></c>`;
}

function xmlCellNumber(ref, styleId, num) {
  if (num === undefined || num === null || num === '' || Number.isNaN(Number(num))) {
    return xmlCellEmpty(ref, styleId);
  }
  return `<c r="${ref}" s="${styleId}"><v>${Number(num)}</v></c>`;
}

function xmlCellFormulaStr(ref, styleId, formulaXml, cachedText) {
  const cached = cachedText !== undefined && cachedText !== null ? `<v>${escapeXml(String(cachedText))}</v>` : '';
  return `<c r="${ref}" s="${styleId}" t="str"><f>${formulaXml}</f>${cached}</c>`;
}

/**
 * Reconstruye <sheetData> de CONTROL ASISTENCIA (xl/worksheets/sheet5.xml)
 * Conservando los estilos exactos por columna y cebra (fila par / fila impar) del modelo original.
 */
function updateControlAsistenciaXml(sheetXml, asistenciaList) {
  const row1Match = sheetXml.match(/<row r="1"[\s\S]*?<\/row>/);
  if (!row1Match) return { xml: sheetXml, lastRow: 2 };
  const row1Xml = row1Match[0];

  // Ordenar manteniendo el orden original asist_1, asist_2, ...
  const sorted = [...(asistenciaList || [])].sort((a, b) => {
    const na = parseInt(String(a.id || '').replace(/\D+/g, ''), 10) || 999999;
    const nb = parseInt(String(b.id || '').replace(/\D+/g, ''), 10) || 999999;
    return na - nb;
  });

  const rowsXml = [row1Xml];

  sorted.forEach((item, idx) => {
    const r = idx + 2;
    const isEven = r % 2 === 0;

    // Estilos exactos de CONTROL DOCENTE.xlsx (Fila par vs Fila impar)
    const st = isEven
      ? { A: 114, B: 253, C: 253, D: 253, E: 112, F: 112, G: 253, H: 253, I: 253, J: 256, K: 256, L: 260, M: 266, N: 274, O: 112, P: 258, Q: 205, R: 309, S: 254, T: 259 }
      : { A: 254, B: 113, C: 113, D: 113, E: 255, F: 255, G: 113, H: 113, I: 113, J: 257, K: 257, L: 261, M: 266, N: 274, O: 112, P: 258, Q: 205, R: 56,  S: 254, T: 259 };

    const pisoPab = item.pisoPabellon || item.piso_pabellon || '';
    const sede = item.sede || 'Comas';
    const periodoRaw = item.periodo || '226434';
    const dia = item.dia || '';
    const hIniProg = timeToExcelFraction(item.horaInicioProg || item.hora_inicio_prog);
    const hFinProg = timeToExcelFraction(item.horaFinalProg || item.hora_final_prog);
    const aula = item.aula || '';
    const nrcRaw = item.nrc ?? '';
    const listaCruzada = item.listaCruzada || item.lista_cruzada || '\u00A0';
    const codDoc = item.codigoDocente || item.codigo_docente || '';
    const docente = item.docente || '';
    const curso = item.curso || '';
    const carrera = item.carrera || '';
    const hIniReal = timeToExcelFraction(item.horaInicioReal || item.hora_inicio_real);
    const hFinReal = timeToExcelFraction(item.horaFinalReal || item.hora_final_real);

    // En el modelo original: PENDIENTE se deja vacío; DOCENTE DE REEMPLAZO se escribe "SI (DOCENTE REEMPLAZO)"
    let asistVal = (item.asistencia || '').toUpperCase().trim();
    if (asistVal === 'PENDIENTE') asistVal = '';
    else if (asistVal.includes('REEMPLAZO')) asistVal = 'SI (DOCENTE REEMPLAZO)';

    let puntVal = (item.puntualidad || '').toUpperCase().trim();
    if (!asistVal && puntVal === '-') puntVal = '';

    const obs = item.observacion || '';
    const realCount = item.real !== undefined && item.real !== null && item.real !== '' ? Number(item.real) : null;
    const ciclo = item.ciclo || '';

    const cPeriodo = /^\d+$/.test(String(periodoRaw).trim())
      ? xmlCellNumber(`C${r}`, st.C, Number(periodoRaw))
      : xmlCellString(`C${r}`, st.C, periodoRaw);

    const cNrc = /^\d+$/.test(String(nrcRaw).trim())
      ? xmlCellNumber(`H${r}`, st.H, Number(nrcRaw))
      : xmlCellString(`H${r}`, st.H, nrcRaw);

    const cells = [
      xmlCellString(`A${r}`, st.A, pisoPab),
      xmlCellString(`B${r}`, st.B, sede),
      cPeriodo,
      xmlCellString(`D${r}`, st.D, dia),
      hIniProg !== null ? xmlCellNumber(`E${r}`, st.E, hIniProg) : xmlCellString(`E${r}`, st.E, item.horaInicioProg || ''),
      hFinProg !== null ? xmlCellNumber(`F${r}`, st.F, hFinProg) : xmlCellString(`F${r}`, st.F, item.horaFinalProg || ''),
      xmlCellString(`G${r}`, st.G, aula),
      cNrc,
      xmlCellString(`I${r}`, st.I, listaCruzada),
      xmlCellString(`J${r}`, st.J, codDoc),
      xmlCellString(`K${r}`, st.K, docente),
      xmlCellString(`L${r}`, st.L, curso),
      xmlCellString(`M${r}`, st.M, carrera),
      hIniReal !== null ? xmlCellNumber(`N${r}`, st.N, hIniReal) : xmlCellEmpty(`N${r}`, st.N),
      hFinReal !== null ? xmlCellNumber(`O${r}`, st.O, hFinReal) : xmlCellEmpty(`O${r}`, st.O),
      xmlCellString(`P${r}`, st.P, asistVal),
      xmlCellString(`Q${r}`, st.Q, puntVal),
      xmlCellString(`R${r}`, st.R, obs),
      realCount !== null ? xmlCellNumber(`S${r}`, st.S, realCount) : xmlCellEmpty(`S${r}`, st.S),
      xmlCellString(`T${r}`, st.T, ciclo)
    ].join('');

    rowsXml.push(`<row r="${r}" spans="1:20">${cells}</row>`);
  });

  const lastRow = Math.max(2, sorted.length + 1);
  let updated = sheetXml.replace(
    /<sheetData>[\s\S]*?<\/sheetData>/,
    `<sheetData>${rowsXml.join('')}</sheetData>`
  );
  updated = updated.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:T${lastRow}"/>`);
  updated = updated.replace(/sqref="Q2:Q\d+"/, `sqref="Q2:Q${lastRow}"`);
  updated = updated.replace(/<xm:sqref>P2:P\d+<\/xm:sqref>/, `<xm:sqref>P2:P${lastRow}</xm:sqref>`);
  updated = updated.replace(/<xm:sqref>Q2:Q\d+<\/xm:sqref>/, `<xm:sqref>Q2:Q${lastRow}</xm:sqref>`);

  return { xml: updated, lastRow };
}

/**
 * Reconstruye <sheetData> de ATENCIONES 2026-2 (xl/worksheets/sheet12.xml)
 * Incluye las fórmulas originales de DIA, RANGO y PISO + formato condicional de ESTADO.
 */
function updateAtencionesXml(sheetXml, ticketsList) {
  const row1Match = sheetXml.match(/<row r="1"[\s\S]*?<\/row>/);
  const row2Match = sheetXml.match(/<row r="2"[\s\S]*?<\/row>/);
  if (!row1Match || !row2Match) return { xml: sheetXml, lastRow: 3 };

  const rowsXml = [row1Match[0], row2Match[0]];

  // Filtrar tickets de 2026-2 (o nuevos creados en la app que no sean de 2026-1)
  const list = (ticketsList || []).filter(t => t.periodo !== '2026-1');

  list.forEach((t, idx) => {
    const r = idx + 3;
    const fechaStr = t.fecha || new Date().toISOString().split('T')[0];
    const serialDate = dateToExcelSerial(fechaStr);
    const { dia: diaCalc } = getDayAndMonthFromDateStr(fechaStr);
    const diaCached = (t.dia || diaCalc || 'LUNES').toUpperCase();

    const horaStr = t.horaReporte || t.hora_reporte || '09:00';
    const timeFrac = timeToExcelFraction(horaStr);
    const rangoCached = t.rango || computeRangoStr(horaStr) || '09:00 – 10:00';

    const ambiente = (t.ambiente || 'A201').toUpperCase().trim();
    const pisoCached = (t.piso || 'SEGUNDO PISO').toUpperCase().trim();
    const pabellon = (t.pabellon || (ambiente.startsWith('B') ? 'B' : 'A')).toUpperCase().trim();
    const tipoSol = t.tipoSolicitud || t.tipo_solicitud || 'Soporte General';
    const estado = (t.estado || 'ATENDIDO').toUpperCase().trim();
    const desc = t.descripcionSolucion || t.descripcion_solucion || '';
    const resp = t.responsable || 'Operaciones';

    // Fórmulas exactas de ATENCIONES 2026-2 en CONTROL DOCENTE.xlsx
    const fDia = `UPPER(TEXT(A${r},"dddd"))`;
    const fRango = `TEXT(HOUR(C${r}),"00")&amp;":00 – "&amp;TEXT(MOD(HOUR(C${r})+1,24),"00")&amp;":00"`;
    const fPiso = `VLOOKUP($E${r},AMBIENTES!$C$3:$H$66,4,FALSE)`;

    const cells = [
      serialDate !== null ? xmlCellNumber(`A${r}`, 202, serialDate) : xmlCellString(`A${r}`, 202, fechaStr),
      xmlCellFormulaStr(`B${r}`, 196, fDia, diaCached),
      timeFrac !== null ? xmlCellNumber(`C${r}`, 198, timeFrac) : xmlCellString(`C${r}`, 198, horaStr),
      xmlCellFormulaStr(`D${r}`, 200, fRango, rangoCached),
      xmlCellString(`E${r}`, 200, ambiente),
      xmlCellFormulaStr(`F${r}`, 182, fPiso, pisoCached),
      xmlCellString(`G${r}`, 182, pabellon),
      xmlCellString(`H${r}`, 179, tipoSol),
      xmlCellString(`I${r}`, 193, estado),
      xmlCellString(`J${r}`, 182, desc),
      xmlCellString(`K${r}`, 196, resp),
      xmlCellEmpty(`L${r}`, 207),
      xmlCellEmpty(`M${r}`, 207),
      xmlCellEmpty(`N${r}`, 207),
      xmlCellEmpty(`O${r}`, 207)
    ].join('');

    rowsXml.push(`<row r="${r}" spans="1:15">${cells}</row>`);
  });

  const lastRow = Math.max(3, list.length + 2);
  let updated = sheetXml.replace(
    /<sheetData>[\s\S]*?<\/sheetData>/,
    `<sheetData>${rowsXml.join('')}</sheetData>`
  );
  updated = updated.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:O${lastRow}"/>`);
  updated = updated.replace(/sqref="I3:I\d+"/, `sqref="I3:I${lastRow}"`);
  updated = updated.replace(/<xm:sqref>I3:I\d+<\/xm:sqref>/, `<xm:sqref>I3:I${lastRow}</xm:sqref>`);
  updated = updated.replace(/<xm:sqref>K3:K\d+<\/xm:sqref>/, `<xm:sqref>K3:K${lastRow}</xm:sqref>`);
  updated = updated.replace(/<xm:sqref>E3:E\d+<\/xm:sqref>/, `<xm:sqref>E3:E${lastRow}</xm:sqref>`);

  return { xml: updated, lastRow };
}

/**
 * Extrae el arreglo de cadenas compartidas (sharedStrings.xml) para recuperar valores originales del template
 */
function parseSharedStrings(sstXml) {
  const list = [];
  if (!sstXml) return list;
  const reSi = /<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = reSi.exec(sstXml)) !== null) {
    const tMatches = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)];
    list.push(tMatches.map(x => x[1]).join(''));
  }
  return list;
}

/**
 * Extrae el mapa de valores originales de la Columna I (DOCENTE REEMPLAZANTE) en sheet13.xml
 */
function extractTemplateColIMap(sheetXml, sstList) {
  const map = new Map();
  if (!sheetXml) return map;
  const reCell = /<c r="I(\d+)"([^>]*)>(?:<v>(\d+)<\/v>|<is><t[^>]*>([\s\S]*?)<\/t><\/is>)?<\/c>/g;
  let m;
  while ((m = reCell.exec(sheetXml)) !== null) {
    const rowNum = parseInt(m[1], 10);
    const attrs = m[2] || '';
    if (attrs.includes('t="s"') && m[3] !== undefined) {
      const val = sstList[parseInt(m[3], 10)];
      if (val && val.trim()) map.set(rowNum, val.trim());
    } else if (m[4] !== undefined && m[4].trim()) {
      map.set(rowNum, m[4].trim());
    }
  }
  return map;
}

/**
 * Extrae el nombre del docente reemplazante desde cualquiera de los campos guardados en la BD
 * y limpia el motivo para que en la columna MOTIVO quede "DOCENTE DE REEMPLAZO" y en la columna I el suplente.
 */
function extractReplacementInfo(item, nrcInfo, fallbackColI) {
  let rawDocente = String(item?.docente || '').trim();
  let rawMotivo = String(item?.motivo || '').trim();
  let replacement = String(item?.docente_reemplazo || item?.docenteReemplazo || '').trim();

  // 1. Si viene en docente como "TITULAR [Reemplazo: SUPLENTE]"
  const repDocMatch = rawDocente.match(/^(.*?)\s*\[Reemplazo:\s*(.*?)\]$/i);
  if (repDocMatch) {
    rawDocente = repDocMatch[1].trim();
    if (!replacement) replacement = repDocMatch[2].trim();
  }

  // 2. Si viene en motivo como "DOCENTE DE REEMPLAZO (SUPLENTE)"
  const repMotivoMatch = rawMotivo.match(/REEMPLAZO\s*\(([^)]+)\)/i);
  if (repMotivoMatch) {
    if (!replacement) replacement = repMotivoMatch[1].trim();
    rawMotivo = 'DOCENTE DE REEMPLAZO';
  }

  // 3. Si viene en detalle como "Docente Titular: ... | Reemplaza: SUPLENTE"
  if (!replacement && item?.detalle) {
    const detMatch = String(item.detalle).match(/Reemplaza:\s*(.+)$/i);
    if (detMatch) replacement = detMatch[1].trim();
  }

  // 4. Si se registró reemplazo en CONTROL ASISTENCIA para ese NRC
  if (!replacement && nrcInfo?.reemplazo) {
    replacement = nrcInfo.reemplazo;
  }

  // 5. Fallback al valor histórico de la columna I en la plantilla CONTROL DOCENTE.xlsx
  if (!replacement && fallbackColI) {
    replacement = fallbackColI;
  }

  return {
    cleanDocente: rawDocente,
    cleanMotivo: rawMotivo,
    replacementDocente: replacement.toUpperCase().trim()
  };
}

/**
 * Reconstruye <sheetData> de HOJA DE ASISTENCIA 2026-2 (xl/worksheets/sheet13.xml)
 * Incluye la columna I "DOCENTE REEMPLAZANTE" con encabezado negro (s="26"), celdas con borde (s="104")
 * y las fórmulas VLOOKUP hacia CONTROL ASISTENCIA.
 */
function updateHojasManualesXml(sheetXml, manualSheetsList, nrcLookupMap, sstList = []) {
  const row1Match = sheetXml.match(/<row r="1"[\s\S]*?<\/row>/);
  const row2Match = sheetXml.match(/<row r="2"[\s\S]*?<\/row>/);
  if (!row1Match || !row2Match) return { xml: sheetXml, lastRow: 172 };

  const templateColIMap = extractTemplateColIMap(sheetXml, sstList);

  // Extender Fila 1 (banner amarillo) hasta I1 y agregar "DOCENTE REEMPLAZANTE" en I2 (encabezado negro s="26")
  let row1Xml = row1Match[0]
    .replace('spans="1:8"', 'spans="1:9"')
    .replace('<c r="H1" s="339"/>', '<c r="H1" s="338"/><c r="I1" s="339"/>');

  let row2Xml = row2Match[0].replace('spans="1:8"', 'spans="1:9"');
  if (!row2Xml.includes('r="I2"')) {
    row2Xml = row2Xml.replace(
      '</row>',
      `${xmlCellString('I2', 26, 'DOCENTE REEMPLAZANTE')}</row>`
    );
  }

  const rowsXml = [row1Xml, row2Xml];

  // Mapear las hojas manuales del periodo 2026-2 por su código (ej. LN1-001)
  const list2026_2 = (manualSheetsList || []).filter(
    m => m.periodo !== '2026-1' && !String(m.id || '').startsWith('manual_1_')
  );
  const byCode = new Map();
  let maxNum = 170;

  list2026_2.forEach(m => {
    let code = String(m.codigo || '').toUpperCase().trim().replace(/^LNI-/, 'LN1-');
    if (!code) return;
    const existing = byCode.get(code);
    if (!existing) {
      byCode.set(code, m);
    } else {
      // Priorizar registros nuevos o registros que tengan docente_reemplazo / motivo lleno
      const isNew = String(m.id || '').startsWith('manual_new_');
      const existingHasRep = Boolean(existing.docente_reemplazo || existing.docenteReemplazo);
      const newHasRep = Boolean(m.docente_reemplazo || m.docenteReemplazo);
      if (isNew || (newHasRep && !existingHasRep)) {
        byCode.set(code, m);
      }
    }
    const matchNum = code.match(/LN1-(\d+)/i);
    if (matchNum) {
      const n = parseInt(matchNum[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });

  for (let i = 1; i <= maxNum; i++) {
    const r = i + 2;
    const code = `LN1-${String(i).padStart(3, '0')}`;
    const item = byCode.get(code);
    const fallbackColI = templateColIMap.get(r) || '';

    if (!item) {
      // Fila pre-numerada disponible con fórmulas VLOOKUP listas y celda I con borde
      const fDoc = `VLOOKUP(C${r},'CONTROL ASISTENCIA'!H:M,4,FALSE)`;
      const fCur = `VLOOKUP(C${r},'CONTROL ASISTENCIA'!H:M,5,FALSE)`;
      const fCar = `VLOOKUP(C${r},'CONTROL ASISTENCIA'!H:M,6,FALSE)`;
      const emptyCells = [
        xmlCellString(`A${r}`, 27, code),
        xmlCellEmpty(`B${r}`, 143),
        xmlCellEmpty(`C${r}`, 142),
        xmlCellFormulaStr(`D${r}`, 31, fDoc, ''),
        xmlCellFormulaStr(`E${r}`, 31, fCur, ''),
        xmlCellFormulaStr(`F${r}`, 50, fCar, ''),
        xmlCellEmpty(`G${r}`, 49),
        xmlCellEmpty(`H${r}`, 104),
        fallbackColI ? xmlCellString(`I${r}`, 104, fallbackColI) : xmlCellEmpty(`I${r}`, 104)
      ].join('');
      rowsXml.push(`<row r="${r}" spans="1:9">${emptyCells}</row>`);
      continue;
    }

    const serialDate = dateToExcelSerial(item.fecha);
    const nrcStr = String(item.nrc || '').trim();
    const isNumericNrc = /^\d+$/.test(nrcStr);
    const nrcInfo = nrcLookupMap.get(nrcStr);

    const { cleanDocente, cleanMotivo, replacementDocente } = extractReplacementInfo(
      item,
      nrcInfo,
      fallbackColI
    );

    const cachedDocente = cleanDocente || nrcInfo?.docente || '';
    const cachedCurso = item.curso || nrcInfo?.curso || '';
    const cachedCarrera = item.carrera || nrcInfo?.carrera || '';

    const fDoc = `VLOOKUP(C${r},'CONTROL ASISTENCIA'!H:M,4,FALSE)`;
    const fCur = `VLOOKUP(C${r},'CONTROL ASISTENCIA'!H:M,5,FALSE)`;
    const fCar = `VLOOKUP(C${r},'CONTROL ASISTENCIA'!H:M,6,FALSE)`;

    // Si el NRC existe en CONTROL ASISTENCIA, usamos la fórmula VLOOKUP igual que en el Excel maestro
    const useVlookup = Boolean(nrcInfo);

    const cells = [
      xmlCellString(`A${r}`, 27, code),
      serialDate !== null ? xmlCellNumber(`B${r}`, 143, serialDate) : xmlCellString(`B${r}`, 143, item.fecha || ''),
      isNumericNrc ? xmlCellNumber(`C${r}`, 142, Number(nrcStr)) : xmlCellString(`C${r}`, 142, nrcStr),
      useVlookup ? xmlCellFormulaStr(`D${r}`, 31, fDoc, cachedDocente) : xmlCellString(`D${r}`, 31, cachedDocente),
      useVlookup ? xmlCellFormulaStr(`E${r}`, 31, fCur, cachedCurso) : xmlCellString(`E${r}`, 31, cachedCurso),
      useVlookup ? xmlCellFormulaStr(`F${r}`, 50, fCar, cachedCarrera) : xmlCellString(`F${r}`, 50, cachedCarrera),
      xmlCellString(`G${r}`, 49, cleanMotivo),
      xmlCellString(`H${r}`, 104, item.asistente || ''),
      replacementDocente
        ? xmlCellString(`I${r}`, 104, replacementDocente)
        : xmlCellEmpty(`I${r}`, 104)
    ];

    rowsXml.push(`<row r="${r}" spans="1:9">${cells.join('')}</row>`);
  }

  const lastRow = maxNum + 2;
  let updated = sheetXml.replace(
    /<sheetData>[\s\S]*?<\/sheetData>/,
    `<sheetData>${rowsXml.join('')}</sheetData>`
  );
  updated = updated.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:I${lastRow}"/>`);
  updated = updated.replace(/<mergeCell ref="A1:H1"\/>/, '<mergeCell ref="A1:I1"/>');
  updated = updated.replace(/<xm:sqref>G3:G\d+<\/xm:sqref>/, `<xm:sqref>G3:G${lastRow}</xm:sqref>`);
  updated = updated.replace(/topLeftCell="A\d+"/, 'topLeftCell="A2"');

  return { xml: updated, lastRow };
}

/**
 * Reconstruye <sheetData> de RESERVAS (xl/worksheets/sheet14.xml)
 * Preserva las filas 1-4 (cabecera y slicers) y las fórmulas MES, DIA y UBICACIÓN (VLOOKUP).
 */
function updateReservasXml(sheetXml, reservasList) {
  const headerRows = [];
  for (let r = 1; r <= 4; r++) {
    const m = sheetXml.match(new RegExp(`<row r="${r}"[\\s\\S]*?<\\/row>`));
    if (m) headerRows.push(m[0]);
  }
  if (headerRows.length < 4) return { xml: sheetXml, lastRow: 5 };

  const rowsXml = [...headerRows];
  const list = reservasList || [];

  list.forEach((res, idx) => {
    const r = idx + 5;
    const fechaStr = res.fecha || new Date().toISOString().split('T')[0];
    const serialDate = dateToExcelSerial(fechaStr);
    const { dia: diaCalc, mes: mesCalc } = getDayAndMonthFromDateStr(fechaStr);

    const mesCached = (res.mes || mesCalc || 'NOVIEMBRE').toUpperCase();
    const diaCached = (res.dia || diaCalc || 'LUNES').toUpperCase();

    const hIni = timeToExcelFraction(res.inicio || res.hora_inicio || '14:30');
    const hFin = timeToExcelFraction(res.final || res.hora_fin || '16:10');
    const aula = (res.aula || 'A201').toUpperCase().trim();
    const ubicCached = res.ubicacion || '2DO PISO - A';
    const docente = (res.docente || '').toUpperCase().trim();
    const detalle = (res.detalle || res.motivo || '').toUpperCase().trim();
    const usuario = (res.usuario || 'OPERACIONES').toUpperCase().trim();
    const prioridad = (res.prioridad || 'NORMAL').toUpperCase().trim();

    const fMes = `UPPER(TEXT(B${r},"MMMM"))`;
    const fDia = `UPPER(TEXT(B${r},"dddd"))`;
    const fUbic = `VLOOKUP(G${r},UBICACION[ABRV.]:UBICACION[UBICACION],2,FALSE)`;

    const cells = [
      serialDate !== null ? xmlCellNumber(`B${r}`, 219, serialDate) : xmlCellString(`B${r}`, 219, fechaStr),
      xmlCellFormulaStr(`C${r}`, 220, fMes, mesCached),
      xmlCellFormulaStr(`D${r}`, 220, fDia, diaCached),
      hIni !== null ? xmlCellNumber(`E${r}`, 222, hIni) : xmlCellString(`E${r}`, 222, res.inicio || ''),
      hFin !== null ? xmlCellNumber(`F${r}`, 221, hFin) : xmlCellString(`F${r}`, 221, res.final || ''),
      xmlCellString(`G${r}`, 220, aula),
      xmlCellFormulaStr(`H${r}`, 224, fUbic, ubicCached),
      xmlCellString(`I${r}`, 295, docente),
      xmlCellString(`J${r}`, 223, detalle),
      xmlCellString(`K${r}`, 220, usuario),
      xmlCellString(`L${r}`, 223, prioridad)
    ].join('');

    rowsXml.push(`<row r="${r}" spans="1:12" ht="15">${cells}</row>`);
  });

  const lastRow = Math.max(5, list.length + 4);
  let updated = sheetXml.replace(
    /<sheetData>[\s\S]*?<\/sheetData>/,
    `<sheetData>${rowsXml.join('')}</sheetData>`
  );
  updated = updated.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:N${lastRow}"/>`);
  updated = updated.replace(/sqref="L5:L\d+"/, `sqref="L5:L${lastRow}"`);
  updated = updated.replace(/sqref="K5:K\d+"/, `sqref="K5:K${lastRow}"`);

  return { xml: updated, lastRow };
}

/**
 * Actualiza los conteos por bloque horario y día en RESUMEN 2026-2 (xl/worksheets/sheet4.xml)
 * conservando sus fórmulas (=C5/B5, =AVERAGE(...), =SUM(...)) y su diseño intacto.
 */
function updateResumen2026Xml(sheet4Xml, asistenciaList) {
  const dayBlocks = [
    { dia: 'LUNES', startRow: 5 },
    { dia: 'MARTES', startRow: 18 },
    { dia: 'MIERCOLES', startRow: 31 },
    { dia: 'JUEVES', startRow: 44 },
    { dia: 'VIERNES', startRow: 57 },
    { dia: 'SABADO', startRow: 70 }
  ];
  const blockTimes = ['07:30', '09:10', '10:50', '12:30', '14:30', '16:10', '17:50', '19:30', '21:10'];

  const normalizeDayStr = (d) =>
    String(d || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  let updated = sheet4Xml;

  dayBlocks.forEach(({ dia, startRow }) => {
    blockTimes.forEach((timeStr, idx) => {
      const r = startRow + idx;
      const matching = (asistenciaList || []).filter(a => {
        const dNorm = normalizeDayStr(a.dia);
        const hProg = String(a.horaInicioProg || a.hora_inicio_prog || '').trim();
        return dNorm === dia && hProg === timeStr;
      });

      if (matching.length === 0) return;

      const totalClases = matching.length;
      let asistioPuntual = 0;
      let tardeCount = 0;
      let faltaCount = 0;

      matching.forEach(c => {
        const asist = String(c.asistencia || '').toUpperCase().trim();
        const punt = String(c.puntualidad || '').toUpperCase().trim();
        if (asist === 'NO') {
          faltaCount++;
        } else if (punt === 'TARDE') {
          tardeCount++;
        } else if (asist === 'SI' || asist.includes('REEMPLAZO')) {
          asistioPuntual++;
        }
      });

      // Si ya se tomó asistencia en este bloque, actualiza E, F, G, H manteniendo el estilo s="54"
      if (asistioPuntual + tardeCount + faltaCount > 0) {
        updated = updated.replace(
          new RegExp(`<c r="E${r}" s="(\\d+)"><v>\\d+<\\/v><\\/c>`),
          `<c r="E${r}" s="$1"><v>${totalClases}</v></c>`
        );
        updated = updated.replace(
          new RegExp(`<c r="F${r}" s="(\\d+)"><v>\\d+<\\/v><\\/c>`),
          `<c r="F${r}" s="$1"><v>${asistioPuntual}</v></c>`
        );
        updated = updated.replace(
          new RegExp(`<c r="G${r}" s="(\\d+)"><v>\\d+<\\/v><\\/c>`),
          `<c r="G${r}" s="$1"><v>${tardeCount}</v></c>`
        );
        updated = updated.replace(
          new RegExp(`<c r="H${r}" s="(\\d+)"><v>\\d+<\\/v><\\/c>`),
          `<c r="H${r}" s="$1"><v>${faltaCount}</v></c>`
        );
      }
    });
  });

  return updated;
}

/**
 * Toma el archivo binario original CONTROL DOCENTE.xlsx (Uint8Array) y los datos actuales de la app,
 * e inyecta todos los registros respetando el 100% de colores, estilos, tablas, slicers y fórmulas.
 */
export function buildMasterExcelFromTemplate(templateUint8, { asistencia, tickets, manualSheets, reservas }) {
  const archive = unzipSync(templateUint8);

  const sstList = archive['xl/sharedStrings.xml']
    ? parseSharedStrings(strFromU8(archive['xl/sharedStrings.xml']))
    : [];

  // Construir mapa rápido de NRC -> { docente, curso, carrera, reemplazo } desde CONTROL ASISTENCIA
  const nrcLookupMap = new Map();
  (asistencia || []).forEach(a => {
    const nrcKey = String(a.nrc || '').trim();
    if (!nrcKey) return;
    let repFromObs = '';
    const obsStr = String(a.observacion || '').trim();
    const obsRepMatch = obsStr.match(/Reemplazo:\s*([^|.\n]+)/i);
    if (obsRepMatch) {
      repFromObs = obsRepMatch[1].trim();
    } else if (String(a.asistencia || '').toUpperCase().includes('REEMPLAZO') && obsStr) {
      repFromObs = obsStr;
    }

    if (!nrcLookupMap.has(nrcKey)) {
      nrcLookupMap.set(nrcKey, {
        docente: a.docente || '',
        curso: a.curso || '',
        carrera: a.carrera || '',
        reemplazo: repFromObs
      });
    } else if (repFromObs && !nrcLookupMap.get(nrcKey).reemplazo) {
      nrcLookupMap.get(nrcKey).reemplazo = repFromObs;
    }
  });

  // 0. Actualizar RESUMEN 2026-2 (sheet4.xml)
  if (archive['xl/worksheets/sheet4.xml']) {
    const s4 = strFromU8(archive['xl/worksheets/sheet4.xml']);
    archive['xl/worksheets/sheet4.xml'] = strToU8(updateResumen2026Xml(s4, asistencia));
  }

  // 1. Actualizar CONTROL ASISTENCIA (sheet5.xml + table2.xml)
  if (archive['xl/worksheets/sheet5.xml']) {
    const s5 = strFromU8(archive['xl/worksheets/sheet5.xml']);
    const { xml, lastRow } = updateControlAsistenciaXml(s5, asistencia);
    archive['xl/worksheets/sheet5.xml'] = strToU8(xml);

    if (archive['xl/tables/table2.xml']) {
      let t2 = strFromU8(archive['xl/tables/table2.xml']);
      t2 = t2.replace(/ref="A1:T\d+"/g, `ref="A1:T${lastRow}"`);
      t2 = t2.replace(/ref="A2:T\d+"/g, `ref="A2:T${lastRow}"`);
      t2 = t2.replace(/ref="E1:E\d+"/g, `ref="E1:E${lastRow}"`);
      archive['xl/tables/table2.xml'] = strToU8(t2);
    }
  }

  // 2. Actualizar ATENCIONES 2026-2 (sheet12.xml + table4.xml)
  if (archive['xl/worksheets/sheet12.xml']) {
    const s12 = strFromU8(archive['xl/worksheets/sheet12.xml']);
    const { xml, lastRow } = updateAtencionesXml(s12, tickets);
    archive['xl/worksheets/sheet12.xml'] = strToU8(xml);

    if (archive['xl/tables/table4.xml']) {
      let t4 = strFromU8(archive['xl/tables/table4.xml']);
      t4 = t4.replace(/ref="A2:K\d+"/g, `ref="A2:K${lastRow}"`);
      archive['xl/tables/table4.xml'] = strToU8(t4);
    }
  }

  // 3. Actualizar HOJA DE ASISTENCIA 2026-2 (sheet13.xml)
  if (archive['xl/worksheets/sheet13.xml']) {
    const s13 = strFromU8(archive['xl/worksheets/sheet13.xml']);
    const { xml } = updateHojasManualesXml(s13, manualSheets, nrcLookupMap, sstList);
    archive['xl/worksheets/sheet13.xml'] = strToU8(xml);
  }

  // 4. Actualizar RESERVAS (sheet14.xml + table5.xml)
  if (archive['xl/worksheets/sheet14.xml']) {
    const s14 = strFromU8(archive['xl/worksheets/sheet14.xml']);
    const { xml, lastRow } = updateReservasXml(s14, reservas);
    archive['xl/worksheets/sheet14.xml'] = strToU8(xml);

    if (archive['xl/tables/table5.xml']) {
      let t5 = strFromU8(archive['xl/tables/table5.xml']);
      t5 = t5.replace(/ref="B4:L\d+"/g, `ref="B4:L${lastRow}"`);
      t5 = t5.replace(/ref="B5:L\d+"/g, `ref="B5:L${lastRow}"`);
      t5 = t5.replace(/ref="E4:E\d+"/g, `ref="E4:E${lastRow}"`);
      archive['xl/tables/table5.xml'] = strToU8(t5);
    }
  }

  // 5. En xl/workbook.xml: hacer visibles ATENCIONES 2026-2 y RESUMEN 2026-2, y activar recálculo automático al abrir
  if (archive['xl/workbook.xml']) {
    let wbXml = strFromU8(archive['xl/workbook.xml']);
    wbXml = wbXml.replace(
      /<sheet name="ATENCIONES 2026-2" sheetId="34" state="hidden" r:id="rId12"\/>/,
      '<sheet name="ATENCIONES 2026-2" sheetId="34" r:id="rId12"/>'
    );
    wbXml = wbXml.replace(
      /<sheet name="RESUMEN 2026-2" sheetId="24" state="hidden" r:id="rId4"\/>/,
      '<sheet name="RESUMEN 2026-2" sheetId="24" r:id="rId4"/>'
    );
    wbXml = wbXml.replace(
      /<calcPr calcId="(\d+)"\/>/,
      '<calcPr calcId="$1" fullCalcOnLoad="1"/>'
    );
    archive['xl/workbook.xml'] = strToU8(wbXml);
  }

  // 6. Eliminar calcChain.xml obsoleto para que Excel lo regenere limpiamente con las nuevas filas
  if (archive['xl/calcChain.xml']) {
    delete archive['xl/calcChain.xml'];
  }
  if (archive['xl/_rels/workbook.xml.rels']) {
    let relsXml = strFromU8(archive['xl/_rels/workbook.xml.rels']);
    relsXml = relsXml.replace(/<Relationship[^>]*Target="calcChain\.xml"[^>]*\/>/, '');
    archive['xl/_rels/workbook.xml.rels'] = strToU8(relsXml);
  }
  if (archive['[Content_Types].xml']) {
    let ctXml = strFromU8(archive['[Content_Types].xml']);
    ctXml = ctXml.replace(/<Override[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/, '');
    archive['[Content_Types].xml'] = strToU8(ctXml);
  }

  return zipSync(archive, { level: 6 });
}
