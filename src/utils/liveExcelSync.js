/**
 * Sincronización en tiempo real con el archivo Excel original (OneDrive / PC)
 * Usa File System Access API (showOpenFilePicker) para vincular directamente el archivo
 * CONTROL DOCENTE.xlsx ubicado en la carpeta local de OneDrive y sobrescribirlo
 * automáticamente cada vez que se registra asistencia, suplente, préstamo, hoja manual o reserva,
 * conservando 100% el modelo, colores, formatos y fórmulas originales.
 */
import { buildMasterExcelFromTemplate } from './excelTemplateExporter';

const DB_NAME = 'upn_onedrive_excel_sync_db';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'master_excel_handle';

let cachedHandle = null;
let cachedTemplateBytes = null;
let syncTimer = null;
let isSyncingNow = false;
const listeners = new Set();

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
 * Abre el selector nativo para que el usuario elija su archivo CONTROL DOCENTE.xlsx
 * dentro de su carpeta de OneDrive y activa el guardado automático en tiempo real.
 */
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

  // Ejecutar una primera sincronización inmediata para dejar el archivo al día
  await syncAllDataToLinkedExcel();
  return handle;
}

/**
 * Restaura el archivo vinculado previamente en la sesión si existe en IndexedDB
 */
export async function restoreLinkedExcelIfPossible() {
  const handle = await loadFileHandleHandleSafe();
  if (!handle) return null;
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      cachedHandle = handle;
      notifyListeners({
        linked: true,
        fileName: handle.name,
        status: 'linked'
      });
      return handle;
    } else {
      // Está guardado pero requiere 1 clic para reautorizar tras recargar el navegador
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
    return handle;
  }
  throw new Error('Permiso no concedido');
}

/**
 * Descarga toda la data actual de la BD y sobrescribe el archivo Excel vinculado en OneDrive
 */
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
    console.warn('Error sincronizando con Excel en OneDrive:', err);
    notifyListeners({
      linked: Boolean(cachedHandle),
      fileName: cachedHandle?.name || null,
      status: 'error',
      error: err.message
    });
    return false;
  }
}

/**
 * Encola una sincronización con debounce (800ms) para no bloquear la interfaz
 * cuando el usuario marca varias asistencias seguidas.
 */
export function triggerAutoSyncLinkedExcel() {
  if (!cachedHandle) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncAllDataToLinkedExcel();
  }, 800);
}
