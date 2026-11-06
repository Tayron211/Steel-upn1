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
  return String(v ?? '').trim();
}
function isoToSerial(s) {
  const m = String(s ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s ?? '';
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 + 25569;
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
  if (type === 'date') return isoToSerial(v);
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

// Una sola vez por isolate: evita repetir DDL en cada petición/poll.
// Se guarda a nivel de módulo (no por objeto db) porque el binding env.DB puede
// ser una instancia distinta en cada request y entonces el DDL se repetiría.
let ensuredTablesPromise = null;

export function ensureTables(db) {
  if (!db || typeof db.prepare !== 'function') return Promise.resolve();
  if (!ensuredTablesPromise) {
    ensuredTablesPromise = (async () => {
      await db.prepare(`CREATE TABLE IF NOT EXISTS onedrive_auth (
        id TEXT PRIMARY KEY, refresh_token TEXT, access_token TEXT, expires_at INTEGER,
        item_id TEXT, file_name TEXT, last_web_hash TEXT, last_excel_hash TEXT, updated_at TEXT)`).run();
      await db.prepare('CREATE TABLE IF NOT EXISTS onedrive_state (k TEXT PRIMARY KEY, v TEXT)').run();

      // Índices: sin ellos cada consulta filtrada escanea la tabla completa y
      // dispara el contador de "rows read" de D1 (límite diario del plan free).
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_asistencia_dia ON asistencia(dia)',
        'CREATE INDEX IF NOT EXISTS idx_asistencia_hora ON asistencia(hora_inicio_prog)',
        'CREATE INDEX IF NOT EXISTS idx_asistencia_nrc ON asistencia(nrc)',
        'CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets(estado)',
        'CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_hojas_manuales_fecha ON hojas_manuales(fecha)',
        'CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas(fecha)'
      ];
      for (const sql of indexes) {
        try { await db.prepare(sql).run(); } catch (_) {}
      }
    })().catch((err) => {
      ensuredTablesPromise = null; // permitir reintento si falló
      throw err;
    });
  }
  return ensuredTablesPromise;
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
    const cells = vals[r].map(norm);
    if (musts.every((m) => cells.some((c) => c === m || c.startsWith(m)))) return { row: r, cells };
  }
  return null;
}
function colOf(cells, names) {
  for (const n of names) {
    let i = cells.findIndex((c) => c === n);
    if (i < 0) i = cells.findIndex((c) => c.startsWith(n));
    if (i >= 0) return i;
  }
  return -1;
}

async function patchFormulas(token, itemId, sheet, address, matrix) {
  return gfetch(token, `${G}/me/drive/items/${itemId}/workbook/worksheets/${enc(sheet)}/range(address='${address}')`, {
    method: 'PATCH',
    body: JSON.stringify({ formulas: matrix })
  });
}

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
    select: "SELECT * FROM hojas_manuales WHERE id NOT LIKE 'manual_1_%' AND codigo IS NOT NULL AND codigo != ''",
    sort: (a, b) => {
      const n = (s) => {
        const m = String(s || '').match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 999999;
      };
      return n(a.codigo) - n(b.codigo);
    },
    prefill: (r, ctx) => {
      const info = ctx.nrcMap.get(String(r.nrc || '').trim()) || {};
      let doc = String(r.docente || info.docente || '');
      let rep = String(r.docente_reemplazo || '');
      const m = doc.match(/^(.*?)\s*\[Reemplazo:\s*(.*?)\]$/i);
      if (m) {
        doc = m[1].trim();
        if (!rep) rep = m[2].trim();
      }
      return { ...r, docente: doc, curso: r.curso || info.curso || '', carrera: r.carrera || info.carrera || '', docente_reemplazo: rep };
    },
    insert: (db, id, r) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO hojas_manuales (id, periodo, codigo, fecha, nrc, docente, curso, carrera, motivo, asistente, docente_reemplazo, created_at)
           VALUES (?, '2026-2', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(id, String(r.codigo).replace(/^LNI-/i, 'LN1-'), r.fecha, r.nrc, r.docente, r.curso, r.carrera, r.motivo, r.asistente, r.docente_reemplazo)
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
  const byId = new Map();
  for (const r of dbRows) {
    byId.set(r.id, r);
    const k = spec.key(r);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r);
  }
  let snapshot = [];
  try {
    snapshot = JSON.parse((await getState(db, `ids:${specName}`)) || '[]');
  } catch (_) {}

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
      recs.push(null);
      continue;
    }
    recs.push(rec);
  }

  const upd = spec.hasUpdated ? ", updated_at = datetime('now')" : '';
  const claimed = new Set();
  const stmts = [];
  let changes = 0;
  const unmatched = [];

  recs.forEach((rec, i) => {
    if (!rec) return;
    const q = byKey.get(spec.key(rec));
    const hit = q && q.find((d) => !claimed.has(d.id));
    if (hit) {
      claimed.add(hit.id);
      const sets = [];
      const vals = [];
      for (const c of cols) {
        if (c.idx < 0) continue;
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
      unmatched.push({ rec, i });
    }
  });

  const dataIdx = [];
  recs.forEach((r, i) => dataIdx.push(i));
  for (const { rec, i } of unmatched) {
    const sid = snapshot[i];
    const cand = sid && byId.get(sid);
    if (cand && !claimed.has(cand.id)) {
      claimed.add(cand.id);
      const sets = [];
      const vals = [];
      for (const c of cols) {
        if (c.idx < 0) continue;
        sets.push(`${c.k} = ?`);
        vals.push(rec[c.k]);
      }
      changes++;
      stmts.push(db.prepare(`UPDATE ${spec.table} SET ${sets.join(', ')}${upd} WHERE id = ?`).bind(...vals, cand.id));
    } else {
      changes++;
      const id = `xl_${specName}_${Date.now()}_${i}`;
      stmts.push(spec.insert(db, id, rec));
    }
  }

  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
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
  for (const name of ['tickets', 'manuales', 'reservas']) {
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
  for (let i = 0; i < totalRows; i++) {
    const relRow = firstData + i;
    const baseF = used.formulas[relRow] || [];
    const line = [];
    for (let c = minC; c <= maxC; c++) {
      const col = cols.find((x) => x.idx === c);
      const base = baseF[c] !== undefined ? baseF[c] : '';
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
  }
  if (matrix.length === 0) return { updated: 0 };

  const startAbs = used.rowIndex + firstData + 1;
  const endAbs = startAbs + matrix.length - 1;
  const address = `${colLetter(used.columnIndex + minC)}${startAbs}:${colLetter(used.columnIndex + maxC)}${endAbs}`;
  const res = await patchFormulas(token, itemId, spec.sheet, address, matrix);
  if (rows.length > existingRows) {
    // filas nuevas al final: darles formato de fecha / hora como el resto de la hoja
    const nStart = startAbs + existingRows;
    const nAddr = `${colLetter(used.columnIndex + minC)}${nStart}:${colLetter(used.columnIndex + maxC)}${endAbs}`;
    const fmtRow = [];
    for (let c = minC; c <= maxC; c++) {
      const col = cols.find((x) => x.idx === c);
      fmtRow.push(col && col.t === 'date' ? 'dd/mm/yyyy' : col && col.t === 'time' ? 'hh:mm' : 'General');
    }
    await gfetch(token, `${G}/me/drive/items/${itemId}/workbook/worksheets/${enc(spec.sheet)}/range(address='${nAddr}')`, {
      method: 'PATCH',
      body: JSON.stringify({ numberFormat: Array.from({ length: endAbs - nStart + 1 }, () => fmtRow) })
    });
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

/** Excel -> BD solo si el Excel fue modificado externamente desde la última sincronización */
export async function pullIfExcelChanged(db) {
  await ensureTables(db);
  const acc = await getAccess(db);
  if (!acc) return { success: false, connected: false };
  const { token, row } = acc;
  const itemId = row.item_id;
  if (!itemId) return { success: false, message: 'Sin archivo vinculado' };
  const mod = await itemMod(token, itemId);
  const last = await getState(db, 'excel_mod');
  if (!last) {
    await setState(db, 'excel_mod', mod);
    return { success: true, pulled: false, baseline: true };
  }
  if (!mod || mod === last) return { success: true, pulled: false };
  return withLock(db, 'sync', async () => {
    const changes = await pullFromExcel(db, token, itemId);
    await setState(db, 'excel_mod', mod);
    if (changes > 0) await markDbWrite(db); // el pull escribió filas: avisar a los clientes
    return { success: true, pulled: true, changes };
  });
}

/** BD -> Excel (todos los archivos CONTROL DOCENTE*.xlsx). Antes importa cambios hechos en el Excel. */
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

    // 1) si alguien editó el Excel, primero traemos sus cambios para no pisarlos
    const lastMod = await getState(db, 'excel_mod');
    const mod = await itemMod(token, primary.id);
    let pulled = 0;
    if (lastMod && mod && mod !== lastMod) pulled = await pullFromExcel(db, token, primary.id);
    if (pulled > 0) await markDbWrite(db); // hubo Excel -> BD: avisar a los clientes

    // 2) BD -> Excel (una sola lectura por tabla, compartida entre todos los archivos destino)
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
    for (const a of asRows) {
      const k = String(a.nrc || '').trim();
      if (k && !nrcMap.has(k)) nrcMap.set(k, { docente: a.docente || '', curso: a.curso || '', carrera: a.carrera || '' });
    }
    const ctx = { nrcMap };
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
    await setState(db, 'excel_mod', await itemMod(token, primary.id));
    await setState(db, 'last_push', String(Date.now()));
    await db.prepare("UPDATE onedrive_auth SET updated_at = datetime('now') WHERE id = 'primary'").run();
    return { success: true, connected: true, pulled, filesUpdated: report, message: 'Sincronizado con OneDrive' };
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
