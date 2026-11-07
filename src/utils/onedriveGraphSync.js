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
  if (type === 'date') return toExcelDate(v);
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
  } catch (_) {}
  return { ok: res.ok, status: res.status, json };
}

// Tablas e índices para Cloudflare D1
export async function ensureTables(db) {
  try { await db.prepare('ALTER TABLE reservas ADD COLUMN motivo TEXT').run(); } catch (_) {}
  try { await db.prepare('ALTER TABLE reservas ADD COLUMN obs TEXT').run(); } catch (_) {}
  try { await db.prepare('ALTER TABLE reservas ADD COLUMN hoja TEXT').run(); } catch (_) {}
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
  return { token, row };
}

async function findTargets(token, row) {
  const targets = [];
  const r = await gfetch(token, `${G}/me/drive/root/search(q='CONTROL DOCENTE')`);
  if (r.ok) {
    for (const f of r.json?.value || []) {
      const nm = String(f.name || '');
      if (nm.toUpperCase().includes('CONTROL DOCENTE') && nm.toLowerCase().endsWith('.xlsx')) {
        targets.push({ id: f.id, name: nm });
      }
    }
  }
  if (targets.length === 0 && row.item_id) targets.push({ id: row.item_id, name: row.file_name || 'CONTROL DOCENTE.xlsx' });
  return targets;
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
    prefill: (r) => ({ ...r, usuario: r.usuario || (String(r.descripcion_solucion || '').toUpperCase().includes('ALUMNO') ? 'ALUMNO' : 'DOCENTE') }),
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
  return norm(s);
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
      stmts.push(spec.insert(db, id, rec));
    }
  }

  // Si se eliminaron filas en el Excel, eliminarlas de la base de datos
  // REGLA CRÍTICA: Solo eliminar filas que YA EXISTÍAN previamente en el snapshot de Excel (ids:${specName}).
  // Las filas nuevas creadas en la app NO están en el snapshot aún y NUNCA deben ser borradas aquí.
  let snapshotIds = new Set();
  try {
    const rawSnap = await getState(db, `ids:${specName}`);
    if (rawSnap) {
      const arr = JSON.parse(rawSnap);
      if (Array.isArray(arr)) snapshotIds = new Set(arr);
    }
  } catch (_) {}

  if (snapshotIds.size > 0) {
    for (const r of dbRows) {
      if (snapshotIds.has(r.id) && !claimed.has(r.id)) {
        changes++;
        stmts.push(db.prepare(`DELETE FROM ${spec.table} WHERE id = ?`).bind(r.id));
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
  return changes;
}

async function pullAsistencia(db, used) {
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
  const iOb = colOf(c, ['OBSERVACION']);
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
    const ini = iIni >= 0 ? fracToHHMM(row[iIni]) : null;
    const fin = iFin >= 0 ? fracToHHMM(row[iFin]) : null;
    const asi = iAs >= 0 ? String(row[iAs] ?? '').trim().toUpperCase() || 'PENDIENTE' : null;
    const pun = iPu >= 0 ? String(row[iPu] ?? '').trim().toUpperCase() || '-' : null;
    const obs = iOb >= 0 ? String(row[iOb] ?? '').trim() : null;
    for (const d of list) {
      const diff =
        (ini !== null && ini !== String(d.hora_inicio_real || '')) ||
        (fin !== null && fin !== String(d.hora_final_real || '')) ||
        (asi !== null && asi !== String(d.asistencia || 'PENDIENTE').toUpperCase()) ||
        (pun !== null && pun !== String(d.puntualidad || '-').toUpperCase()) ||
        (obs !== null && obs !== String(d.observacion || ''));
      if (diff) {
        stmts.push(
          db
            .prepare(
              "UPDATE asistencia SET hora_inicio_real = COALESCE(?, hora_inicio_real), hora_final_real = COALESCE(?, hora_final_real), asistencia = COALESCE(?, asistencia), puntualidad = COALESCE(?, puntualidad), observacion = COALESCE(?, observacion), updated_at = datetime('now') WHERE id = ?"
            )
            .bind(ini, fin, asi, pun, obs, d.id)
        );
      }
    }
  }
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  return stmts.length;
}

export async function pullFromExcel(db, token, itemId) {
  let total = 0;
  const as = await loadUsed(token, itemId, 'CONTROL ASISTENCIA');
  if (as) total += await pullAsistencia(db, as);
  for (const name of ['tickets', 'manuales']) {
    const used = await loadUsed(token, itemId, SPECS[name].sheet);
    if (used) total += await pullRecords(db, name, used);
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
    { idx: colOf(c, ['HORA INICIO REAL']), get: (d) => hhmmToFrac(d.hora_inicio_real) },
    { idx: colOf(c, ['HORA FINAL REAL']), get: (d) => hhmmToFrac(d.hora_final_real) },
    { idx: colOf(c, ['ASISTENCIA']), get: (d) => (String(d.asistencia || '').toUpperCase() === 'PENDIENTE' ? '' : d.asistencia || '') },
    { idx: colOf(c, ['PUNTUALIDAD']), get: (d) => (d.puntualidad === '-' ? '' : d.puntualidad || '') },
    { idx: colOf(c, ['OBSERVACION']), get: (d) => d.observacion || '' }
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

/** Excel -> BD si CUALQUIERA de los dos Excel (CONTROL DOCENTE o RESERVAS 2026) fue modificado externamente */
export async function pullIfExcelChanged(db) {
  await ensureTables(db);
  const acc = await getAccess(db);
  if (!acc) return { success: false, connected: false };
  const { token, row } = acc;
  const controlId = row.item_id;
  const resTarget = await findReservasTarget(token);
  const reservasId = resTarget?.id;

  const [modControl, modReservas] = await Promise.all([
    controlId ? itemMod(token, controlId) : Promise.resolve(null),
    reservasId ? itemMod(token, reservasId) : Promise.resolve(null)
  ]);

  const lastControl = (await getState(db, 'excel_mod_control')) || (await getState(db, 'excel_mod'));
  const lastReservas = await getState(db, 'excel_mod_reservas');

  if (!lastControl && modControl) await setState(db, 'excel_mod_control', modControl);
  if (!lastReservas && modReservas) await setState(db, 'excel_mod_reservas', modReservas);

  const controlChanged = Boolean(modControl && lastControl && modControl !== lastControl);
  const reservasChanged = Boolean(modReservas && lastReservas && modReservas !== lastReservas);

  if (!controlChanged && !reservasChanged) {
    return { success: true, pulled: false };
  }

  return withLock(db, 'sync', async () => {
    let totalChanges = 0;
    if (controlChanged && controlId) {
      try {
        const changes = await pullFromExcel(db, token, controlId);
        totalChanges += changes;
        await setState(db, 'excel_mod_control', modControl);
        await setState(db, 'excel_mod', modControl);
      } catch (err) {
        console.error('Error pulling Control Docente:', err);
      }
    }

    if (reservasChanged && reservasId) {
      try {
        const resPull = await pullReservationsFromExcel(db);
        totalChanges += (resPull.imported || 0);
        await setState(db, 'excel_mod_reservas', modReservas);
      } catch (err) {
        console.error('Error pulling Reservas:', err);
      }
    }

    if (totalChanges > 0) {
      await markDbWrite(db);
    }

    return { 
      success: true, 
      pulled: true, 
      changes: totalChanges, 
      controlChanged, 
      reservasChanged 
    };
  });
}

/** BD -> Excel (sincroniza AMBOS archivos: CONTROL DOCENTE y RESERVAS 2026 en OneDrive) */
export async function pushToExcel(db) {
  await ensureTables(db);
  const acc = await getAccess(db);
  if (!acc) return { success: false, connected: false, message: 'OneDrive aún no vinculado' };
  const { token, row } = acc;
  const doPush = async () => {
    const targets = await findTargets(token, row);
    if (targets.length === 0) return { success: false, message: 'No se encontró archivo CONTROL DOCENTE en OneDrive' };
    const primary = targets.find((t) => t.id === row.item_id) || targets.find((t) => /COPIA|TAY/i.test(t.name)) || targets[0];
    if (primary.id !== row.item_id) {
      await db.prepare("UPDATE onedrive_auth SET item_id = ?, file_name = ? WHERE id = 'primary'").bind(primary.id, primary.name).run();
    }

    // 1) Sincronizar primero Excel -> BD de ambos archivos SOLAMENTE si fueron editados externamente en OneDrive
    let pulled = 0;
    let reservasPulled = 0;
    const resTarget = await findReservasTarget(token);
    const [modControl, modReservas] = await Promise.all([
      itemMod(token, primary.id),
      resTarget?.id ? itemMod(token, resTarget.id) : null
    ]);
    const lastModControl = (await getState(db, 'excel_mod_control')) || (await getState(db, 'excel_mod'));
    const lastModReservas = await getState(db, 'excel_mod_reservas');

    if (modControl && lastModControl && modControl !== lastModControl) {
      try {
        pulled += await pullFromExcel(db, token, primary.id);
      } catch (e) {
        console.error('Error importando desde Control Docente:', e);
      }
    }

    if (modReservas && lastModReservas && modReservas !== lastModReservas) {
      try {
        const resPull = await pullReservationsFromExcel(db);
        reservasPulled = resPull.imported || 0;
        pulled += reservasPulled;
      } catch (e) {
        console.error('Error importando desde Reservas:', e);
      }
    }

    if (pulled > 0) await markDbWrite(db);

    // 2) BD -> Excel (CONTROL DOCENTE: asistencia, tickets, manuales, reservas)
    const [asRes, ticketsRes, manualesRes, reservasRes] = await Promise.all([
      db.prepare(
        'SELECT nrc, dia, aula, hora_inicio_real, hora_final_real, asistencia, puntualidad, observacion, docente, curso, carrera FROM asistencia'
      ).all(),
      db.prepare(SPECS.tickets.select).all(),
      db.prepare(SPECS.manuales.select).all(),
      db.prepare(SPECS.reservas.select).all()
    ]);
    const asRows = asRes.results || [];
    const preRows = {
      tickets: ticketsRes.results || [],
      manuales: manualesRes.results || [],
      reservas: reservasRes.results || []
    };
    const nrcMap = new Map();
    const courseMap = new Map();
    for (const a of asRows) {
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
    const ctx = { nrcMap, courseMap };
    const report = [];
    for (const t of targets) {
      const isPrimary = t.id === primary.id;
      const r = {
        file: t.name,
        asistencia: await pushAsistencia(db, token, t.id, asRows),
        tickets: await pushRecords(db, token, t.id, 'tickets', ctx, isPrimary, preRows.tickets),
        manuales: await pushRecords(db, token, t.id, 'manuales', ctx, isPrimary, preRows.manuales),
        reservas: await pushRecords(db, token, t.id, 'reservas', ctx, isPrimary, preRows.reservas)
      };
      report.push(r);
    }

    // Actualizar timestamps de modificación de ambos archivos
    const [modControlAfter, modReservasAfter] = await Promise.all([
      itemMod(token, primary.id),
      resTarget?.id ? itemMod(token, resTarget.id) : null
    ]);

    if (modControlAfter) {
      await setState(db, 'excel_mod', modControlAfter);
      await setState(db, 'excel_mod_control', modControlAfter);
    }
    if (modReservasAfter) {
      await setState(db, 'excel_mod_reservas', modReservasAfter);
    }
    await setState(db, 'last_push', String(Date.now()));
    await db.prepare("UPDATE onedrive_auth SET updated_at = datetime('now') WHERE id = 'primary'").run();

    return { 
      success: true, 
      connected: true, 
      pulled, 
      reservasPulled,
      filesUpdated: report, 
      reservasFile: resTarget?.name || 'RESERVAS 2026 - TAY.xlsx',
      message: 'Ambos archivos de OneDrive sincronizados' 
    };
  };

  const result = await withLock(db, 'sync', async () => {
    let out;
    for (let n = 0; n < 2; n++) {
      await setState(db, 'dirty', '0');
      out = await doPush();
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

/* ==========================================================================
   SINCRONIZACIÓN EXCLUSIVA PARA RESERVAS 2026 - TAY.xlsx
   Estructura:
   - ~50 hojas semanales nombradas "DD MMM - DD MMM" (ej. "05 ENE - 11 ENE")
   - Encabezado en fila 10 (idx 9):
     [FECHA, DIA, INICIO, FINAL, AULA, UBICACIÓN, DOCENTE, MOTIVO, USUARIO, OBS]
   ========================================================================== */
export const RESERVAS_ITEM_ID = '01VNV6AXCOCHOMFZMOSFBKCRQ6CQPHKWUG';
export const RESERVAS_MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
export const SPANISH_DAYS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

export const MONTH_MAP = {
  ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5,
  JUL: 6, AGO: 7, SEP: 8, OCT: 9, NOV: 10, DIC: 11
};

export const DAY_OFFSETS = {
  LUNES: 0,
  MARTES: 1,
  MIERCOLES: 2,
  MIÉRCOLES: 2,
  JUEVES: 3,
  VIERNES: 4,
  SABADO: 5,
  SÁBADO: 5,
  DOMINGO: 6
};

export function parseSheetDates(sheetName, defaultYear = 2026) {
  const m = String(sheetName || '').trim().match(/^(\d{2})\s+([A-Z]{3})\s*-\s*(\d{2})\s+([A-Z]{3})$/i);
  if (!m) return null;
  const startDay = parseInt(m[1], 10);
  const startMonth = MONTH_MAP[m[2].toUpperCase()];
  const endDay = parseInt(m[3], 10);
  const endMonth = MONTH_MAP[m[4].toUpperCase()];
  if (startMonth === undefined || endMonth === undefined) return null;

  let startYear = defaultYear;
  let endYear = defaultYear;
  if (startMonth === 11 && endMonth === 0) {
    endYear = defaultYear + 1;
  }
  const startDate = new Date(Date.UTC(startYear, startMonth, startDay, 12, 0, 0));
  const endDate = new Date(Date.UTC(endYear, endMonth, endDay, 12, 0, 0));
  return {
    startDateStr: startDate.toISOString().slice(0, 10),
    endDateStr: endDate.toISOString().slice(0, 10),
    startDate,
    endDate
  };
}

export function getReservasSheetNameForDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).slice(0, 10).split(/[\/\-]/).map(Number);
  let year = parts[0], month = parts[1], day = parts[2];
  if (parts[0] < 32 && parts[2] > 1900) {
    // DD/MM/YYYY
    day = parts[0]; month = parts[1]; year = parts[2];
  }
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  const dayOfWeek = dt.getUTCDay(); // 0: Sun, 1: Mon
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mon = new Date(dt); mon.setUTCDate(mon.getUTCDate() + diffToMon);
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
  const monStr = `${String(mon.getUTCDate()).padStart(2, '0')} ${RESERVAS_MONTHS[mon.getUTCMonth()]}`;
  const sunStr = `${String(sun.getUTCDate()).padStart(2, '0')} ${RESERVAS_MONTHS[sun.getUTCMonth()]}`;
  return `${monStr} - ${sunStr}`;
}

export async function findReservasTarget(token) {
  if (RESERVAS_ITEM_ID) {
    const check = await gfetch(token, `${G}/me/drive/items/${RESERVAS_ITEM_ID}?$select=id,name`);
    if (check.ok && check.json?.id) {
      return { id: check.json.id, name: check.json.name };
    }
  }
  const search = await gfetch(token, `${G}/me/drive/root/search(q='RESERVA')`);
  if (search.ok && Array.isArray(search.json?.value)) {
    const match = search.json.value.find(f => /RESERVAS.*2026/i.test(f.name) && f.name.endsWith('.xlsx')) ||
                  search.json.value.find(f => /RESERVA/i.test(f.name) && f.name.endsWith('.xlsx'));
    if (match) return { id: match.id, name: match.name };
  }
  return { id: RESERVAS_ITEM_ID, name: 'RESERVAS 2026 - TAY.xlsx' };
}

export async function getReservasSheetsList(db) {
  const acc = await getAccess(db);
  if (!acc) return [];
  const { token } = acc;
  const target = await findReservasTarget(token);
  if (!target || !target.id) return [];

  const resWs = await gfetch(token, `${G}/me/drive/items/${target.id}/workbook/worksheets?$select=name,id,visibility`);
  if (!resWs.ok || !Array.isArray(resWs.json?.value)) return [];

  const now = new Date();
  const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

  const sheets = [];
  for (const w of resWs.json.value) {
    const parsed = parseSheetDates(w.name);
    if (!parsed) continue;
    const isCurrent = todayStr >= parsed.startDateStr && todayStr <= parsed.endDateStr;
    sheets.push({
      id: w.id,
      name: w.name,
      cleanName: w.name.trim(),
      startDate: parsed.startDateStr,
      endDate: parsed.endDateStr,
      isCurrent
    });
  }
  return sheets;
}

export async function appendReservationToExcel(db, reservation) {
  const acc = await getAccess(db);
  if (!acc) return { success: false, message: 'OneDrive no vinculado' };
  const { token } = acc;
  const target = await findReservasTarget(token);
  if (!target || !target.id) return { success: false, message: 'No se encontró archivo RESERVAS en OneDrive' };

  const targetSheetName = getReservasSheetNameForDate(reservation.fecha);
  if (!targetSheetName) return { success: false, message: 'Fecha inválida para hoja semanal' };

  // Obtener nombre exacto de la hoja (maneja espacios al final como "02 MAR - 08 MAR ")
  const resWs = await gfetch(token, `${G}/me/drive/items/${target.id}/workbook/worksheets?$select=name`);
  if (!resWs.ok || !Array.isArray(resWs.json?.value)) {
    return { success: false, message: 'Error consultando hojas de reservas' };
  }
  const exactWs = resWs.json.value.find(w => w.name.trim() === targetSheetName);
  if (!exactWs) {
    return { success: false, message: `Hoja "${targetSheetName}" no existe en ${target.name}` };
  }
  const sheetName = exactWs.name;

  const used = await loadUsed(token, target.id, sheetName);
  if (!used || !Array.isArray(used.values)) {
    return { success: false, message: `No se pudo leer la hoja "${sheetName}"` };
  }

  // Buscar encabezado (contiene FECHA y AULA)
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(used.values.length, 15); r++) {
    const rowCells = (used.values[r] || []).map(norm);
    if (rowCells.includes('FECHA') && rowCells.includes('AULA')) {
      headerRowIdx = r;
      break;
    }
  }
  if (headerRowIdx < 0) headerRowIdx = 9; // Fila 10 por defecto

  const startRow = headerRowIdx + 1;
  let targetRowIdx = -1;
  const aulaUpper = String(reservation.aula || '').toUpperCase().trim();
  const inicioNorm = canon('time', reservation.inicio);
  const fechaIso = reservation.fecha ? String(reservation.fecha).slice(0, 10) : '';

  for (let r = startRow; r < used.values.length; r++) {
    const row = used.values[r] || [];
    const rFecha = canon('date', row[0]);
    const rAula = String(row[4] ?? '').toUpperCase().trim();
    const rInicio = canon('time', row[2]);

    if (rFecha && rAula && rFecha === fechaIso && rAula === aulaUpper && rInicio === inicioNorm) {
      targetRowIdx = r;
      break;
    }

    if (targetRowIdx < 0) {
      const isEmpty = !row[0] && !row[4] && !row[6] && !row[7];
      if (isEmpty) {
        targetRowIdx = r;
      }
    }
  }

  if (targetRowIdx < 0) {
    targetRowIdx = used.values.length;
  }

  const excelRowNum = (used.rowIndex || 0) + targetRowIdx + 1;

  // Preservar fórmula existente en columna F (UBICACIÓN) o columna B (DIA) si existieran
  const existingUbicacionFormula = used?.formulas?.[targetRowIdx]?.[5];
  const keepUbicacionFormula = typeof existingUbicacionFormula === 'string' && existingUbicacionFormula.startsWith('=');

  const existingDiaFormula = used?.formulas?.[targetRowIdx]?.[1];
  const keepDiaFormula = typeof existingDiaFormula === 'string' && existingDiaFormula.startsWith('=');

  const serialFecha = isoToSerial(reservation.fecha);
  const fracInicio = hhmmToFrac(reservation.inicio);
  const fracFinal = hhmmToFrac(reservation.final);
  const diaVal = reservation.dia || '';
  const ubicacionVal = reservation.ubicacion || '';
  const docenteVal = String(reservation.docente || '').toUpperCase().trim();
  const motivoVal = String(reservation.motivo || reservation.detalle || '').toUpperCase().trim();
  const usuarioVal = String(reservation.usuario || 'OPERACIONES').toUpperCase().trim();
  const obsVal = String(reservation.obs || '').trim();

  const rowValues = [
    typeof serialFecha === 'number' ? serialFecha : toExcelDate(reservation.fecha),
    keepDiaFormula ? existingDiaFormula : diaVal,
    typeof fracInicio === 'number' ? fracInicio : reservation.inicio,
    typeof fracFinal === 'number' ? fracFinal : reservation.final,
    aulaUpper,
    keepUbicacionFormula ? existingUbicacionFormula : ubicacionVal,
    docenteVal,
    motivoVal,
    usuarioVal,
    obsVal
  ];

  const rowFormats = [
    'dd/mm/yyyy',
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

  const address = `A${excelRowNum}:J${excelRowNum}`;
  const patchRes = await patchFormulas(token, target.id, sheetName, address, [rowValues], [rowFormats]);

  if (reservation.id) {
    await db.prepare('UPDATE reservas SET hoja = ? WHERE id = ?').bind(sheetName.trim(), reservation.id).run();
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
  const { token } = acc;
  const target = await findReservasTarget(token);
  if (!target || !target.id) return { success: false };

  const targetSheetName = getReservasSheetNameForDate(reservation.fecha);
  if (!targetSheetName) return { success: false };

  const resWs = await gfetch(token, `${G}/me/drive/items/${target.id}/workbook/worksheets?$select=name`);
  if (!resWs.ok || !Array.isArray(resWs.json?.value)) return { success: false };
  const exactWs = resWs.json.value.find(w => w.name.trim() === targetSheetName);
  if (!exactWs) return { success: false };

  const used = await loadUsed(token, target.id, exactWs.name);
  if (!used || !Array.isArray(used.values)) return { success: false };

  const aulaUpper = String(reservation.aula || '').toUpperCase().trim();
  const inicioNorm = canon('time', reservation.inicio);
  const fechaIso = String(reservation.fecha).slice(0, 10);

  for (let r = 9; r < used.values.length; r++) {
    const row = used.values[r] || [];
    const rFecha = canon('date', row[0]);
    const rAula = String(row[4] ?? '').toUpperCase().trim();
    const rInicio = canon('time', row[2]);

    if (rFecha === fechaIso && rAula === aulaUpper && rInicio === inicioNorm) {
      const excelRowNum = (used.rowIndex || 0) + r + 1;
      const existingUbicacionFormula = used?.formulas?.[r]?.[5];
      const clearValues = [
        '',
        '',
        '',
        '',
        '',
        typeof existingUbicacionFormula === 'string' && existingUbicacionFormula.startsWith('=') ? existingUbicacionFormula : '',
        '',
        '',
        '',
        ''
      ];
      await patchFormulas(token, target.id, exactWs.name, `A${excelRowNum}:J${excelRowNum}`, [clearValues]);
      return { success: true, clearedRow: excelRowNum };
    }
  }
  return { success: false, message: 'Fila no encontrada en Excel' };
}

export async function pullReservationsFromSheet(db, token, fileId, sheetName) {
  const used = await loadUsed(token, fileId, sheetName);
  if (!used || !Array.isArray(used.values)) return 0;

  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(used.values.length, 15); r++) {
    const rowCells = (used.values[r] || []).map(norm);
    if (rowCells.includes('FECHA') && rowCells.includes('AULA')) {
      headerRowIdx = r;
      break;
    }
  }
  if (headerRowIdx < 0) return 0;

  const parsedDates = parseSheetDates(sheetName);
  const startDate = parsedDates?.startDate;

  const stmts = [];
  let count = 0;

  for (let r = headerRowIdx + 1; r < used.values.length; r++) {
    const row = used.values[r] || [];
    const rawAula = String(row[4] ?? '').toUpperCase().trim();
    const rawDocente = String(row[6] ?? '').trim();
    const rawMotivo = String(row[7] ?? '').trim();
    const rawDia = String(row[1] ?? '').trim().toUpperCase();

    if (!rawAula && !rawDocente && !rawMotivo) continue;

    let fechaIso = serialToISO(row[0]);
    if (!fechaIso && startDate && rawDia && DAY_OFFSETS[rawDia] !== undefined) {
      const deduced = new Date(startDate.getTime() + DAY_OFFSETS[rawDia] * 86400000);
      fechaIso = deduced.toISOString().slice(0, 10);
    }
    if (!fechaIso && parsedDates) {
      fechaIso = parsedDates.startDateStr;
    }

    const dia = rawDia || (fechaIso ? SPANISH_DAYS[new Date(fechaIso + 'T12:00:00').getDay()] : '');
    const inicio = fracToHHMM(row[2]) || '08:00';
    const final = fracToHHMM(row[3]) || '10:00';
    const aula = rawAula;
    let ubicacion = String(row[5] ?? '').trim();
    if (ubicacion === '#N/D' || !ubicacion) {
      ubicacion = `${aula.startsWith('B') ? 'Pabellón B' : 'Pabellón A'}`;
    }
    const docente = rawDocente.toUpperCase();
    const motivo = rawMotivo.toUpperCase() || 'RESERVA DE AULA';
    const usuario = String(row[8] ?? '').trim().toUpperCase() || 'OPERACIONES';
    const obs = String(row[9] ?? '').trim();

    const dt = fechaIso ? new Date(fechaIso + 'T12:00:00') : new Date();
    const mes = RESERVAS_MONTHS[dt.getMonth()] || 'NOVIEMBRE';
    const uniqueKey = `${fechaIso}_${aula}_${inicio.replace(/[^0-9]/g, '')}`;
    const id = `res_xl_${uniqueKey}`;

    stmts.push(
      db.prepare(`
        INSERT INTO reservas (id, fecha, mes, dia, inicio, final, aula, ubicacion, docente, detalle, motivo, usuario, obs, hoja, prioridad, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NORMAL', datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          fecha = excluded.fecha,
          mes = excluded.mes,
          dia = excluded.dia,
          inicio = excluded.inicio,
          final = excluded.final,
          aula = excluded.aula,
          ubicacion = excluded.ubicacion,
          docente = excluded.docente,
          detalle = excluded.detalle,
          motivo = excluded.motivo,
          usuario = excluded.usuario,
          obs = excluded.obs,
          hoja = excluded.hoja
      `).bind(
        id,
        fechaIso,
        mes,
        dia,
        inicio,
        final,
        aula,
        ubicacion,
        docente,
        motivo,
        motivo,
        usuario,
        obs,
        sheetName.trim()
      )
    );
    count++;
  }

  for (let i = 0; i < stmts.length; i += 50) {
    await db.batch(stmts.slice(i, i + 50));
  }
  return count;
}

export async function pullReservationsFromExcel(db, sheetFilter = null) {
  const acc = await getAccess(db);
  if (!acc) return { success: false, message: 'OneDrive no vinculado' };
  const { token } = acc;
  const target = await findReservasTarget(token);
  if (!target || !target.id) return { success: false, message: 'No se encontró archivo RESERVAS' };

  const resWs = await gfetch(token, `${G}/me/drive/items/${target.id}/workbook/worksheets?$select=name`);
  if (!resWs.ok || !Array.isArray(resWs.json?.value)) {
    return { success: false, message: 'Error listando hojas' };
  }

  let sheetsToPull = [];
  if (sheetFilter) {
    const targetWs = resWs.json.value.find(w => w.name.trim() === sheetFilter.trim());
    if (targetWs) sheetsToPull = [targetWs.name];
  } else {
    const now = new Date();
    const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    const allDateSheets = resWs.json.value.filter(w => /^\s*\d{2}\s+[A-Z]{3}\s*-\s*\d{2}\s+[A-Z]{3}\s*$/i.test(w.name));

    let curIdx = allDateSheets.findIndex(w => {
      const p = parseSheetDates(w.name);
      return p && todayStr >= p.startDateStr && todayStr <= p.endDateStr;
    });
    if (curIdx < 0) curIdx = 0;

    const startIdx = Math.max(0, curIdx - 1);
    const endIdx = Math.min(allDateSheets.length - 1, curIdx + 2);
    sheetsToPull = allDateSheets.slice(startIdx, endIdx + 1).map(w => w.name);
  }

  let totalImported = 0;
  for (const sName of sheetsToPull) {
    try {
      const imp = await pullReservationsFromSheet(db, token, target.id, sName);
      totalImported += imp;
    } catch (e) {
      console.error(`Error pulling sheet ${sName}:`, e);
    }
  }

  if (totalImported > 0) {
    await markDbWrite(db);
  }

  return {
    success: true,
    file: target.name,
    sheets: sheetsToPull,
    imported: totalImported
  };
}
