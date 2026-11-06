/**
 * Puerta barata para el polling "silent" multi-usuario.
 *
 * Antes de re-leer tablas completas se consulta /api/web-sign (1 fila en D1).
 * Solo se re-jala la data si la BD tuvo alguna escritura desde la última vez.
 *
 * La consulta se comparte entre TODOS los componentes de la misma pestaña:
 * como máximo se hace una petición cada MIN_INTERVAL_MS, aunque haya varios
 * pollers (asistencia, dashboard, tickets, firmas) corriendo a la vez.
 */
const MIN_INTERVAL_MS = 4000;

let sharedTs = 0; // último timestamp leído del servidor
let sharedAt = 0; // momento (ms) de la última lectura real
let inflight = null; // petición en curso compartida

function readServerTs() {
  if (inflight) return inflight;
  if (Date.now() - sharedAt < MIN_INTERVAL_MS) return Promise.resolve(sharedTs);

  inflight = (async () => {
    try {
      const res = await fetch('/api/web-sign', { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok || !j.success) return null;
      sharedTs = Number(j.ts) || 0;
      return sharedTs;
    } catch (_) {
      return null;
    } finally {
      sharedAt = Date.now();
      inflight = null;
    }
  })();

  return inflight;
}

export function createDbChangeGate(options = {}) {
  const fireOnFirst = options.fireOnFirst !== false;
  let lastTs = null;

  return async function dbChanged() {
    // Pestaña en segundo plano: no gastar peticiones. Al volver a primer plano
    // el siguiente tick comparará contra el último ts conocido y refrescará.
    if (typeof document !== 'undefined' && document.hidden) return false;

    const ts = await readServerTs();
    if (ts === null) return true; // fail-open: error de red -> permitir lectura normal

    // Primer chequeo: en componentes se permite la carga inicial; en el watcher
    // del Excel no, para no reescribir el archivo sin cambios reales.
    const changed = lastTs === null ? fireOnFirst : ts !== lastTs;
    lastTs = ts;
    return changed;
  };
}
