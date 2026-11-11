/**
 * SINCRONIZADOR BIDIRECCIONAL EN TIEMPO REAL (24/7)
 * Conecta automáticamente tu archivo Excel (OneDrive / PC) <-> https://control-doc.pages.dev
 * - Si modificas y guardas el Excel -> Jala la data automáticamente a la Web App en tiempo real.
 * - Si registras algo en la Web App o desde celulares -> Guarda automáticamente en el Excel conservando colores y fórmulas.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');

const API_BASE = process.env.API_BASE || 'https://control-doc.pages.dev';
const targetPath = process.argv[2] || path.join(__dirname, 'CONTROL DOCENTE.xlsx');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function formatExcelTime(val) {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') {
    const frac = val < 1 ? val : val - Math.floor(val);
    const totalMinutes = Math.round(frac * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
  return String(val);
}

function formatExcelDate(val) {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' && val > 20000) {
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }
  return String(val);
}

function parseExcelWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = wb.SheetNames;

  // 1. CONTROL ASISTENCIA
  const asistSheetName =
    sheetNames.find((n) => n.toUpperCase().includes('CONTROL ASISTENCIA')) ||
    sheetNames.find((n) => n.toUpperCase().includes('ASISTENCIA')) ||
    sheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[asistSheetName], { header: 1 });
  const asistencia = [];
  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || (!row[6] && !row[10] && !row[7])) continue;
    if (String(row[6] || '').toUpperCase() === 'AULA') continue;
    asistencia.push({
      id: `asist_imp_${r}`,
      pisoPabellon: row[0] ? String(row[0]).trim() : '',
      sede: row[1] ? String(row[1]).trim() : 'Comas',
      periodo: row[2] ? String(row[2]).trim() : '2026-2',
      dia: row[3] ? String(row[3]).trim().toUpperCase() : '',
      horaInicioProg: formatExcelTime(row[4]),
      horaFinalProg: formatExcelTime(row[5]),
      aula: row[6] ? String(row[6]).trim().toUpperCase() : '',
      nrc: row[7] ? String(row[7]).trim() : '',
      listaCruzada: row[8] ? String(row[8]).trim() : '',
      codigoDocente: row[9] ? String(row[9]).trim() : '',
      docente: row[10] ? String(row[10]).trim().toUpperCase() : '',
      curso: row[11] ? String(row[11]).trim().toUpperCase() : '',
      carrera: row[12] ? String(row[12]).trim() : '',
      horaInicioReal: formatExcelTime(row[13]),
      horaFinalReal: formatExcelTime(row[14]),
      asistencia: row[15] ? String(row[15]).trim().toUpperCase() : 'PENDIENTE',
      puntualidad: row[16] ? String(row[16]).trim().toUpperCase() : '-',
      observacion: row[17] ? String(row[17]).trim() : '',
      real: row[18] !== undefined && row[18] !== '' ? Number(row[18]) : null,
      ciclo: row[19] ? String(row[19]).trim() : ''
    });
  }

  // 2. ATENCIONES 2026-2 y 2026-1
  const tickets = [];
  const atenSheets = sheetNames.filter((n) => n.toUpperCase().includes('ATENCION'));
  for (const atenName of atenSheets) {
    const is20261 = atenName.includes('2026-1');
    const defaultPeriodo = is20261 ? '2026-1' : '2026-2';
    const atenRows = XLSX.utils.sheet_to_json(wb.Sheets[atenName], { header: 1 });
    for (let r = 1; r < atenRows.length; r++) {
      const row = atenRows[r];
      if (!row || (!row[4] && !row[7] && !row[10])) continue;
      if (String(row[0] || '').toUpperCase().includes('PERIODO')) continue;
      tickets.push({
        id: `ticket_${is20261 ? '1' : '2'}_${r}`,
        periodo: row[0] ? String(row[0]).trim() : defaultPeriodo,
        fecha: formatExcelDate(row[1]),
        dia: row[2] ? String(row[2]).trim().toUpperCase() : '',
        horaReporte: formatExcelTime(row[3]),
        ambiente: row[4] ? String(row[4]).trim().toUpperCase() : '',
        piso: row[5] !== undefined && row[5] !== null ? String(row[5]).trim() : '',
        pabellon: row[6] ? String(row[6]).trim().toUpperCase() : '',
        tipoSolicitud: row[7] ? String(row[7]).trim().toUpperCase() : 'ASISTENCIA TÉCNICA',
        estado: row[8] ? String(row[8]).trim().toUpperCase() : 'ATENDIDO',
        usuario: row[9] ? (String(row[9]).toUpperCase().includes('ALUMNO') ? 'ALUMNO' : 'DOCENTE') : 'DOCENTE',
        descripcionSolucion: row[10] !== undefined ? String(row[10] || '').trim() : '',
        responsable: row[11] !== undefined ? String(row[11] || '').trim() : ''
      });
    }
  }

  // 3. HOJA DE ASISTENCIA 2026-2
  const manualSheets = [];
  const manualSheetName =
    sheetNames.find((n) => n.toUpperCase().includes('HOJA DE ASISTENCIA 2026-2')) ||
    sheetNames.find((n) => n.toUpperCase().includes('HOJA DE ASISTENCIA'));
  if (manualSheetName && wb.Sheets[manualSheetName]) {
    const manRows = XLSX.utils.sheet_to_json(wb.Sheets[manualSheetName], { header: 1 });
    for (let r = 1; r < manRows.length; r++) {
      const row = manRows[r];
      if (!row) continue;
      const nHoja = row[0] ? String(row[0]).trim().toUpperCase() : '';
      if (nHoja.includes('HOJA') || String(row[4] || '').toUpperCase().includes('NOMBRE')) continue;
      const docente = row[5] ? String(row[5]).trim().toUpperCase() : '';
      const nrc = row[3] ? String(row[3]).trim() : '';
      const curso = row[6] ? String(row[6]).trim().toUpperCase() : '';
      const docReemp = row[8] ? String(row[8]).trim().toUpperCase() : '';
      if (!docente && !nrc && !curso && !docReemp) continue;
      manualSheets.push({
        id: `manual_2_${r}`,
        n_hoja: nHoja.replace(/^LNI-/i, 'LN1-'),
        fecha: formatExcelDate(row[1]),
        aula: row[2] ? String(row[2]).trim().toUpperCase() : '',
        nrc,
        codigo_docente: row[4] ? String(row[4]).trim() : '',
        docente,
        curso,
        observacion: row[7] ? String(row[7]).trim() : '',
        docente_reemplazo: docReemp,
        motivo: docReemp ? 'REEMPLAZO DOCENTE' : 'CLASE REGULAR',
        estado_hoja: 'REGISTRADO'
      });
    }
  }

  // 4. RESERVAS
  const reservas = [];
  const resSheetName = sheetNames.find((n) => n.toUpperCase().includes('RESERVA'));
  if (resSheetName && wb.Sheets[resSheetName]) {
    const resRows = XLSX.utils.sheet_to_json(wb.Sheets[resSheetName], { header: 1 });
    for (let r = 1; r < resRows.length; r++) {
      const row = resRows[r];
      if (!row || (!row[0] && !row[5])) continue;
      if (String(row[0] || '').toUpperCase().includes('RESPONSABLE')) continue;
      reservas.push({
        id: `res_imp_${r}`,
        responsable: row[0] ? String(row[0]).trim() : '',
        fecha: formatExcelDate(row[1]),
        dia: row[2] ? String(row[2]).trim().toUpperCase() : '',
        inicio: formatExcelTime(row[3]),
        final: formatExcelTime(row[4]),
        ambiente: row[5] ? String(row[5]).trim().toUpperCase() : '',
        piso_pabellon: row[6] ? String(row[6]).trim() : '',
        motivo: row[7] ? String(row[7]).trim() : '',
        soporte: row[8] ? String(row[8]).trim() : ''
      });
    }
  }

  return { asistencia, tickets, manualSheets, reservas };
}

let lastFileHash = '';
let lastWebStateHash = '';
let isSyncing = false;

async function startRealtimeSync() {
  console.log('====================================================================');
  console.log('  MOTOR BIDIRECCIONAL EN TIEMPO REAL ACTIVO (EXCEL <-> WEB APP)');
  console.log('  Archivo vinculado:', targetPath);
  console.log('  Servidor en vivo :', API_BASE);
  console.log('====================================================================\n');

  if (fs.existsSync(targetPath)) {
    lastFileHash = sha256(fs.readFileSync(targetPath));
  }

  // Obtener huella inicial de la Web App
  try {
    const r = await fetch(`${API_BASE}/api/all-data`);
    if (r.ok) {
      const j = await r.json();
      if (j.success && j.data) {
        lastWebStateHash = sha256(Buffer.from(JSON.stringify(j.data)));
      }
    }
  } catch (_) {}

  setInterval(async () => {
    if (isSyncing) return;
    isSyncing = true;
    const now = new Date().toLocaleTimeString('es-PE', { hour12: false });

    try {
      // 1. ¿Cambió el archivo Excel en OneDrive / PC? -> Jalar cambios hacia la Web App
      if (fs.existsSync(targetPath)) {
        const currentBuf = fs.readFileSync(targetPath);
        const currentFileHash = sha256(currentBuf);

        if (lastFileHash && currentFileHash !== lastFileHash) {
          console.log(`[${now}] ⬆️ Cambio detectado en Excel -> Jalando data hacia la Web App...`);
          const parsed = parseExcelWorkbook(currentBuf);
          if (parsed.asistencia.length > 0) {
            const resp = await fetch(`${API_BASE}/api/import-excel-data`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...parsed, clearExisting: true })
            });
            if (resp.ok) {
              lastFileHash = currentFileHash;
              const rState = await fetch(`${API_BASE}/api/all-data`);
              if (rState.ok) {
                const jState = await rState.json();
                if (jState.success && jState.data) {
                  lastWebStateHash = sha256(Buffer.from(JSON.stringify(jState.data)));
                }
              }
              console.log(
                `[${now}] ✅ Data jalada del Excel a la Web (${parsed.asistencia.length} clases, ${parsed.tickets.length} atenciones, ${parsed.manualSheets.length} hojas)`
              );
            }
          }
        }
      }

      // 2. ¿Cambió la base de datos en la Web App? -> Guardar cambios automáticamente en el Excel
      const resAll = await fetch(`${API_BASE}/api/all-data`);
      if (resAll.ok) {
        const jsonAll = await resAll.json();
        if (jsonAll.success && jsonAll.data) {
          const currentWebHash = sha256(Buffer.from(JSON.stringify(jsonAll.data)));
          if (currentWebHash !== lastWebStateHash) {
            console.log(`[${now}] ⬇️ Cambio detectado en la Web App -> Guardando en Excel OneDrive...`);
            const expRes = await fetch(`${API_BASE}/api/export-excel`);
            if (expRes.ok) {
              const outBuf = Buffer.from(await expRes.arrayBuffer());
              fs.writeFileSync(targetPath, outBuf);
              lastFileHash = sha256(outBuf);
              lastWebStateHash = currentWebHash;
              console.log(`[${now}] ✅ Excel actualizado automáticamente en tiempo real!`);
            }
          }
        }
      }
    } catch (err) {
      // Si el archivo está temporalmente bloqueado mientras Excel guarda, reintentar en el siguiente ciclo
    } finally {
      isSyncing = false;
    }
  }, 3000);
}

startRealtimeSync();

