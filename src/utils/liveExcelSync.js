/**
 * Sincronización BIDIRECCIONAL en tiempo real con el archivo Excel original (OneDrive / PC)
 * - Si registras algo en la Web App -> Sobrescribe automáticamente el Excel vinculado con tus colores y fórmulas.
 * - Si editas y guardas el Excel vinculado -> Detecta el cambio automáticamente y jala la data hacia la Web App.
 */
import * as XLSX from 'xlsx';
import { buildMasterExcelFromTemplate } from './excelTemplateExporter';

const DB_NAME = 'upn_onedrive_excel_sync_db';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'master_excel_handle';

let cachedHandle = null;
let cachedTemplateBytes = null;
let syncTimer = null;
let watchInterval = null;
let isSyncingNow = false;
let lastKnownFileModified = 0;
let lastKnownWebSign = '';
const listeners = new Set();

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
      observacion: row[17] ? String(row[17]).trim() : ''
    });
  }

  const tickets = [];
  const atenSheets = sheetNames.filter(n => n.toUpperCase().includes('ATENCION'));
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

  const manualSheets = [];
  const manualSheetName =
    sheetNames.find(n => n.toUpperCase().includes('HOJA DE ASISTENCIA 2026-2')) ||
    sheetNames.find(n => n.toUpperCase().includes('HOJA DE ASISTENCIA'));
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

  if (asistencia.length > 0) {
    await fetch('/api/import-excel-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asistencia, tickets, manualSheets, clearExisting: true })
    });
  }
}

function startBidirectionalWatchLoop() {
  if (watchInterval) clearInterval(watchInterval);
  watchInterval = setInterval(async () => {
    if (!cachedHandle || isSyncingNow) return;
    try {
      const file = await cachedHandle.getFile();
      if (lastKnownFileModified && file.lastModified > lastKnownFileModified + 1500) {
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

      const res = await fetch('/api/all-data');
      if (res.ok) {
        const j = await res.json();
        if (j.success && j.data) {
          const sign = `${(j.data.asistencia || []).map(a => `${a.id}:${a.asistencia}:${a.puntualidad}`).join('|')}#${(j.data.tickets || []).length}#${(j.data.manualSheets || []).length}#${(j.data.reservas || []).length}`;
          if (lastKnownWebSign && sign !== lastKnownWebSign) {
            lastKnownWebSign = sign;
            await syncAllDataToLinkedExcel();
          } else if (!lastKnownWebSign) {
            lastKnownWebSign = sign;
          }
        }
      }
    } catch (e) {
      isSyncingNow = false;
    }
  }, 4000);
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
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncAllDataToLinkedExcel();
  }, 600);
}

export const triggerAutoSyncLinkedExcel = triggerLiveExcelSync;

