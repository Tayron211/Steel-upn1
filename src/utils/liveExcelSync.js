/**
 * Sincronización BIDIRECCIONAL en tiempo real con el archivo Excel original (OneDrive / PC)
 * - Si registras algo en la Web App -> Sobrescribe automáticamente el Excel vinculado con tus colores y fórmulas.
 * - Si editas y guardas el Excel vinculado -> Detecta el cambio automáticamente y jala la data hacia la Web App.
 */
import * as XLSX from 'xlsx';
import { buildMasterExcelFromTemplate } from './excelTemplateExporter';
import { createDbChangeGate } from './webSignGate';

const DB_NAME = 'upn_onedrive_excel_sync_db';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'master_excel_handle';

let cachedHandle = null;
let cachedTemplateBytes = null;
let syncTimer = null;
let watchInterval = null;
let isSyncingNow = false;
let lastKnownFileModified = 0;
let lastLocalSyncAt = 0;
const LOCAL_SYNC_MIN_MS = 1200;
const listeners = new Set();
const dbChanged = createDbChangeGate({ fireOnFirst: false });

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
  if (typeof val === 'number' && val > 20000) {
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }
  const s = String(val).trim();
  const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return s;
}

function findHeaderRow(rows, musts) {
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const cells = (rows[r] || []).map(c => 
      String(c ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
    if (musts.every(m => cells.some(c => c.includes(m)))) {
      return { rowIndex: r, cells };
    }
  }
  return null;
}

function colOf(cells, names) {
  for (const n of names) {
    const normN = n.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let i = cells.findIndex(c => c === normN);
    if (i < 0) i = cells.findIndex(c => c.startsWith(normN));
    if (i < 0) i = cells.findIndex(c => c.includes(normN));
    if (i >= 0) return i;
  }
  return -1;
}

export function subscribeLiveExcelStatus(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notifyListeners(state) {
  listeners.forEach(cb => {
    try {
      cb(state);
    } catch (e) {}
  });
}

function openHandleDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB no disponible'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFileHandleToIDB(handle) {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    return false;
  }
}

export async function loadFileHandleFromIDB() {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

export async function clearSavedFileHandle() {
  cachedHandle = null;
  if (watchInterval) {
    clearInterval(watchInterval);
    watchInterval = null;
  }
  try {
    const db = await openHandleDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
  } catch (e) {}
  notifyListeners({ linked: false, fileName: null, status: 'disconnected' });
}

export function getLiveExcelState() {
  return {
    supported: typeof window !== 'undefined' && 'showOpenFilePicker' in window,
    linked: Boolean(cachedHandle),
    fileName: cachedHandle?.name || null,
    syncing: isSyncingNow
  };
}

/**
 * Extrae todas las hojas de un ArrayBuffer de Excel y las envía a /api/import-excel-data
 */
async function pullFromLinkedExcelToWeb(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetNames = wb.SheetNames;
  const asistSheetName =
    sheetNames.find(n => n.toUpperCase().includes('CONTROL ASISTENCIA')) ||
    sheetNames.find(n => n.toUpperCase().includes('ASISTENCIA')) ||
    sheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[asistSheetName], { header: 1 });
  const asistencia = [];
  if (rawRows && rawRows.length > 0) {
    const headerInfo = findHeaderRow(rawRows, ['AULA', 'DOCENTE']) ||
      findHeaderRow(rawRows, ['NRC', 'AULA']) ||
      findHeaderRow(rawRows, ['PABELLON', 'AULA']) || {
        rowIndex: 0,
        cells: (rawRows[0] || []).map(c => String(c ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
      };

    const c = headerInfo.cells;
    const iPisoPab = colOf(c, ['PISO/PABELLON', 'PABELLON/PISO', 'PISO', 'PABELLON']);
    const iSede = colOf(c, ['SEDE', 'CAMPUS']);
    const iPeriodo = colOf(c, ['PERIODO', 'CICLO']);
    const iDia = colOf(c, ['DIAS', 'DIA', 'DÍAS']);
    const iHoraIni = colOf(c, ['HORA INICIO PROGRAMADA', 'HORA INICIO', 'INICIO PROG', 'INICIO']);
    const iHoraFin = colOf(c, ['HORA FINAL PROGRAMADA', 'HORA FINAL', 'FIN PROG', 'FINAL']);
    const iAula = colOf(c, ['AULA', 'AMBIENTE']);
    const iNrc = colOf(c, ['NRC.', 'NRC', 'CODIGO CLASE']);
    const iCruzada = colOf(c, ['LISTA CRUZADA', 'CRUZADA']);
    const iCodDoc = colOf(c, ['CODIGO DE DOCENTE', 'CÓDIGO DE DOCENTE', 'CODIGO DOCENTE', 'COD DOCENTE', 'DNI']);
    const iDoc = colOf(c, ['DOCENTE', 'PROFESOR']);
    const iCur = colOf(c, ['CURSO', 'ASIGNATURA']);
    const iCar = colOf(c, ['CARRERA', 'PROGRAMA']);
    const iIniReal = colOf(c, ['HORA INICIO REAL']);
    const iFinReal = colOf(c, ['HORA FINAL REAL']);
    const iAsis = colOf(c, ['ASISTENCIA']);
    const iPunt = colOf(c, ['PUNTUALIDAD']);
    const iObs = colOf(c, ['OBSERVACION', 'OBSERVACIÓN']);

    for (let r = headerInfo.rowIndex + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row) continue;
      const aula = iAula >= 0 && row[iAula] ? String(row[iAula]).trim().toUpperCase() : (row[6] ? String(row[6]).trim().toUpperCase() : '');
      const docente = iDoc >= 0 && row[iDoc] ? String(row[iDoc]).trim().toUpperCase() : (row[10] ? String(row[10]).trim().toUpperCase() : '');
      const nrc = iNrc >= 0 && row[iNrc] ? String(row[iNrc]).trim() : (row[7] ? String(row[7]).trim() : '');
      if (!aula && !docente && !nrc) continue;
      if (aula === 'AULA' || docente === 'DOCENTE') continue;

      const rawAsis = iAsis >= 0 && row[iAsis] ? String(row[iAsis]).trim().toUpperCase() : '';
      const rawPunt = iPunt >= 0 && row[iPunt] ? String(row[iPunt]).trim().toUpperCase() : '';
      const iniReal = iIniReal >= 0 ? formatExcelTime(row[iIniReal]) : '';
      const finReal = iFinReal >= 0 ? formatExcelTime(row[iFinReal]) : '';

      asistencia.push({
        id: `asist_imp_${r}`,
        pisoPabellon: iPisoPab >= 0 && row[iPisoPab] ? String(row[iPisoPab]).trim() : (row[0] ? String(row[0]).trim() : ''),
        sede: iSede >= 0 && row[iSede] ? String(row[iSede]).trim() : 'Comas',
        periodo: iPeriodo >= 0 && row[iPeriodo] ? String(row[iPeriodo]).trim() : '2026-2',
        dia: iDia >= 0 && row[iDia] ? String(row[iDia]).trim().toUpperCase() : (row[3] ? String(row[3]).trim().toUpperCase() : ''),
        horaInicioProg: iHoraIni >= 0 ? formatExcelTime(row[iHoraIni]) : formatExcelTime(row[4]),
        horaFinalProg: iHoraFin >= 0 ? formatExcelTime(row[iHoraFin]) : formatExcelTime(row[5]),
        aula,
        nrc,
        listaCruzada: iCruzada >= 0 && row[iCruzada] ? String(row[iCruzada]).trim() : '',
        codigoDocente: iCodDoc >= 0 && row[iCodDoc] ? String(row[iCodDoc]).trim() : '',
        docente,
        curso: iCur >= 0 && row[iCur] ? String(row[iCur]).trim().toUpperCase() : '',
        carrera: iCar >= 0 && row[iCar] ? String(row[iCar]).trim() : '',
        horaInicioReal: iniReal,
        horaFinalReal: finReal,
        asistencia: rawAsis || 'PENDIENTE',
        puntualidad: rawPunt || '-',
        observacion: iObs >= 0 && row[iObs] ? String(row[iObs]).trim() : ''
      });
    }
  }

  const tickets = [];
  const atenSheets = sheetNames.filter(n => n.toUpperCase().includes('ATENCION'));
  for (const atenName of atenSheets) {
    const is20261 = atenName.includes('2026-1');
    const defaultPeriodo = is20261 ? '2026-1' : '2026-2';
    const atenRows = XLSX.utils.sheet_to_json(wb.Sheets[atenName], { header: 1 });
    if (!atenRows || atenRows.length === 0) continue;

    // Detección dinámica de cabeceras para no depender de índices fijos desplazados
    const headerInfo = findHeaderRow(atenRows, ['FECHA', 'AMBIENTE']) || {
      rowIndex: 1,
      cells: (atenRows[1] || []).map(c => String(c ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    };

    const c = headerInfo.cells;
    const iFecha = colOf(c, ['FECHA']);
    const iDia = colOf(c, ['DIA']);
    const iHora = colOf(c, ['HORA DE REPORTE', 'HORA']);
    const iRango = colOf(c, ['RANGO']);
    const iAmbiente = colOf(c, ['AMBIENTE', 'AULA']);
    const iPiso = colOf(c, ['PISO']);
    const iPabellon = colOf(c, ['PABELLON']);
    const iTipo = colOf(c, ['TIPO DE SOLICITUD', 'TIPO']);
    const iEstado = colOf(c, ['ESTADO']);
    const iUsuario = colOf(c, ['USUARIO']);
    const iDesc = colOf(c, ['DESCRIPCION / SOLUCION', 'DESCRIPCION', 'SOLUCION']);
    const iResp = colOf(c, ['RESPONSABLE']);

    for (let r = headerInfo.rowIndex + 1; r < atenRows.length; r++) {
      const row = atenRows[r];
      if (!row) continue;
      const ambVal = iAmbiente >= 0 && row[iAmbiente] ? String(row[iAmbiente]).trim().toUpperCase() : '';
      const tipVal = iTipo >= 0 && row[iTipo] ? String(row[iTipo]).trim().toUpperCase() : '';
      const fecVal = iFecha >= 0 ? formatExcelDate(row[iFecha]) : '';
      if (!ambVal && !tipVal && !fecVal) continue;

      const descVal = iDesc >= 0 && row[iDesc] !== undefined ? String(row[iDesc] || '').trim() : '';
      let usuVal = iUsuario >= 0 && row[iUsuario] ? String(row[iUsuario]).trim().toUpperCase() : '';
      if (!usuVal) {
        usuVal = descVal.toUpperCase().includes('ALUMNO') ? 'ALUMNO' : 'DOCENTE';
      }

      tickets.push({
        id: `ticket_${is20261 ? '1' : '2'}_${r}`,
        periodo: defaultPeriodo,
        fecha: fecVal,
        dia: iDia >= 0 && row[iDia] ? String(row[iDia]).trim().toUpperCase() : '',
        horaReporte: iHora >= 0 ? formatExcelTime(row[iHora]) : '',
        rango: iRango >= 0 && row[iRango] ? String(row[iRango]).trim() : '',
        ambiente: ambVal,
        piso: iPiso >= 0 && row[iPiso] !== undefined ? String(row[iPiso]).trim() : '',
        pabellon: iPabellon >= 0 && row[iPabellon] ? String(row[iPabellon]).trim().toUpperCase() : '',
        tipoSolicitud: tipVal || 'ASISTENCIA TÉCNICA',
        estado: iEstado >= 0 && row[iEstado] ? String(row[iEstado]).trim().toUpperCase() : 'ATENDIDO',
        usuario: usuVal,
        descripcionSolucion: descVal,
        responsable: iResp >= 0 && row[iResp] !== undefined ? String(row[iResp] || '').trim() : ''
      });
    }
  }

  const manualSheets = [];
  const manualSheetName =
    sheetNames.find(n => n.toUpperCase().includes('HOJA DE ASISTENCIA 2026-2')) ||
    sheetNames.find(n => n.toUpperCase().includes('HOJA DE ASISTENCIA'));
  if (manualSheetName && wb.Sheets[manualSheetName]) {
    const manRows = XLSX.utils.sheet_to_json(wb.Sheets[manualSheetName], { header: 1 });
    const headerInfo = findHeaderRow(manRows, ['CODIGO', 'NRC']) || {
      rowIndex: 1,
      cells: (manRows[1] || []).map(c => String(c ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    };
    const c = headerInfo.cells;
    const iCod = colOf(c, ['CODIGO']);
    const iFec = colOf(c, ['FECHA']);
    const iAula = colOf(c, ['AULA']);
    const iNrc = colOf(c, ['NRC']);
    const iCodDoc = colOf(c, ['CODIGO DE DOCENTE', 'CODIGO']);
    const iDoc = colOf(c, ['DOCENTE']);
    const iCur = colOf(c, ['CURSO']);
    const iCar = colOf(c, ['CARRERA']);
    const iMot = colOf(c, ['MOTIVO']);
    const iAsis = colOf(c, ['ASISTENTE']);
    const iReemp = colOf(c, ['DOCENTE REEMPLAZANTE', 'REEMPLAZANTE']);

    for (let r = headerInfo.rowIndex + 1; r < manRows.length; r++) {
      const row = manRows[r];
      if (!row) continue;
      const nHoja = iCod >= 0 && row[iCod] ? String(row[iCod]).trim().toUpperCase() : '';
      if (!nHoja || nHoja.includes('HOJA') || String(row[iDoc] || '').toUpperCase().includes('NOMBRE')) continue;
      const docente = iDoc >= 0 && row[iDoc] ? String(row[iDoc]).trim().toUpperCase() : '';
      const nrc = iNrc >= 0 && row[iNrc] ? String(row[iNrc]).trim() : '';
      const curso = iCur >= 0 && row[iCur] ? String(row[iCur]).trim().toUpperCase() : '';
      const docReemp = iReemp >= 0 && row[iReemp] ? String(row[iReemp]).trim().toUpperCase() : '';
      if (!docente && !nrc && !curso && !docReemp) continue;
      manualSheets.push({
        id: `manual_2_${r}`,
        n_hoja: nHoja.replace(/^LNI-/i, 'LN1-'),
        fecha: iFec >= 0 ? formatExcelDate(row[iFec]) : '',
        aula: iAula >= 0 && row[iAula] ? String(row[iAula]).trim().toUpperCase() : '',
        nrc,
        codigo_docente: iCodDoc >= 0 && row[iCodDoc] ? String(row[iCodDoc]).trim() : '',
        docente,
        curso,
        carrera: iCar >= 0 && row[iCar] ? String(row[iCar]).trim() : '',
        observacion: iAsis >= 0 && row[iAsis] ? String(row[iAsis]).trim() : '',
        docente_reemplazo: docReemp,
        motivo: iMot >= 0 && row[iMot] ? String(row[iMot]).trim() : (docReemp ? 'REEMPLAZO DOCENTE' : 'CLASE REGULAR'),
        estado_hoja: 'REGISTRADO'
      });
    }
  }

  const reservas = [];
  const resSheetName = sheetNames.find(n => n.toUpperCase().includes('RESERVA'));
  if (resSheetName && wb.Sheets[resSheetName]) {
    const resRows = XLSX.utils.sheet_to_json(wb.Sheets[resSheetName], { header: 1 });
    const headerInfo = findHeaderRow(resRows, ['FECHA', 'AULA']) || {
      rowIndex: 3,
      cells: (resRows[3] || []).map(c => String(c ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
    };
    const c = headerInfo.cells;
    const iFecha = colOf(c, ['FECHA']);
    const iMes = colOf(c, ['MES']);
    const iDia = colOf(c, ['DIA']);
    const iIni = colOf(c, ['INICIO']);
    const iFin = colOf(c, ['FINAL']);
    const iAula = colOf(c, ['AULA']);
    const iUbic = colOf(c, ['UBICACION']);
    const iDoc = colOf(c, ['DOCENTE']);
    const iDet = colOf(c, ['DETALLE']);
    const iUsu = colOf(c, ['USUARIO']);
    const iPrio = colOf(c, ['PRIORIDAD']);

    for (let r = headerInfo.rowIndex + 1; r < resRows.length; r++) {
      const row = resRows[r];
      if (!row) continue;
      const fecVal = iFecha >= 0 ? formatExcelDate(row[iFecha]) : '';
      const aulaVal = iAula >= 0 && row[iAula] ? String(row[iAula]).trim().toUpperCase() : '';
      if (!fecVal && !aulaVal) continue;
      reservas.push({
        id: `res_imp_${r}`,
        fecha: fecVal,
        mes: iMes >= 0 && row[iMes] ? String(row[iMes]).trim().toUpperCase() : '',
        dia: iDia >= 0 && row[iDia] ? String(row[iDia]).trim().toUpperCase() : '',
        inicio: iIni >= 0 ? formatExcelTime(row[iIni]) : '',
        final: iFin >= 0 ? formatExcelTime(row[iFin]) : '',
        aula: aulaVal,
        ubicacion: iUbic >= 0 && row[iUbic] ? String(row[iUbic]).trim() : '',
        docente: iDoc >= 0 && row[iDoc] ? String(row[iDoc]).trim().toUpperCase() : '',
        detalle: iDet >= 0 && row[iDet] ? String(row[iDet]).trim() : '',
        usuario: iUsu >= 0 && row[iUsu] ? String(row[iUsu]).trim().toUpperCase() : 'OPERACIONES',
        prioridad: iPrio >= 0 && row[iPrio] ? String(row[iPrio]).trim().toUpperCase() : 'NORMAL'
      });
    }
  }

  if (asistencia.length > 0 || tickets.length > 0 || manualSheets.length > 0 || reservas.length > 0) {
    await fetch('/api/import-excel-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asistencia, tickets, manualSheets, reservas, clearExisting: true })
    });
  }
}

async function checkExternalExcelChange() {
  if (!cachedHandle || isSyncingNow) return;
  try {
    const file = await cachedHandle.getFile();
    if (!lastKnownFileModified) {
      lastKnownFileModified = file.lastModified;
      return;
    }
    // Si el archivo en disco cambió (el usuario editó o borró algo en Excel)
    if (file.lastModified > lastKnownFileModified + 800) {
      isSyncingNow = true;
      notifyListeners({ linked: true, fileName: cachedHandle.name, status: 'syncing' });
      const buf = await file.arrayBuffer();
      await pullFromLinkedExcelToWeb(buf);
      lastKnownFileModified = file.lastModified;
      const nowStr = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      isSyncingNow = false;
      notifyListeners({ linked: true, fileName: cachedHandle.name, status: 'synced', lastSync: nowStr });
      return;
    }

    // Web -> file: si la BD cambió en la web
    if (await dbChanged()) await syncAllDataToLinkedExcel();
  } catch (e) {
    isSyncingNow = false;
  }
}

function startBidirectionalWatchLoop() {
  if (watchInterval) clearInterval(watchInterval);
  // Revisa cada 3 segundos en segundo plano
  watchInterval = setInterval(checkExternalExcelChange, 3000);

  // Y revisa INMEDIATAMENTE cuando el usuario vuelve al navegador desde Excel
  if (typeof window !== 'undefined' && !window.__liveExcelFocusBound) {
    window.__liveExcelFocusBound = true;
    window.addEventListener('focus', () => {
      checkExternalExcelChange();
    });
  }
}

export async function linkOneDriveExcelFile() {
  if (typeof window === 'undefined' || !('showOpenFilePicker' in window)) {
    throw new Error('Tu navegador no soporta vinculación directa de archivos locales. Usa Chrome o Edge en PC.');
  }

  const [handle] = await window.showOpenFilePicker({
    id: 'upn-onedrive-excel',
    multiple: false,
    types: [
      {
        description: 'Archivo Maestro Excel (.xlsx)',
        accept: {
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
        }
      }
    ]
  });

  if (!handle) return null;

  const perm = await handle.requestPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    throw new Error('Se requiere permiso de escritura para actualizar el Excel automáticamente.');
  }

  cachedHandle = handle;
  await saveFileHandleToIDB(handle);

  notifyListeners({
    linked: true,
    fileName: handle.name,
    status: 'linked',
    lastSync: null
  });

  await syncAllDataToLinkedExcel();
  startBidirectionalWatchLoop();
  return handle;
}

export async function restoreLinkedExcelIfPossible() {
  const handle = await loadFileHandleHandleSafe();
  if (!handle) return null;
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      cachedHandle = handle;
      const f = await handle.getFile();
      lastKnownFileModified = f.lastModified;
      notifyListeners({
        linked: true,
        fileName: handle.name,
        status: 'linked'
      });
      startBidirectionalWatchLoop();
      return handle;
    } else {
      notifyListeners({
        linked: false,
        needsReauth: true,
        fileName: handle.name,
        savedHandle: handle,
        status: 'needs_permission'
      });
      return null;
    }
  } catch (e) {
    return null;
  }
}

async function loadFileHandleHandleSafe() {
  try {
    return await loadFileHandleFromIDB();
  } catch (e) {
    return null;
  }
}

export async function reauthorizeSavedExcel() {
  const handle = await loadFileHandleHandleSafe();
  if (!handle) return linkOneDriveExcelFile();
  const perm = await handle.requestPermission({ mode: 'readwrite' });
  if (perm === 'granted') {
    cachedHandle = handle;
    notifyListeners({
      linked: true,
      fileName: handle.name,
      status: 'linked'
    });
    await syncAllDataToLinkedExcel();
    startBidirectionalWatchLoop();
    return handle;
  }
  throw new Error('Permiso no concedido');
}

export async function syncAllDataToLinkedExcel() {
  if (!cachedHandle || isSyncingNow) return false;
  isSyncingNow = true;
  notifyListeners({
    linked: true,
    fileName: cachedHandle.name,
    status: 'syncing'
  });

  try {
    if (!cachedTemplateBytes) {
      const tplRes = await fetch('/CONTROL_DOCENTE.xlsx');
      if (!tplRes.ok) throw new Error('No se pudo cargar la plantilla base');
      cachedTemplateBytes = new Uint8Array(await tplRes.arrayBuffer());
    }

    const [asistRes, ticketRes, manualRes, resRes] = await Promise.all([
      fetch('/api/attendance'),
      fetch('/api/tickets'),
      fetch('/api/manual-sheets'),
      fetch('/api/reservations')
    ]);

    const [asistJson, ticketJson, manualJson, resJson] = await Promise.all([
      asistRes.json(),
      ticketRes.json(),
      manualRes.json(),
      resRes.json()
    ]);

    const outputUint8 = buildMasterExcelFromTemplate(cachedTemplateBytes, {
      asistencia: asistJson.data || [],
      tickets: ticketJson.data || [],
      manualSheets: manualJson.data || [],
      reservas: resJson.data || []
    });

    const writable = await cachedHandle.createWritable();
    await writable.write(outputUint8);
    await writable.close();

    const updatedFile = await cachedHandle.getFile();
    lastKnownFileModified = updatedFile.lastModified;
    lastLocalSyncAt = Date.now();

    const nowStr = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    isSyncingNow = false;
    notifyListeners({
      linked: true,
      fileName: cachedHandle.name,
      status: 'synced',
      lastSync: nowStr
    });
    return true;
  } catch (err) {
    isSyncingNow = false;
    notifyListeners({
      linked: Boolean(cachedHandle),
      fileName: cachedHandle?.name || null,
      status: 'error',
      error: err.message
    });
    return false;
  }
}

export function triggerLiveExcelSync() {
  if (!cachedHandle) return;
  // Coalesce: como máximo una relectura completa (4 tablas) cada 30 s.
  // Antes cada escritura releía las 4 tablas 600 ms después y, en una ronda de
  // asistencia con varios docentes escribiendo, agotaba el límite diario de D1.
  if (syncTimer) return;
  const wait = Math.max(0, LOCAL_SYNC_MIN_MS - (Date.now() - lastLocalSyncAt));
  syncTimer = setTimeout(() => {
    syncTimer = null;
    lastLocalSyncAt = Date.now();
    if (cachedHandle) syncAllDataToLinkedExcel();
  }, wait);
}

export const triggerAutoSyncLinkedExcel = triggerLiveExcelSync;

