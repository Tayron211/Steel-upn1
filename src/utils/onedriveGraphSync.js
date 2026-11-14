/**
 * Sincronización BIDIRECCIONAL App <-> Excel de OneDrive (Microsoft Graph).
 * - push: BD -> Excel (respeta fórmulas, formatos y columnas por NOMBRE de encabezado)
 * - pull: Excel -> BD (cuando alguien edita el Excel directamente en OneDrive)
 */
const G = 'https://graph.microsoft.com/v1.0';
const TENANT_ID = 'ae544a57-aecb-4bf9-828a-5b520732b110';
const CLIENT_ID = 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
const enc = encodeURIComponent;

/* ------------------------------ utilidades ------------------------------ */
const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const colLetter = (n) => {
  let s = '';
  n += 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

function serialToISO(v) {
  if (typeof v === 'number' && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const str = String(v ?? '').trim();
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return str;
}
function toExcelDate(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = d.getUTCFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  }
  const str = String(v).trim();
  const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) {
    return `${ymd[3].padStart(2, '0')}/${ymd[2].padStart(2, '0')}/${ymd[1]}`;
  }
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
  }
  return str;
}
function isoToSerial(s) {
  const str = String(s ?? '').trim();
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 + 25569;
  }
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    return Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1]) / 86400000 + 25569;
  }
  return s ?? '';
}
function fracToHHMM(v) {
  if (typeof v === 'number') {
    const f = v >= 1 ? v - Math.floor(v) : v;
    const t = Math.round(f * 1440);
    return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }
  const m = String(v ?? '').match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : String(v ?? '').trim();
}
function hhmmToFrac(s) {
  const m = String(s ?? '').match(/^(\d{1,2}):(\d{2})/);
  return m ? (+m[1] * 60 + +m[2]) / 1440 : s ?? '';
}

/* canon: valor comparable entre BD y Excel */
function canon(type, v) {
  if (type === 'date') return serialToISO(v);
  if (type === 'time') return fracToHHMM(v);
  return String(v ?? '').trim();
}
/* a celda de Excel */
function toCell(type, v) {
  if (v === null || v === undefined) return '';
  if (type === 'date') {
    const s = isoToSerial(v);
    return typeof s === 'number' && !isNaN(s) ? s : toExcelDate(v);
  }
  if (type === 'time') return hhmmToFrac(v);
  if (type === 'num') return /^\d+$/.test(String(v).trim()) ? Number(v) : String(v);
  return String(v);
}

/* ------------------------------- Graph / auth ------------------------------- */
async function gfetch(token, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_) { }
  return { ok: res.ok, status: res.status, json };
}

// Tablas e índices para Cloudflare D1
export async function ensureTables(db) {
  try { await db.prepare('ALTER TABLE reservas ADD COLUMN motivo TEXT').run(); } catch (_) { }
  try { await db.prepare('ALTER TABLE reservas ADD COLUMN obs TEXT').run(); } catch (_) { }
  try { await db.prepare('ALTER TABLE reservas ADD COLUMN hoja TEXT').run(); } catch (_) { }
}
async function getState(db, k) {
  const r = await db.prepare('SELECT v FROM onedrive_state WHERE k = ?').bind(k).first();
  return r ? r.v : null;
}
async function setState(db, k, v) {
  await db.prepare('INSERT OR REPLACE INTO onedrive_state (k, v) VALUES (?, ?)').bind(k, String(v)).run();
}

/**
 * Marca que la BD cambió para que los clientes (vía /api/web-sign) refresquen.
 * Necesario cuando las escrituras no pasan por la API (ej. pull Excel -> D1),
 * ya que el hook de /api/* solo detecta POST/PUT/DELETE de la propia API.
 */
export async function markDbWrite(db) {
  await setState(db, 'last_write_ts', String(Date.now()));
}

async function getAccess(db) {
  const row = await db.prepare('SELECT * FROM onedrive_auth WHERE id = ?').bind('primary').first();
  if (!row || !row.refresh_token) return null;
  let token = row.access_token;
  if (!token || Date.now() > Number(row.expires_at || 0) - 120000) {
    const r = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        refresh_token: row.refresh_token,
        scope: 'https://graph.microsoft.com/.default offline_access'
      })
    });
    const j = await r.json();
    if (!r.ok || !j.access_token) return null;
    token = j.access_token;
    await db
      .prepare(
        "UPDATE onedrive_auth SET access_token = ?, refresh_token = COALESCE(?, refresh_token), expires_at = ? WHERE id = 'primary'"
      )
      .bind(token, j.refresh_token || null, Date.now() + Number(j.expires_in || 3600) * 1000)
      .run();
  }

  // Auto-resolver y asegurar que apunte a CONTROL DOCENTE - TEST.xlsx
  try {
    const targets = await findTargets(token, row);
    if (targets.length > 0 && targets[0].id && (targets[0].id !== row.item_id || !row.item_id)) {
      await db
        .prepare("UPDATE onedrive_auth SET item_id = ?, file_name = ? WHERE id = 'primary'")
        .bind(targets[0].id, targets[0].name)
        .run();
      row.item_id = targets[0].id;
      row.file_name = targets[0].name;
    }
  } catch (_) { }

  return { token, row };
}

export async function findTargets(token, row) {
  const targets = [];
  const r = await gfetch(token, `${G}/me/drive/root/search(q='CONTROL DOCENTE')`);
  if (r.ok) {
    for (const f of r.json?.value || []) {
      const nm = String(f.name || '');
      if (nm.toUpperCase().includes('CONTROL DOCENTE') && nm.toLowerCase().endsWith('.xlsx')) {
        targets.push({ id: f.id, name: nm, lastModifiedDateTime: f.lastModifiedDateTime });
      }
    }
  }

  // Ordenar priorizando estrictamente "CONTROL DOCENTE - TEST.xlsx"
  targets.sort((a, b) => {
    const aTest = a.name.toUpperCase().includes('TEST') ? 1 : 0;
    const bTest = b.name.toUpperCase().includes('TEST') ? 1 : 0;
    if (aTest !== bTest) return bTest - aTest;
    return String(b.lastModifiedDateTime || '').localeCompare(String(a.lastModifiedDateTime || ''));
  });

  if (targets.length === 0 && row?.item_id) {
    targets.push({ id: row.item_id, name: row.file_name || 'CONTROL DOCENTE - TEST.xlsx' });
  }
  return targets;
}

export async function findPrimaryTarget(token, row) {
  const targets = await findTargets(token, row);
  return targets[0] || (row?.item_id ? { id: row.item_id, name: row.file_name } : null);
}

async function itemMod(token, itemId) {
  const r = await gfetch(token, `${G}/me/drive/items/${itemId}?$select=lastModifiedDateTime`);
  return r.ok ? r.json?.lastModifiedDateTime || '' : '';
}

/* ------------------------------ hojas del libro ------------------------------ */
async function loadUsed(token, itemId, sheet) {
  const r = await gfetch(
    token,
    `${G}/me/drive/items/${itemId}/workbook/worksheets/${enc(sheet)}/usedRange?$select=values,formulas,rowIndex,columnIndex`
  );
  return r.ok ? r.json : null;
}

function findHeader(used, musts) {
  const vals = used?.values || [];
  for (let r = 0; r < Math.min(vals.length, 12); r++) {
    const cells = (vals[r] || []).map(norm);
    if (musts.every((m) => cells.some((c) => c === m || c.startsWith(m) || c.includes(m)))) return { row: r, cells };
  }
  return null;
}
function colOf(cells, names) {
  for (const n of names) {
    let i = cells.findIndex((c) => c === n);
    if (i < 0) i = cells.findIndex((c) => c.startsWith(n));
    if (i < 0) i = cells.findIndex((c) => c.includes(n));
    if (i >= 0) return i;
  }
  return -1;
}

async function patchRange(token, itemId, sheet, address, matrix, fmtMatrix = null) {
  let hasFormulas = false;
  const valuesMatrix = [];
  const formulasMatrix = [];

  for (let r = 0; r < matrix.length; r++) {
    const vRow = [];
    const fRow = [];
    const row = matrix[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (typeof cell === 'string' && cell.startsWith('=')) {
        hasFormulas = true;
        fRow.push(cell);
        vRow.push(null);
      } else {
        vRow.push(cell === undefined || cell === null ? '' : cell);
        fRow.push(null);
      }
    }
    valuesMatrix.push(vRow);
    formulasMatrix.push(fRow);
  }

  const body = { values: valuesMatrix };
  if (hasFormulas) {
    body.formulas = formulasMatrix;
  }
  if (fmtMatrix) {
    body.numberFormat = fmtMatrix;
  }

  return gfetch(token, `${G}/me/drive/items/${itemId}/workbook/worksheets/${enc(sheet)}/range(address='${address}')`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}
const patchFormulas = patchRange;

/* ---- repara encabezados dañados por versiones anteriores ---- */
async function repairHeaders(token, itemId, spec, used) {
  if (findHeader(used, spec.musts)) return used;
  const cols = spec.headerCells.length;
  const addr = `${spec.headerStartCol}${spec.headerRow}:${colLetter(spec.headerStartColIdx + cols - 1)}${spec.headerRow}`;
  await patchFormulas(token, itemId, spec.sheet, addr, [spec.headerCells]);
  if (spec.clearRows) {
    for (const rr of spec.clearRows) {
      const a = `${spec.headerStartCol}${rr}:${colLetter(spec.headerStartColIdx + cols - 1)}${rr}`;
      await patchFormulas(token, itemId, spec.sheet, a, [new Array(cols).fill('')]);
    }
  }
  return loadUsed(token, itemId, spec.sheet);
}

/* ------------------------------ especificaciones ------------------------------ */
const T = { date: 'date', time: 'time', num: 'num', str: 'str' };

const SPECS = {
  tickets: {
    sheet: 'ATENCIONES 2026-2',
    musts: ['FECHA', 'AMBIENTE'],
    headerRow: 2,
    headerStartCol: 'A',
    headerStartColIdx: 0,
    headerCells: ['FECHA', 'DIA', 'HORA DE REPORTE', 'RANGO', 'AMBIENTE', 'PISO', 'PABELLÓN', 'TIPO DE SOLICITUD', 'ESTADO', 'USUARIO', 'DESCRIPCIÓN / SOLUCIÓN', 'RESPONSABLE'],
    fields: [
      { k: 'fecha', h: ['FECHA'], t: T.date },
      { k: 'dia', h: ['DIA'], t: T.str, up: true },
      { k: 'hora_reporte', h: ['HORA DE REPORTE', 'HORA'], t: T.time },
      { k: 'rango', h: ['RANGO'], t: T.str },
      { k: 'ambiente', h: ['AMBIENTE'], t: T.str, up: true },
      { k: 'piso', h: ['PISO'], t: T.str },
      { k: 'pabellon', h: ['PABELLON'], t: T.str },
      { k: 'tipo_solicitud', h: ['TIPO DE SOLICITUD', 'TIPO'], t: T.str },
      { k: 'estado', h: ['ESTADO'], t: T.str, up: true },
      { k: 'usuario', h: ['USUARIO'], t: T.str, up: true },
      { k: 'descripcion_solucion', h: ['DESCRIPCION'], t: T.str },
      { k: 'responsable', h: ['RESPONSABLE'], t: T.str }
    ],
    required: ['ambiente', 'tipo_solicitud'],
    key: (r) => norm([canon('date', r.fecha), canon('time', r.hora_reporte), r.ambiente, r.tipo_solicitud].join('|')),
    table: 'tickets',
    hasUpdated: true,
    select: "SELECT * FROM tickets WHERE periodo IS NULL OR periodo != '2026-1'",
    sort: (a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')) || String(a.hora_reporte || '').localeCompare(String(b.hora_reporte || '')),
    prefill: (r) => {
      const hasSign1 = Boolean(
        (r.firma_recepcion && String(r.firma_recepcion).length > 20) ||
        (r.firmaRecepcion && String(r.firmaRecepcion).length > 20)
      );
      const hasSign2 = Boolean(
        (r.firma_devolucion && String(r.firma_devolucion).length > 20) ||
        (r.firmaDevolucion && String(r.firmaDevolucion).length > 20) ||
        (r.firma_entrega && String(r.firma_entrega).length > 20) ||
        (r.firmaEntrega && String(r.firmaEntrega).length > 20)
      );
      const isDevuelto = Boolean(
        r.fecha_devolucion ||
        r.fechaDevolucion ||
        String(r.descripcion_solucion || r.descripcionSolucion || '').toUpperCase().includes('DEVUELTO')
      );

      // Regla: Solo saldrá ATENDIDO en el Excel cuando estén las dos firmas Y esté devuelto.
      // Mientras solo esté en una firma (o ninguna), seguirá EN PROCESO.
      const computedEstado = (hasSign1 && hasSign2 && isDevuelto) ? 'ATENDIDO' : 'EN PROCESO';

      return {
        ...r,
        estado: computedEstado,
        usuario: r.usuario || (String(r.descripcion_solucion || '').toUpperCase().includes('ALUMNO') ? 'ALUMNO' : 'DOCENTE')
      };
    },
    insert: (db, id, r) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO tickets (id, periodo, fecha, dia, hora_reporte, rango, ambiente, piso, pabellon, tipo_solicitud, estado, usuario, descripcion_solucion, responsable, created_at)
           VALUES (?, '2026-2', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(id, r.fecha, r.dia, r.hora_reporte, r.rango, r.ambiente, r.piso, r.pabellon, r.tipo_solicitud, r.estado || 'ATENDIDO', r.usuario || 'DOCENTE', r.descripcion_solucion, r.responsable)
  },
  manuales: {
    sheet: 'HOJA DE ASISTENCIA 2026-2',
    musts: ['CODIGO', 'NRC'],
    headerRow: 2,
    headerStartCol: 'A',
    headerStartColIdx: 0,
    headerCells: ['CÓDIGO', 'FECHA ', 'NRC', 'DOCENTE', 'CURSO', 'CARRERA', 'MOTIVO', 'ASISTENTE', 'DOCENTE REEMPLAZANTE'],
    fields: [
      { k: 'codigo', h: ['CODIGO'], t: T.str, up: true },
      { k: 'fecha', h: ['FECHA'], t: T.date },
      { k: 'nrc', h: ['NRC'], t: T.num },
      { k: 'docente', h: ['DOCENTE'], t: T.str, up: true, exact: true },
      { k: 'curso', h: ['CURSO'], t: T.str },
      { k: 'carrera', h: ['CARRERA'], t: T.str },
      { k: 'motivo', h: ['MOTIVO'], t: T.str },
      { k: 'asistente', h: ['ASISTENTE'], t: T.str },
      { k: 'docente_reemplazo', h: ['DOCENTE REEMPLAZANTE', 'REEMPLAZANTE'], t: T.str, up: true }
    ],
    required: ['codigo'],
    key: (r) => norm(String(r.codigo || '').replace(/^LNI-/i, 'LN1-')),
    table: 'hojas_manuales',
    select: "SELECT * FROM hojas_manuales WHERE codigo IS NOT NULL AND codigo != '' AND ((docente IS NOT NULL AND TRIM(docente) != '' AND docente NOT LIKE '%#N/D%') OR (nrc IS NOT NULL AND TRIM(nrc) != '') OR (fecha IS NOT NULL AND TRIM(fecha) != ''))",
    sort: (a, b) => {
      const n = (s) => {
        const m = String(s || '').match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 999999;
      };
      return n(a.codigo) - n(b.codigo);
    },
    prefill: (r, ctx) => {
      const rawNrc = String(r.nrc || '').trim();
      const paddedNrc = rawNrc ? rawNrc.padStart(5, '0') : '';
      const unpaddedNrc = rawNrc ? rawNrc.replace(/^0+/, '') : '';
      const cleanCurso = String(r.curso || '').trim().toUpperCase();

      const info = (ctx.nrcMap && (ctx.nrcMap.get(rawNrc) || ctx.nrcMap.get(paddedNrc) || ctx.nrcMap.get(unpaddedNrc)))
        || (ctx.courseMap && ctx.courseMap.get(cleanCurso))
        || {};

      let doc = String(r.docente || info.docente || '');
      let rep = String(r.docente_reemplazo || r.docenteReemplazo || '').trim();
      const mDoc = doc.match(/^(.*?)\s*\[Reemplazo:\s*(.*?)\]$/i);
      if (mDoc) {
        doc = mDoc[1].trim();
        if (!rep) rep = mDoc[2].trim();
      }
      if (!rep && r.motivo) {
        const mMot = String(r.motivo).match(/DOCENTE DE REEMPLAZO\s*\((.*?)\)/i);
        if (mMot) rep = mMot[1].trim();
      }
      if (!rep && r.detalle) {
        const mDet = String(r.detalle).match(/Reemplaza:\s*([^|]+)/i);
        if (mDet) rep = mDet[1].trim();
      }
      const cleanMotivo = String(r.motivo || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
      return {
        ...r,
        docente: doc,
        curso: r.curso || info.curso || '',
        carrera: r.carrera || info.carrera || '',
        motivo: cleanMotivo,
        docente_reemplazo: rep ? rep.toUpperCase() : ''
      };
    },
    insert: (db, id, r) =>
      db
        .prepare(
          `INSERT INTO hojas_manuales (id, periodo, codigo, fecha, nrc, docente, curso, carrera, motivo, asistente, docente_reemplazo, created_at)
           VALUES (?, '2026-2', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(codigo) DO UPDATE SET
             fecha = excluded.fecha,
             nrc = excluded.nrc,
             docente = excluded.docente,
             curso = excluded.curso,
             carrera = CASE 
               WHEN excluded.carrera IS NOT NULL AND TRIM(excluded.carrera) != '' THEN excluded.carrera 
               ELSE hojas_manuales.carrera 
             END,
             motivo = excluded.motivo,
             asistente = excluded.asistente,
             docente_reemplazo = excluded.docente_reemplazo`
        )
        .bind(
          id,
          String(r.codigo).replace(/^LNI-/i, 'LN1-'),
          r.fecha,
          r.nrc,
          r.docente,
          r.curso,
          r.carrera,
          r.motivo,
          r.asistente,
          r.docente_reemplazo || ''
        )
  },
  reservas: {
    sheet: 'RESERVAS',
    musts: ['FECHA', 'AULA'],
    headerRow: 4,
    headerStartCol: 'B',
    headerStartColIdx: 1,
    headerCells: ['FECHA', 'MES', 'DIA', 'INICIO', 'FINAL', 'AULA', 'UBICACIÓN', 'DOCENTE', 'DETALLE', 'USUARIO', 'PRIORIDAD'],
    clearRows: [2, 3],
    fields: [
      { k: 'fecha', h: ['FECHA'], t: T.date },
      { k: 'mes', h: ['MES'], t: T.str, up: true },
      { k: 'dia', h: ['DIA'], t: T.str, up: true },
      { k: 'inicio', h: ['INICIO'], t: T.time },
      { k: 'final', h: ['FINAL'], t: T.time },
      { k: 'aula', h: ['AULA'], t: T.str, up: true },
      { k: 'ubicacion', h: ['UBICACION'], t: T.str },
      { k: 'docente', h: ['DOCENTE'], t: T.str, up: true },
      { k: 'detalle', h: ['DETALLE'], t: T.str, up: true },
      { k: 'usuario', h: ['USUARIO'], t: T.str, up: true },
      { k: 'prioridad', h: ['PRIORIDAD'], t: T.str, up: true }
    ],
    required: ['fecha', 'aula'],
    key: (r) => norm([canon('date', r.fecha), r.aula, canon('time', r.inicio)].join('|')),
    table: 'reservas',
    select: 'SELECT * FROM reservas',
    sort: (a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')) || String(a.inicio || '').localeCompare(String(b.inicio || '')),
    prefill: (r) => r,
    insert: (db, id, r) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO reservas (id, fecha, mes, dia, inicio, final, aula, ubicacion, docente, detalle, usuario, prioridad, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(id, r.fecha, r.mes, r.dia, r.inicio, r.final, r.aula, r.ubicacion, r.docente, r.detalle, r.usuario || 'OPERACIONES', r.prioridad || 'NORMAL')
  }
};

function resolveCols(spec, cells) {
  return spec.fields.map((f) => {
    let idx = -1;
    if (f.exact) idx = cells.findIndex((c) => c === f.h[0]);
    else idx = colOf(cells, f.h.map(norm));
    return { ...f, idx };
  });
}

function mapDay(s) {
  if (!s) return '';
  const clean = norm(String(s));
  const days = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
  for (const d of days) {
    if (clean.startsWith(d) || clean.includes(d)) return d;
  }
  return clean;
}

/* ============================== PULL (Excel -> BD) ============================== */
async function pullRecords(db, specName, used) {
  const spec = SPECS[specName];
  const hdr = findHeader(used, spec.musts);
  if (!hdr) return 0;
  const cols = resolveCols(spec, hdr.cells);
  const dbRows = (await db.prepare(spec.select).all()).results || [];
  const byKey = new Map();
  for (const r of dbRows) {
    const k = spec.key(r);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r);
  }

  const recs = [];
  for (let r = hdr.row + 1; r < used.values.length; r++) {
    const row = used.values[r];
    const rec = {};
    for (const c of cols) {
      if (c.idx < 0) continue;
      let v = canon(c.t, row[c.idx]);
      if (c.up) v = v.toUpperCase();
      rec[c.k] = v;
    }
    if (spec.required.some((k) => !rec[k])) {
      continue;
    }
    // Para hojas manuales: ignorar filas de plantilla vacía en Excel (#N/D y sin nrc/fecha)
    if (specName === 'manuales') {
      const doc = String(rec.docente || '').trim();
      const nrc = String(rec.nrc || '').trim();
      const fec = String(rec.fecha || '').trim();
      if ((!nrc || nrc === '') && (!fec || fec === '') && (!doc || doc === '' || doc.includes('#N/D') || doc.includes('#N/A'))) {
        continue;
      }
    }
    recs.push(rec);
  }

  const upd = spec.hasUpdated ? ", updated_at = datetime('now')" : '';
  const claimed = new Set();
  const stmts = [];
  let changes = 0;
  const newInsertedIds = [];

  for (const rec of recs) {
    const k = spec.key(rec);
    const q = byKey.get(k);
    const hit = q && q.find((d) => !claimed.has(d.id));
    if (hit) {
      claimed.add(hit.id);
      const sets = [];
      const vals = [];
      for (const c of cols) {
        if (c.idx < 0) continue;
        if (c.k === 'codigo' && specName === 'manuales') continue;
        const dbv = canon(c.t, hit[c.k]);
        const cmp = c.up ? dbv.toUpperCase() : dbv;
        if (cmp !== rec[c.k]) {
          sets.push(`${c.k} = ?`);
          vals.push(rec[c.k]);
        }
      }
      if (sets.length) {
        changes++;
        stmts.push(db.prepare(`UPDATE ${spec.table} SET ${sets.join(', ')}${upd} WHERE id = ?`).bind(...vals, hit.id));
      }
    } else {
      changes++;
      const id = `xl_${specName}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      newInsertedIds.push(id);
      stmts.push(spec.insert(db, id, rec));
    }
  }

  // Si se eliminaron filas en el Excel, eliminarlas de la base de datos (Sincronización Bidireccional)
  let snapshotIds = new Set();
  try {
    const rawSnap = await getState(db, `ids:${specName}`);
    if (rawSnap) {
      const arr = JSON.parse(rawSnap);
      if (Array.isArray(arr)) snapshotIds = new Set(arr);
    }
  } catch (_) { }

  const isRowRecent = (r) => {
    if (!r || !r.created_at) return false;
    const t = new Date(r.created_at.includes('Z') ? r.created_at : r.created_at.replace(' ', 'T') + 'Z').getTime();
    return !isNaN(t) && (Date.now() - t < 45000);
  };

  const survivingIds = [];
  for (const r of dbRows) {
    if (claimed.has(r.id)) {
      survivingIds.push(r.id);
    } else {
      // Si la fila no está en Excel:
      // Las reservas creadas en la app (id que empieza con 'res_') son persistentes y no deben ser eliminadas por pull
      if (specName === 'reservas' && String(r.id || '').startsWith('res_')) {
        survivingIds.push(r.id);
        continue;
      }
      // Si existía en el snapshot previo, o si se fuerza la sincronización, o si no es una creación ultra-reciente (<45s):
      if (snapshotIds.has(r.id) || (snapshotIds.size === 0 && !isRowRecent(r)) || opts?.force) {
        changes++;
        stmts.push(db.prepare(`DELETE FROM ${spec.table} WHERE id = ?`).bind(r.id));
      } else {
        survivingIds.push(r.id);
      }
    }
  }

  for (let i = 0; i < stmts.length; i += 50) {
    try {
      await db.batch(stmts.slice(i, i + 50));
    } catch (err) {
      console.error(`Error in batch ${specName}:`, err);
    }
  }

  // Guardar snapshot de IDs para que futuros borrados en Excel se detecten inmediatamente
  const allCurrentIds = [...survivingIds, ...newInsertedIds];
  await setState(db, `ids:${specName}`, JSON.stringify(allCurrentIds));

  return changes;
}

async function pullAsistencia(db, used, opts = {}) {
  const hdr = findHeader(used, ['AULA', 'NRC']);
  if (!hdr) return 0;
  const c = hdr.cells;
  const iDia = colOf(c, ['DIAS', 'DIA']);
  const iAula = colOf(c, ['AULA']);
  const iNrc = colOf(c, ['NRC']);
  const iIni = colOf(c, ['HORA INICIO REAL']);
  const iFin = colOf(c, ['HORA FINAL REAL']);
  const iAs = colOf(c, ['ASISTENCIA']);
  const iPu = colOf(c, ['PUNTUALIDAD']);
  const iOb = colOf(c, ['OBSERVACION', 'OBSERVACIÓN', 'OBS', 'OBSER']);
  const dbRows = (await db.prepare('SELECT * FROM asistencia').all()).results || [];
  const byKey = new Map();
  for (const r of dbRows) {
    const k = `${String(r.nrc || '').trim()}|${mapDay(r.dia)}|${String(r.aula || '').trim().toUpperCase()}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r);
  }
  const stmts = [];
  for (let r = hdr.row + 1; r < used.values.length; r++) {
    const row = used.values[r];
    const k = `${String(row[iNrc] ?? '').trim()}|${mapDay(row[iDia])}|${String(row[iAula] ?? '').trim().toUpperCase()}`;
    const list = byKey.get(k);
    if (!list) continue;
    const ini = iIni >= 0 ? fracToHHMM(row[iIni]) : '';
    const fin = iFin >= 0 ? fracToHHMM(row[iFin]) : '';
    const rawAsi = iAs >= 0 ? String(row[iAs] ?? '').trim().toUpperCase() : '';
    const asi = rawAsi ? (rawAsi === 'PENDIENTE' ? 'PENDIENTE' : rawAsi) : 'PENDIENTE';
    const rawPu = iPu >= 0 ? String(row[iPu] ?? '').trim().toUpperCase() : '';
    const pun = rawPu ? (rawPu === '-' ? '-' : rawPu) : '-';
    const obs = iOb >= 0 ? String(row[iOb] ?? '').trim() : '';
    for (const d of list) {
      // PROTECCIÓN CONTRA SOBREESCRITURA:
      // Si opts.force es true (sincronización manual / explícita), NO omitir nada.
      // Si no es force, solo omitir si fue modificado en la app en los últimos 45s.
      if (!opts?.force && d.updated_at) {
        const upMs = new Date(d.updated_at.includes('Z') ? d.updated_at : d.updated_at.replace(' ', 'T') + 'Z').getTime();
        if (!isNaN(upMs) && Date.now() - upMs < 45000) {
          continue;
        }
      }

      const diff =
        (ini !== String(d.hora_inicio_real || '')) ||
        (fin !== String(d.hora_final_real || '')) ||
        (asi !== String(d.asistencia || 'PENDIENTE').toUpperCase()) ||
        (pun !== String(d.puntualidad || '-').toUpperCase()) ||
        (obs !== String(d.observacion || ''));
      if (diff) {
        stmts.push(
          db
            .prepare(
              "UPDATE asistencia SET hora_inicio_real = ?, hora_final_real = ?, asistencia = ?, puntualidad = ?, observacion = ?, updated_at = datetime('now') WHERE id = ?"
            )
            .bind(ini, fin, asi, pun, obs, d.id)
        );
      }
    }
  }
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  return stmts.length;
}

export async function pullFromExcel(db, token, itemId, opts = {}) {
  let total = 0;
  const as = await loadUsed(token, itemId, 'CONTROL ASISTENCIA');
  if (as) total += await pullAsistencia(db, as, opts);
  for (const name of ['tickets', 'manuales', 'reservas']) {
    const used = await loadUsed(token, itemId, SPECS[name].sheet);
    if (used) total += await pullRecords(db, name, used, opts);
  }
  return total;
}

/* ============================== PUSH (BD -> Excel) ============================== */
async function pushRecords(db, token, itemId, specName, ctx, saveSnapshot, preRows) {
  const spec = SPECS[specName];
  let used = await loadUsed(token, itemId, spec.sheet);
  if (!used) return { skipped: 'sin hoja' };
  used = await repairHeaders(token, itemId, spec, used);
  const hdr = findHeader(used, spec.musts);
  if (!hdr) return { skipped: 'sin encabezado' };
  const cols = resolveCols(spec, hdr.cells).filter((c) => c.idx >= 0);
  if (cols.length === 0) return { skipped: 'sin columnas' };

  // preRows: leer la tabla una sola vez para todos los archivos destino
  const sourceRows = preRows || ((await db.prepare(spec.select).all()).results || []);
  let rows = sourceRows.slice().sort(spec.sort);
  rows = rows.map((r) => spec.prefill(r, ctx));

  const minC = Math.min(...cols.map((c) => c.idx));
  const maxC = Math.max(...cols.map((c) => c.idx));
  const width = maxC - minC + 1;
  const firstData = hdr.row + 1; // relativo a used
  const existingRows = Math.max(0, used.values.length - firstData);
  const totalRows = Math.max(existingRows, rows.length);

  // columnas con fórmula en la primera fila de datos => se conservan (derivadas)
  const firstFormulas = used.formulas[firstData] || [];
  const isFormulaCol = (idx) => typeof firstFormulas[idx] === 'string' && firstFormulas[idx].startsWith('=');
  const firstAbsRow = used.rowIndex + firstData + 1;

  const matrix = [];
  const fmtMatrix = [];
  for (let i = 0; i < totalRows; i++) {
    const relRow = firstData + i;
    const baseF = used.formulas[relRow] || [];
    const line = [];
    const fmtLine = [];
    for (let c = minC; c <= maxC; c++) {
      const col = cols.find((x) => x.idx === c);
      const base = baseF[c] !== undefined ? baseF[c] : '';
      const cellFmt = col && col.t === 'date' ? 'dd/mm/yyyy' : col && col.t === 'time' ? 'hh:mm' : 'General';
      fmtLine.push(cellFmt);

      if (i >= rows.length) {
        // fila sobrante: se vacía (fórmulas incluidas) para no dejar datos de registros eliminados
        line.push('');
        continue;
      }
      if (!col) {
        // columna no administrada: mantener lo que hay (o replicar fórmula)
        if (isFormulaCol(c) && !(typeof base === 'string' && base.startsWith('='))) {
          line.push(firstFormulas[c].replace(new RegExp(`([A-Z]{1,3})${firstAbsRow}\\b`, 'g'), `$1${used.rowIndex + relRow + 1}`));
        } else line.push(base);
        continue;
      }
      if (isFormulaCol(c)) {
        const f = typeof base === 'string' && base.startsWith('=') ? base : firstFormulas[c].replace(new RegExp(`([A-Z]{1,3})${firstAbsRow}\\b`, 'g'), `$1${used.rowIndex + relRow + 1}`);
        line.push(f);
      } else {
        let v = rows[i][col.k];
        line.push(toCell(col.t, v));
      }
    }
    matrix.push(line);
    fmtMatrix.push(fmtLine);
  }
  if (matrix.length === 0) return { updated: 0 };

  const startAbs = used.rowIndex + firstData + 1;
  const endAbs = startAbs + matrix.length - 1;
  const address = `${colLetter(used.columnIndex + minC)}${startAbs}:${colLetter(used.columnIndex + maxC)}${endAbs}`;
  const res = await patchFormulas(token, itemId, spec.sheet, address, matrix, fmtMatrix);

  // Asegurar formato centrado en la columna ESTADO para la hoja de atenciones / préstamos
  if (specName === 'tickets') {
    try {
      const estadoCol = cols.find((c) => c.k === 'estado');
      if (estadoCol) {
        const colLet = colLetter(used.columnIndex + estadoCol.idx);
        const estadoAddr = `${colLet}${startAbs}:${colLet}${endAbs}`;
        await gfetch(token, `${G}/me/drive/items/${itemId}/workbook/worksheets/${enc(spec.sheet)}/range(address='${estadoAddr}')/format`, {
          method: 'PATCH',
          body: JSON.stringify({ horizontalAlignment: 'Center', verticalAlignment: 'Center' })
        });
      }
    } catch (_) {}
  }

  if (saveSnapshot) await setState(db, `ids:${specName}`, JSON.stringify(rows.map((r) => r.id)));
  return { updated: rows.length, status: res.status };
}

async function pushAsistencia(db, token, itemId, preRows) {
  const used = await loadUsed(token, itemId, 'CONTROL ASISTENCIA');
  if (!used) return { skipped: 'sin hoja' };
  const hdr = findHeader(used, ['AULA', 'NRC']);
  if (!hdr) return { skipped: 'sin encabezado' };
  const c = hdr.cells;
  const iDia = colOf(c, ['DIAS', 'DIA']);
  const iAula = colOf(c, ['AULA']);
  const iNrc = colOf(c, ['NRC']);
  const managed = [
    {
      idx: colOf(c, ['HORA INICIO REAL']), get: (d) => {
        if (!d.hora_inicio_real) return '';
        if (d.hora_inicio_real === '-') return '-';
        return hhmmToFrac(d.hora_inicio_real);
      }
    },
    {
      idx: colOf(c, ['HORA FINAL REAL']), get: (d) => {
        if (!d.hora_final_real) return '';
        if (d.hora_final_real === '-') return '-';
        return hhmmToFrac(d.hora_final_real);
      }
    },
    { idx: colOf(c, ['ASISTENCIA']), get: (d) => (String(d.asistencia || '').toUpperCase() === 'PENDIENTE' ? '' : d.asistencia || '') },
    { idx: colOf(c, ['PUNTUALIDAD']), get: (d) => (d.puntualidad || '') },
    { idx: colOf(c, ['OBSERVACION', 'OBSERVACIÓN', 'OBS', 'OBSER']), get: (d) => d.observacion || '' }
  ].filter((m) => m.idx >= 0);
  if (managed.length === 0) return { skipped: 'sin columnas' };

  const dbRows = preRows || ((await db.prepare('SELECT * FROM asistencia').all()).results || []);
  const byKey = new Map();
  for (const r of dbRows) byKey.set(`${String(r.nrc || '').trim()}|${mapDay(r.dia)}|${String(r.aula || '').trim().toUpperCase()}`, r);

  const minC = Math.min(...managed.map((m) => m.idx));
  const maxC = Math.max(...managed.map((m) => m.idx));
  const matrix = [];
  let changed = 0;
  for (let r = hdr.row + 1; r < used.values.length; r++) {
    const row = used.values[r];
    const f = used.formulas[r] || [];
    const d = byKey.get(`${String(row[iNrc] ?? '').trim()}|${mapDay(row[iDia])}|${String(row[iAula] ?? '').trim().toUpperCase()}`);
    const line = [];
    for (let k = minC; k <= maxC; k++) {
      const m = managed.find((x) => x.idx === k);
      const base = f[k] !== undefined ? f[k] : '';
      const isF = typeof base === 'string' && base.startsWith('=');
      if (d && m && !isF) {
        const nv = m.get(d);
        if (String(nv) !== String(base)) changed++;
        line.push(nv);
      } else line.push(base);
    }
    matrix.push(line);
  }
  if (matrix.length === 0) return { updated: 0 };
  const startAbs = used.rowIndex + hdr.row + 2;
  const address = `${colLetter(used.columnIndex + minC)}${startAbs}:${colLetter(used.columnIndex + maxC)}${startAbs + matrix.length - 1}`;
  const res = await patchFormulas(token, itemId, 'CONTROL ASISTENCIA', address, matrix);
  return { updated: changed, status: res.status };
}

/* ============================== diagnóstico ============================== */
export async function debugInspect(db) {
  await ensureTables(db);
  const acc = await getAccess(db);
  if (!acc) return { error: 'sin token' };
  const { token, row } = acc;
  const out = { itemId: row.item_id, file: row.file_name };

  try {
    const searchRes = await gfetch(token, `${G}/me/drive/root/search(q='RESERVA')`);
    out.foundReservasFiles = searchRes.ok ? (searchRes.json.value || []).map(f => ({ id: f.id, name: f.name, lastModifiedDateTime: f.lastModifiedDateTime })) : searchRes.json;
    const searchXlsx = await gfetch(token, `${G}/me/drive/root/search(q='.xlsx')`);
    out.allExcelFiles = searchXlsx.ok ? (searchXlsx.json.value || []).map(f => ({ id: f.id, name: f.name, lastModifiedDateTime: f.lastModifiedDateTime })) : searchXlsx.json;

    const resItemId = '01VNV6AXCOCHOMFZMOSFBKCRQ6CQPHKWUG';
    const resWs = await gfetch(token, `${G}/me/drive/items/${resItemId}/workbook/worksheets?$select=name,visibility`);
    out.reservasWorkbook = {
      worksheets: resWs.ok ? resWs.json.value : resWs.json,
      sheetsData: {}
    };
    if (resWs.ok && Array.isArray(resWs.json.value)) {
      const u = await loadUsed(token, resItemId, '05 ENE - 11 ENE');
      if (u) {
        out.reservasWorkbook.sheetsData['05 ENE - 11 ENE'] = {
          rowIndex: u.rowIndex,
          columnIndex: u.columnIndex,
          rowCount: u.values.length,
          headerAndRows: u.values.slice(8, 22)
        };
      }
    }
  } catch (e) {
    out.searchError = e.message;
  }

  const ws = await gfetch(token, `${G}/me/drive/items/${row.item_id}/workbook/worksheets?$select=name,visibility`);
  out.worksheets = ws.ok ? ws.json.value : ws.json;
  out.sheets = {};
  for (const name of ['CONTROL ASISTENCIA', 'ATENCIONES 2026-2', 'HOJA DE ASISTENCIA 2026-2', 'RESERVAS']) {
    const used = await loadUsed(token, row.item_id, name);
    if (!used) {
      out.sheets[name] = 'NO ENCONTRADA';
      continue;
    }
    out.sheets[name] = {
      rowIndex: used.rowIndex,
      columnIndex: used.columnIndex,
      rows: used.values.length,
      first: used.values.slice(0, 7).map((r) => r.slice(0, 14))
    };
  }
  return out;
}

/* ============================== orquestadores ============================== */
async function withLock(db, name, fn) {
  const lockKey = `lock:${name}`;
  const cur = Number((await getState(db, lockKey)) || 0);
  if (Date.now() - cur < 20000) return { busy: true };
  await setState(db, lockKey, Date.now());
  try {
    return await fn();
  } finally {
    await setState(db, lockKey, 0);
  }
}

/** Excel -> BD si CONTROL DOCENTE fue modificado externamente (por un humano en Excel) */
export async function pullIfExcelChanged(db) {
  await ensureTables(db);
  const acc = await getAccess(db);
  if (!acc) return { success: false, connected: false };
  const { token, row } = acc;
  const controlId = row.item_id;
  if (!controlId) return { success: false, connected: false };

  // 1) Si la app tiene escrituras locales pendientes (dirty) o muy recientes (últimos 45 s),
  // NO hacer pull para evitar pisar los datos de la app con un Excel que aún se está sincronizando.
  const dirty = await getState(db, 'dirty');
  if (dirty === '1') {
    return { success: true, pulled: false, skipped: 'dirty_pending' };
  }
  const lastWriteTs = await getState(db, 'last_write_ts');
  if (lastWriteTs && Date.now() - Number(lastWriteTs) < 45000) {
    return { success: true, pulled: false, skipped: 'cooldown_recent_write' };
  }

  const modControl = await itemMod(token, controlId);
  const lastControl = (await getState(db, 'excel_mod_control')) || (await getState(db, 'excel_mod'));

  if (!lastControl && modControl) {
    await setState(db, 'excel_mod_control', modControl);
    await setState(db, 'excel_mod', modControl);
    return { success: true, pulled: false };
  }

  const controlChanged = Boolean(modControl && lastControl && modControl !== lastControl);
  if (!controlChanged) {
    return { success: true, pulled: false };
  }

  return withLock(db, 'sync', async () => {
    let totalChanges = 0;
    try {
      const changes = await pullFromExcel(db, token, controlId);
      totalChanges += changes;
      await setState(db, 'excel_mod_control', modControl);
      await setState(db, 'excel_mod', modControl);
    } catch (err) {
      console.error('Error pulling Control Docente:', err);
    }

    if (totalChanges > 0) {
      await markDbWrite(db);
    }

    return {
      success: true,
      pulled: true,
      changes: totalChanges,
      controlChanged
    };
  });
}

async function doPushInternal(db, token, targetFile, onlySheet) {
  const report = [];

  // 1) Asistencia (ultra-rápido: solo actualiza CONTROL ASISTENCIA si fue lo que cambió)
  if (!onlySheet || onlySheet === 'asistencia') {
    const asRes = await db.prepare(
      'SELECT nrc, dia, aula, hora_inicio_real, hora_final_real, asistencia, puntualidad, observacion, docente, curso, carrera FROM asistencia'
    ).all();
    const asRows = asRes.results || [];
    const asReport = await pushAsistencia(db, token, targetFile.id, asRows);
    report.push({ file: targetFile.name, asistencia: asReport });
  }

  // 2) Otras hojas (tickets, manuales, reservas)
  if (!onlySheet || onlySheet !== 'asistencia') {
    const fetchTickets = !onlySheet || onlySheet === 'tickets';
    const fetchManuales = !onlySheet || onlySheet === 'manuales';
    const fetchReservas = !onlySheet || onlySheet === 'reservas';
    const needCtx = fetchTickets || fetchManuales;

    const [ticketsRes, manualesRes, reservasRes, asRes] = await Promise.all([
      fetchTickets ? db.prepare(SPECS.tickets.select).all() : Promise.resolve({ results: [] }),
      fetchManuales ? db.prepare(SPECS.manuales.select).all() : Promise.resolve({ results: [] }),
      fetchReservas ? db.prepare(SPECS.reservas.select).all() : Promise.resolve({ results: [] }),
      needCtx ? db.prepare('SELECT nrc, docente, curso, carrera FROM asistencia').all() : Promise.resolve({ results: [] })
    ]);

    const nrcMap = new Map();
    const courseMap = new Map();
    if (needCtx) {
      for (const a of (asRes.results || [])) {
        const k = String(a.nrc || '').trim();
        const unpadded = k ? k.replace(/^0+/, '') : '';
        const padded = k ? k.padStart(5, '0') : '';
        const cursoUpper = String(a.curso || '').trim().toUpperCase();
        const obj = { docente: a.docente || '', curso: a.curso || '', carrera: a.carrera || '' };

        if (k && (!nrcMap.has(k) || (!nrcMap.get(k).carrera && obj.carrera))) nrcMap.set(k, obj);
        if (unpadded && (!nrcMap.has(unpadded) || (!nrcMap.get(unpadded).carrera && obj.carrera))) nrcMap.set(unpadded, obj);
        if (padded && (!nrcMap.has(padded) || (!nrcMap.get(padded).carrera && obj.carrera))) nrcMap.set(padded, obj);

        if (cursoUpper && (!courseMap.has(cursoUpper) || (!courseMap.get(cursoUpper).carrera && obj.carrera))) {
          courseMap.set(cursoUpper, obj);
        }
      }
    }
    const ctx = { nrcMap, courseMap };

    const fileReport = { file: targetFile.name };
    if (fetchTickets) {
      fileReport.tickets = await pushRecords(db, token, targetFile.id, 'tickets', ctx, true, ticketsRes.results || []);
    }
    if (fetchManuales) {
      fileReport.manuales = await pushRecords(db, token, targetFile.id, 'manuales', ctx, true, manualesRes.results || []);
    }
    if (fetchReservas) {
      fileReport.reservas = await pushRecords(db, token, targetFile.id, 'reservas', ctx, true, reservasRes.results || []);
    }
    report.push(fileReport);
  }

  // Actualizar timestamps de modificación de CONTROL DOCENTE
  const modControlAfter = await itemMod(token, targetFile.id);
  if (modControlAfter) {
    await setState(db, 'excel_mod', modControlAfter);
    await setState(db, 'excel_mod_control', modControlAfter);
  }
  await setState(db, 'last_push', String(Date.now()));
  await db.prepare("UPDATE onedrive_auth SET updated_at = datetime('now') WHERE id = 'primary'").run();

  return {
    success: true,
    connected: true,
    filesUpdated: report,
    message: 'Archivo maestro sincronizado exitosamente con OneDrive'
  };
}

/** BD -> Excel (sincroniza de forma directa al archivo maestro en OneDrive) */
export async function pushToExcel(db, opts = {}) {
  await ensureTables(db);
  const acc = await getAccess(db);
  if (!acc) return { success: false, connected: false, message: 'OneDrive aún no vinculado' };
  const { token, row } = acc;
  const onlySheet = opts?.onlySheet || null;

  let targetFile = (row.item_id && row.file_name) ? { id: row.item_id, name: row.file_name } : null;
  if (!targetFile) {
    const targets = await findTargets(token, row);
    if (targets.length === 0) return { success: false, message: 'No se encontró archivo CONTROL DOCENTE en OneDrive' };
    targetFile = targets.find((t) => /TEST/i.test(t.name)) || targets.find((t) => t.id === row.item_id) || targets[0];
    if (targetFile.id !== row.item_id) {
      await db.prepare("UPDATE onedrive_auth SET item_id = ?, file_name = ? WHERE id = 'primary'").bind(targetFile.id, targetFile.name).run();
    }
  }

  const result = await withLock(db, 'sync', async () => {
    let out;
    for (let n = 0; n < 2; n++) {
      await setState(db, 'dirty', '0');
      out = await doPushInternal(db, token, targetFile, onlySheet);
      if ((await getState(db, 'dirty')) !== '1') break;
    }
    return out;
  });
  if (result && result.busy) {
    await setState(db, 'dirty', '1');
    return { success: true, queued: true };
  }
  return result;
}

/** Sincronización BIDIRECCIONAL completa (Excel <-> BD):
 * 1. PULL prioritario desde Excel para adoptar cualquier celda borrada o editada en Excel.
 * 2. PUSH hacia Excel para reflejar cualquier borrado o nuevo registro hecho en la app.
 */
export async function syncBidirectional(db, opts = {}) {
  await ensureTables(db);
  const acc = await getAccess(db);
  if (!acc) return { success: false, connected: false, message: 'OneDrive aún no vinculado' };
  const { token, row } = acc;

  let targetFile = (row.item_id && row.file_name) ? { id: row.item_id, name: row.file_name } : null;
  if (!targetFile) {
    const targets = await findTargets(token, row);
    if (targets.length === 0) return { success: false, message: 'No se encontró archivo CONTROL DOCENTE en OneDrive' };
    targetFile = targets.find((t) => /TEST/i.test(t.name)) || targets.find((t) => t.id === row.item_id) || targets[0];
    if (targetFile.id !== row.item_id) {
      await db.prepare("UPDATE onedrive_auth SET item_id = ?, file_name = ? WHERE id = 'primary'").bind(targetFile.id, targetFile.name).run();
    }
  }

  const result = await withLock(db, 'sync', async () => {
    // 1) PULL primero desde Excel con force: true (elimina en BD lo borrado en Excel, limpia celdas vacías)
    let pullChanges = 0;
    try {
      pullChanges = await pullFromExcel(db, token, targetFile.id, { force: true });
    } catch (err) {
      console.error('Error en pull bidireccional:', err);
    }

    // 2) PUSH hacia Excel para consolidar (vacía en Excel filas sobrantes si se borró en la app)
    await setState(db, 'dirty', '0');
    const pushResult = await doPushInternal(db, token, targetFile, null);

    await markDbWrite(db);

    return {
      success: true,
      connected: true,
      pullChanges,
      pushResult,
      message: 'Sincronización bidireccional completada con éxito'
    };
  });

  if (result && result.busy) {
    return { success: false, busy: true, message: 'Sincronización en curso, por favor espere unos segundos' };
  }
  return result;
}

/* ==========================================================================
   SINCRONIZACIÓN EXCLUSIVA PARA HOJA "RESERVAS" EN CONTROL DOCENTE - TAY.xlsx
   Estructura:
   - Archivo único: CONTROL DOCENTE - TAY.xlsx
   - Hoja: "RESERVAS"
   - Encabezado en fila 4 (idx 3), Columnas B a L:
     [FECHA, MES, DIA, INICIO, FINAL, AULA, UBICACIÓN, DOCENTE, DETALLE, USUARIO, PRIORIDAD]
   ========================================================================== */
export const RESERVAS_MONTHS = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
export const SPANISH_DAYS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

export async function getReservasSheetsList() {
  return [
    {
      id: 'RESERVAS',
      name: 'RESERVAS',
      cleanName: 'RESERVAS',
      isCurrent: true
    }
  ];
}

export function getReservasSheetNameForDate() {
  return 'RESERVAS';
}

export async function pullReservationsFromExcel(db) {
  return await pullIfExcelChanged(db);
}

export async function appendReservationToExcel(db, reservation) {
  const acc = await getAccess(db);
  if (!acc) return { success: false, message: 'OneDrive no vinculado' };
  const { token, row } = acc;
  const primary = await findPrimaryTarget(token, row);
  if (!primary || !primary.id) return { success: false, message: 'No se encontró archivo CONTROL DOCENTE en OneDrive' };

  const sheetName = 'RESERVAS';
  const used = await loadUsed(token, primary.id, sheetName);
  if (!used || !Array.isArray(used.values)) {
    return { success: false, message: `No se pudo leer la hoja "${sheetName}"` };
  }

  // Header en fila 4 (idx 3), Col B a L
  let headerRowIdx = 3;
  for (let r = 0; r < Math.min(used.values.length, 10); r++) {
    const rowCells = (used.values[r] || []).map(norm);
    if (rowCells.includes('FECHA') && rowCells.includes('AULA')) {
      headerRowIdx = r;
      break;
    }
  }

  const startRow = headerRowIdx + 1;
  let targetRowIdx = -1;
  const aulaUpper = String(reservation.aula || '').toUpperCase().trim();
  const inicioNorm = canon('time', reservation.inicio);
  const fechaIso = reservation.fecha ? String(reservation.fecha).slice(0, 10) : '';

  // 1) Si ya existe la misma reserva (fecha, aula, inicio), actualizarla
  for (let r = startRow; r < used.values.length; r++) {
    const rCells = used.values[r] || [];
    const colOffset = used.columnIndex === 0 ? 1 : 0;
    const rFecha = canon('date', rCells[colOffset + 0]);
    const rAula = String(rCells[colOffset + 5] ?? '').toUpperCase().trim();
    const rInicio = canon('time', rCells[colOffset + 3]);

    if (rFecha && rAula && rFecha === fechaIso && rAula === aulaUpper && rInicio === inicioNorm) {
      targetRowIdx = r;
      break;
    }
  }

  // 2) Si no existe, ubicar la primera fila vacía
  if (targetRowIdx < 0) {
    for (let r = startRow; r < used.values.length; r++) {
      const rCells = used.values[r] || [];
      const colOffset = used.columnIndex === 0 ? 1 : 0;
      const isEmpty = !rCells[colOffset + 0] && !rCells[colOffset + 5] && !rCells[colOffset + 7];
      if (isEmpty) {
        targetRowIdx = r;
        break;
      }
    }
  }

  if (targetRowIdx < 0) {
    targetRowIdx = used.values.length;
  }

  const excelRowNum = (used.rowIndex || 0) + targetRowIdx + 1;
  const serialFecha = isoToSerial(reservation.fecha);
  const fracInicio = hhmmToFrac(reservation.inicio);
  const fracFinal = hhmmToFrac(reservation.final);
  const mesVal = String(reservation.mes || '').toUpperCase().trim();
  const diaVal = String(reservation.dia || '').toUpperCase().trim();
  const ubicacionVal = reservation.ubicacion || '';
  const docenteVal = String(reservation.docente || '').toUpperCase().trim();
  const detalleVal = String(reservation.detalle || reservation.motivo || '').toUpperCase().trim();
  const usuarioVal = String(reservation.usuario || 'TAYRON SALINAS').toUpperCase().trim();
  const prioridadVal = String(reservation.prioridad || 'NORMAL').toUpperCase().trim();

  const rowValues = [
    typeof serialFecha === 'number' ? serialFecha : toExcelDate(reservation.fecha),
    mesVal,
    diaVal,
    typeof fracInicio === 'number' ? fracInicio : reservation.inicio,
    typeof fracFinal === 'number' ? fracFinal : reservation.final,
    aulaUpper,
    ubicacionVal,
    docenteVal,
    detalleVal,
    usuarioVal,
    prioridadVal
  ];

  const rowFormats = [
    'dd/mm/yyyy',
    '@',
    '@',
    'hh:mm',
    'hh:mm',
    '@',
    '@',
    '@',
    '@',
    '@',
    '@'
  ];

  const address = `B${excelRowNum}:L${excelRowNum}`;
  const patchRes = await patchRange(token, primary.id, sheetName, address, [rowValues], [rowFormats]);

  if (reservation.id) {
    await db.prepare("UPDATE reservas SET hoja = 'RESERVAS' WHERE id = ?").bind(reservation.id).run();
  }

  return {
    success: patchRes.ok,
    sheet: sheetName,
    row: excelRowNum,
    address,
    status: patchRes.status
  };
}

export async function deleteReservationFromExcel(db, reservation) {
  if (!reservation || !reservation.fecha) return { success: false };
  const acc = await getAccess(db);
  if (!acc) return { success: false };
  const { token, row } = acc;
  const primary = await findPrimaryTarget(token, row);
  if (!primary || !primary.id) return { success: false };

  const sheetName = 'RESERVAS';
  const used = await loadUsed(token, primary.id, sheetName);
  if (!used || !Array.isArray(used.values)) return { success: false };

  const colOffset = used.columnIndex === 0 ? 1 : 0;
  const aulaUpper = String(reservation.aula || '').toUpperCase().trim();
  const inicioNorm = canon('time', reservation.inicio);
  const fechaIso = String(reservation.fecha).slice(0, 10);

  for (let r = 3; r < used.values.length; r++) {
    const rCells = used.values[r] || [];
    const rFecha = canon('date', rCells[colOffset + 0]);
    const rAula = String(rCells[colOffset + 5] ?? '').toUpperCase().trim();
    const rInicio = canon('time', rCells[colOffset + 3]);

    if (rFecha === fechaIso && rAula === aulaUpper && rInicio === inicioNorm) {
      const excelRowNum = (used.rowIndex || 0) + r + 1;
      const clearValues = new Array(11).fill('');
      return await patchRange(token, primary.id, sheetName, `B${excelRowNum}:L${excelRowNum}`, [clearValues]);
    }
  }
  return { success: false, message: 'Fila no encontrada en hoja RESERVAS' };
}
