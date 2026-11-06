const fs = require('fs');
const path = require('path');
const { unzipSync, zipSync, strToU8, strFromU8 } = require('fflate');

const DAYS_ES = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const MONTHS_ES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

function escapeXml(val) {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function dateToExcelSerial(dateStr) {
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

function timeToExcelFraction(timeStr) {
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

function exportToExcelBuffer(data) {
  const templatePath = path.join(__dirname, '../../CONTROL DOCENTE.xlsx');
  const templateBuf = fs.readFileSync(templatePath);
  const archive = unzipSync(new Uint8Array(templateBuf));

  const nrcLookupMap = new Map();
  (data.asistencia || []).forEach(a => {
    const nrcKey = String(a.nrc || '').trim();
    if (nrcKey && !nrcLookupMap.has(nrcKey)) {
      nrcLookupMap.set(nrcKey, {
        docente: a.docente || '',
        curso: a.curso || '',
        carrera: a.carrera || ''
      });
    }
  });

  // 1. CONTROL ASISTENCIA
  if (archive['xl/worksheets/sheet5.xml']) {
    const sheetXml = strFromU8(archive['xl/worksheets/sheet5.xml']);
    const row1Match = sheetXml.match(/<row r="1"[\s\S]*?<\/row>/);
    if (row1Match) {
      const sorted = [...(data.asistencia || [])].sort((a, b) => {
        const na = parseInt(String(a.id || '').replace(/\D+/g, ''), 10) || 999999;
        const nb = parseInt(String(b.id || '').replace(/\D+/g, ''), 10) || 999999;
        return na - nb;
      });
      const rowsXml = [row1Match[0]];
      sorted.forEach((item, idx) => {
        const r = idx + 2;
        const isEven = r % 2 === 0;
        const st = isEven
          ? { A: 114, B: 253, C: 253, D: 253, E: 112, F: 112, G: 253, H: 253, I: 253, J: 256, K: 256, L: 260, M: 266, N: 274, O: 112, P: 258, Q: 205, R: 309, S: 254, T: 259 }
          : { A: 254, B: 113, C: 113, D: 113, E: 255, F: 255, G: 113, H: 113, I: 113, J: 257, K: 257, L: 261, M: 266, N: 274, O: 112, P: 258, Q: 205, R: 56,  S: 254, T: 259 };

        const hIniProg = timeToExcelFraction(item.horaInicioProg);
        const hFinProg = timeToExcelFraction(item.horaFinalProg);
        const hIniReal = timeToExcelFraction(item.horaInicioReal);
        const hFinReal = timeToExcelFraction(item.horaFinalReal);

        let asistVal = (item.asistencia || '').toUpperCase().trim();
        if (asistVal === 'PENDIENTE') asistVal = '';
        else if (asistVal.includes('REEMPLAZO')) asistVal = 'SI (DOCENTE REEMPLAZO)';

        let puntVal = (item.puntualidad || '').toUpperCase().trim();
        if (!asistVal && puntVal === '-') puntVal = '';

        const realCount = item.real !== undefined && item.real !== null && item.real !== '' ? Number(item.real) : null;
        const periodoRaw = item.periodo || '226434';
        const nrcRaw = item.nrc ?? '';

        const cells = [
          xmlCellString(`A${r}`, st.A, item.pisoPabellon || ''),
          xmlCellString(`B${r}`, st.B, item.sede || 'Comas'),
          /^\d+$/.test(String(periodoRaw).trim()) ? xmlCellNumber(`C${r}`, st.C, Number(periodoRaw)) : xmlCellString(`C${r}`, st.C, periodoRaw),
          xmlCellString(`D${r}`, st.D, item.dia || ''),
          hIniProg !== null ? xmlCellNumber(`E${r}`, st.E, hIniProg) : xmlCellString(`E${r}`, st.E, item.horaInicioProg || ''),
          hFinProg !== null ? xmlCellNumber(`F${r}`, st.F, hFinProg) : xmlCellString(`F${r}`, st.F, item.horaFinalProg || ''),
          xmlCellString(`G${r}`, st.G, item.aula || ''),
          /^\d+$/.test(String(nrcRaw).trim()) ? xmlCellNumber(`H${r}`, st.H, Number(nrcRaw)) : xmlCellString(`H${r}`, st.H, nrcRaw),
          xmlCellString(`I${r}`, st.I, item.listaCruzada || '\u00A0'),
          xmlCellString(`J${r}`, st.J, item.codigoDocente || ''),
          xmlCellString(`K${r}`, st.K, item.docente || ''),
          xmlCellString(`L${r}`, st.L, item.curso || ''),
          xmlCellString(`M${r}`, st.M, item.carrera || ''),
          hIniReal !== null ? xmlCellNumber(`N${r}`, st.N, hIniReal) : xmlCellEmpty(`N${r}`, st.N),
          hFinReal !== null ? xmlCellNumber(`O${r}`, st.O, hFinReal) : xmlCellEmpty(`O${r}`, st.O),
          xmlCellString(`P${r}`, st.P, asistVal),
          xmlCellString(`Q${r}`, st.Q, puntVal),
          xmlCellString(`R${r}`, st.R, item.observacion || ''),
          realCount !== null ? xmlCellNumber(`S${r}`, st.S, realCount) : xmlCellEmpty(`S${r}`, st.S),
          xmlCellString(`T${r}`, st.T, item.ciclo || '')
        ].join('');

        rowsXml.push(`<row r="${r}" spans="1:20">${cells}</row>`);
      });

      const lastRow = Math.max(2, sorted.length + 1);
      let updated = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${rowsXml.join('')}</sheetData>`);
      updated = updated.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:T${lastRow}"/>`);
      archive['xl/worksheets/sheet5.xml'] = strToU8(updated);
    }
  }

  // 2. ATENCIONES 2026-2
  if (archive['xl/worksheets/sheet12.xml']) {
    const sheetXml = strFromU8(archive['xl/worksheets/sheet12.xml']);
    const row1Match = sheetXml.match(/<row r="1"[\s\S]*?<\/row>/);
    const row2Match = sheetXml.match(/<row r="2"[\s\S]*?<\/row>/);
    if (row1Match && row2Match) {
      const rowsXml = [row1Match[0], row2Match[0]];
      const list = (data.tickets || []).filter(t => t.periodo !== '2026-1');
      list.forEach((t, idx) => {
        const r = idx + 3;
        const fechaStr = t.fecha || new Date().toISOString().split('T')[0];
        const serialDate = dateToExcelSerial(fechaStr);
        const { dia: diaCalc } = getDayAndMonthFromDateStr(fechaStr);
        const horaStr = t.horaReporte || '09:00';
        const timeFrac = timeToExcelFraction(horaStr);
        const ambiente = (t.ambiente || 'A201').toUpperCase().trim();

        const cells = [
          serialDate !== null ? xmlCellNumber(`A${r}`, 202, serialDate) : xmlCellString(`A${r}`, 202, fechaStr),
          xmlCellFormulaStr(`B${r}`, 196, `UPPER(TEXT(A${r},"dddd"))`, (t.dia || diaCalc || 'LUNES').toUpperCase()),
          timeFrac !== null ? xmlCellNumber(`C${r}`, 198, timeFrac) : xmlCellString(`C${r}`, 198, horaStr),
          xmlCellFormulaStr(`D${r}`, 200, `TEXT(HOUR(C${r}),"00")&amp;":00 – "&amp;TEXT(MOD(HOUR(C${r})+1,24),"00")&amp;":00"`, t.rango || computeRangoStr(horaStr)),
          xmlCellString(`E${r}`, 200, ambiente),
          xmlCellFormulaStr(`F${r}`, 182, `VLOOKUP($E${r},AMBIENTES!$C$3:$H$66,4,FALSE)`, (t.piso || 'SEGUNDO PISO').toUpperCase()),
          xmlCellString(`G${r}`, 182, (t.pabellon || (ambiente.startsWith('B') ? 'B' : 'A')).toUpperCase()),
          xmlCellString(`H${r}`, 179, t.tipoSolicitud || 'Soporte General'),
          xmlCellString(`I${r}`, 193, (t.estado || 'ATENDIDO').toUpperCase()),
          xmlCellString(`J${r}`, 182, t.descripcionSolucion || ''),
          xmlCellString(`K${r}`, 196, t.responsable || 'Operaciones'),
          xmlCellEmpty(`L${r}`, 207),
          xmlCellEmpty(`M${r}`, 207),
          xmlCellEmpty(`N${r}`, 207),
          xmlCellEmpty(`O${r}`, 207)
        ].join('');
        rowsXml.push(`<row r="${r}" spans="1:15">${cells}</row>`);
      });
      const updated = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${rowsXml.join('')}</sheetData>`);
      archive['xl/worksheets/sheet12.xml'] = strToU8(updated);
    }
  }

  // 3. HOJA DE ASISTENCIA 2026-2
  if (archive['xl/worksheets/sheet13.xml']) {
    const sheetXml = strFromU8(archive['xl/worksheets/sheet13.xml']);
    const row1Match = sheetXml.match(/<row r="1"[\s\S]*?<\/row>/);
    const row2Match = sheetXml.match(/<row r="2"[\s\S]*?<\/row>/);
    if (row1Match && row2Match) {
      let row1Xml = row1Match[0]
        .replace('spans="1:8"', 'spans="1:9"')
        .replace('<c r="H1" s="339"/>', '<c r="H1" s="338"/><c r="I1" s="339"/>');
      let row2Xml = row2Match[0].replace('spans="1:8"', 'spans="1:9"');
      if (!row2Xml.includes('r="I2"')) {
        row2Xml = row2Xml.replace('</row>', `${xmlCellString('I2', 26, 'DOCENTE REEMPLAZANTE')}</row>`);
      }

      const rowsXml = [row1Xml, row2Xml];
      const list = (data.manualSheets || []).filter(m => m.periodo !== '2026-1');
      const byCode = new Map();
      let maxNum = 170;
      list.forEach(m => {
        const code = String(m.codigo || '').toUpperCase().trim();
        if (code) {
          byCode.set(code, m);
          const matchNum = code.match(/LN1-(\d+)/i);
          if (matchNum && parseInt(matchNum[1], 10) > maxNum) maxNum = parseInt(matchNum[1], 10);
        }
      });

      for (let i = 1; i <= maxNum; i++) {
        const r = i + 2;
        const code = `LN1-${String(i).padStart(3, '0')}`;
        const item = byCode.get(code);
        const fDoc = `VLOOKUP(C${r},'CONTROL ASISTENCIA'!H:M,4,FALSE)`;
        const fCur = `VLOOKUP(C${r},'CONTROL ASISTENCIA'!H:M,5,FALSE)`;
        const fCar = `VLOOKUP(C${r},'CONTROL ASISTENCIA'!H:M,6,FALSE)`;

        if (!item) {
          const emptyCells = [
            xmlCellString(`A${r}`, 27, code),
            xmlCellEmpty(`B${r}`, 143),
            xmlCellEmpty(`C${r}`, 142),
            xmlCellFormulaStr(`D${r}`, 31, fDoc, ''),
            xmlCellFormulaStr(`E${r}`, 31, fCur, ''),
            xmlCellFormulaStr(`F${r}`, 50, fCar, ''),
            xmlCellEmpty(`G${r}`, 49),
            xmlCellEmpty(`H${r}`, 104),
            xmlCellEmpty(`I${r}`, 104)
          ].join('');
          rowsXml.push(`<row r="${r}" spans="1:9">${emptyCells}</row>`);
          continue;
        }

        const serialDate = dateToExcelSerial(item.fecha);
        const nrcStr = String(item.nrc || '').trim();
        let rawDocente = String(item.docente || '').trim();
        let rawMotivo = String(item.motivo || '').trim();
        let replacementDocente = String(item.docente_reemplazo || item.docenteReemplazo || '').trim();

        const repMatch = rawDocente.match(/^(.*?)\s*\[Reemplazo:\s*(.*?)\]$/i);
        if (repMatch) {
          rawDocente = repMatch[1].trim();
          if (!replacementDocente) replacementDocente = repMatch[2].trim();
        }
        const repMotivoMatch = rawMotivo.match(/REEMPLAZO\s*\(([^)]+)\)/i);
        if (repMotivoMatch) {
          if (!replacementDocente) replacementDocente = repMotivoMatch[1].trim();
          rawMotivo = 'DOCENTE DE REEMPLAZO';
        }
        if (!replacementDocente && item.detalle) {
          const detMatch = String(item.detalle).match(/Reemplaza:\s*(.+)$/i);
          if (detMatch) replacementDocente = detMatch[1].trim();
        }

        const nrcInfo = nrcLookupMap.get(nrcStr);
        const useVlookup = Boolean(nrcInfo);

        const cells = [
          xmlCellString(`A${r}`, 27, code),
          serialDate !== null ? xmlCellNumber(`B${r}`, 143, serialDate) : xmlCellString(`B${r}`, 143, item.fecha || ''),
          /^\d+$/.test(nrcStr) ? xmlCellNumber(`C${r}`, 142, Number(nrcStr)) : xmlCellString(`C${r}`, 142, nrcStr),
          useVlookup ? xmlCellFormulaStr(`D${r}`, 31, fDoc, rawDocente || nrcInfo.docente) : xmlCellString(`D${r}`, 31, rawDocente),
          useVlookup ? xmlCellFormulaStr(`E${r}`, 31, fCur, item.curso || nrcInfo.curso) : xmlCellString(`E${r}`, 31, item.curso || ''),
          useVlookup ? xmlCellFormulaStr(`F${r}`, 50, fCar, item.carrera || nrcInfo.carrera) : xmlCellString(`F${r}`, 50, item.carrera || ''),
          xmlCellString(`G${r}`, 49, rawMotivo),
          xmlCellString(`H${r}`, 104, item.asistente || ''),
          replacementDocente ? xmlCellString(`I${r}`, 104, replacementDocente.toUpperCase()) : xmlCellEmpty(`I${r}`, 104)
        ];
        rowsXml.push(`<row r="${r}" spans="1:9">${cells.join('')}</row>`);
      }

      let updated = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${rowsXml.join('')}</sheetData>`);
      updated = updated.replace(/<mergeCell ref="A1:H1"\/>/, '<mergeCell ref="A1:I1"/>');
      archive['xl/worksheets/sheet13.xml'] = strToU8(updated);
    }
  }

  // 4. RESERVAS
  if (archive['xl/worksheets/sheet14.xml']) {
    const sheetXml = strFromU8(archive['xl/worksheets/sheet14.xml']);
    const headerRows = [];
    for (let r = 1; r <= 4; r++) {
      const m = sheetXml.match(new RegExp(`<row r="${r}"[\\s\\S]*?<\\/row>`));
      if (m) headerRows.push(m[0]);
    }
    if (headerRows.length === 4) {
      const rowsXml = [...headerRows];
      (data.reservas || []).forEach((res, idx) => {
        const r = idx + 5;
        const fechaStr = res.fecha || new Date().toISOString().split('T')[0];
        const serialDate = dateToExcelSerial(fechaStr);
        const { dia: diaCalc, mes: mesCalc } = getDayAndMonthFromDateStr(fechaStr);
        const hIni = timeToExcelFraction(res.inicio || res.hora_inicio || '14:30');
        const hFin = timeToExcelFraction(res.final || res.hora_fin || '16:10');

        const cells = [
          serialDate !== null ? xmlCellNumber(`B${r}`, 219, serialDate) : xmlCellString(`B${r}`, 219, fechaStr),
          xmlCellFormulaStr(`C${r}`, 220, `UPPER(TEXT(B${r},"MMMM"))`, (res.mes || mesCalc || '').toUpperCase()),
          xmlCellFormulaStr(`D${r}`, 220, `UPPER(TEXT(B${r},"dddd"))`, (res.dia || diaCalc || '').toUpperCase()),
          hIni !== null ? xmlCellNumber(`E${r}`, 222, hIni) : xmlCellString(`E${r}`, 222, res.inicio || ''),
          hFin !== null ? xmlCellNumber(`F${r}`, 221, hFin) : xmlCellString(`F${r}`, 221, res.final || ''),
          xmlCellString(`G${r}`, 220, (res.aula || 'A201').toUpperCase()),
          xmlCellFormulaStr(`H${r}`, 224, `VLOOKUP(G${r},UBICACION[ABRV.]:UBICACION[UBICACION],2,FALSE)`, res.ubicacion || '2DO PISO - A'),
          xmlCellString(`I${r}`, 295, (res.docente || '').toUpperCase()),
          xmlCellString(`J${r}`, 223, (res.detalle || res.motivo || '').toUpperCase()),
          xmlCellString(`K${r}`, 220, (res.usuario || 'OPERACIONES').toUpperCase()),
          xmlCellString(`L${r}`, 223, (res.prioridad || 'NORMAL').toUpperCase())
        ].join('');
        rowsXml.push(`<row r="${r}" spans="1:12" ht="15">${cells}</row>`);
      });

      const updated = sheetXml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${rowsXml.join('')}</sheetData>`);
      archive['xl/worksheets/sheet14.xml'] = strToU8(updated);
    }
  }

  // Hacer visibles ATENCIONES 2026-2 y RESUMEN 2026-2 y activar fullCalcOnLoad
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
    wbXml = wbXml.replace(/<calcPr calcId="(\d+)"\/>/, '<calcPr calcId="$1" fullCalcOnLoad="1"/>');
    archive['xl/workbook.xml'] = strToU8(wbXml);
  }

  if (archive['xl/calcChain.xml']) delete archive['xl/calcChain.xml'];
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

  return Buffer.from(zipSync(archive, { level: 6 }));
}

module.exports = { exportToExcelBuffer };
