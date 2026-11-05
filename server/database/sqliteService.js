const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { importExcelData } = require('../services/excelImporter');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'controldocente.sqlite');
const EXCEL_PATH = path.join(__dirname, '..', '..', 'CONTROL DOCENTE.xlsx');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

// Helper for Promisified Queries
const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

function normalizeDay(str) {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

async function initDatabase() {
  // Create tables
  await run(`
    CREATE TABLE IF NOT EXISTS asistencia (
      id TEXT PRIMARY KEY,
      piso_pabellon TEXT,
      sede TEXT,
      periodo TEXT,
      dia TEXT,
      hora_inicio_prog TEXT,
      hora_final_prog TEXT,
      aula TEXT,
      nrc TEXT,
      lista_cruzada TEXT,
      codigo_docente TEXT,
      docente TEXT,
      curso TEXT,
      carrera TEXT,
      hora_inicio_real TEXT,
      hora_final_real TEXT,
      asistencia TEXT,
      puntualidad TEXT,
      observacion TEXT,
      real_horas REAL,
      ciclo TEXT,
      updated_at TEXT
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_asist_dia ON asistencia(dia)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_asist_aula ON asistencia(aula)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_asist_docente ON asistencia(docente)`);

  await run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      periodo TEXT,
      fecha TEXT,
      dia TEXT,
      hora_reporte TEXT,
      rango TEXT,
      ambiente TEXT,
      piso TEXT,
      pabellon TEXT,
      tipo_solicitud TEXT,
      estado TEXT,
      descripcion_solucion TEXT,
      responsable TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets(estado)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_tickets_ambiente ON tickets(ambiente)`);

  try { await run(`ALTER TABLE tickets ADD COLUMN firma_entrega TEXT`); } catch (e) {}
  try { await run(`ALTER TABLE tickets ADD COLUMN firma_recepcion TEXT`); } catch (e) {}
  try { await run(`ALTER TABLE tickets ADD COLUMN entregado_por TEXT`); } catch (e) {}
  try { await run(`ALTER TABLE tickets ADD COLUMN recibido_por TEXT`); } catch (e) {}
  try { await run(`ALTER TABLE tickets ADD COLUMN fecha_firma TEXT`); } catch (e) {}

  await run(`
    CREATE TABLE IF NOT EXISTS hojas_manuales (
      id TEXT PRIMARY KEY,
      periodo TEXT,
      codigo TEXT UNIQUE,
      fecha TEXT,
      nrc TEXT,
      docente TEXT,
      curso TEXT,
      carrera TEXT,
      motivo TEXT,
      asistente TEXT,
      created_at TEXT
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_hm_nrc ON hojas_manuales(nrc)`);

  await run(`
    CREATE TABLE IF NOT EXISTS reservas (
      id TEXT PRIMARY KEY,
      fecha TEXT,
      mes TEXT,
      dia TEXT,
      inicio TEXT,
      final TEXT,
      aula TEXT,
      ubicacion TEXT,
      docente TEXT,
      detalle TEXT,
      usuario TEXT,
      prioridad TEXT,
      created_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS ambientes (
      abrv TEXT PRIMARY KEY,
      nombre TEXT,
      pc INTEGER,
      aforo INTEGER,
      pabellon TEXT,
      piso TEXT,
      ubicacion TEXT,
      tipo TEXT
    )
  `);

  // Check if tables are populated; if not, import from Excel safely
  const rowCount = await get(`SELECT COUNT(*) as cnt FROM asistencia`);
  if (!rowCount || rowCount.cnt === 0) {
    console.log('[SQLite] Base de datos vacía. Sembrando datos iniciales desde CONTROL DOCENTE.xlsx...');
    await seedFromExcel();
  } else {
    console.log(`[SQLite] Base de datos SQLite lista (${rowCount.cnt} registros de asistencia en controldocente.sqlite)`);
  }
}

async function seedFromExcel() {
  const excelData = importExcelData(EXCEL_PATH);

  await run('BEGIN TRANSACTION');
  try {
    // 1. Asistencia
    await run('DELETE FROM asistencia');
    for (const a of excelData.asistencia) {
      await run(`
        INSERT INTO asistencia (
          id, piso_pabellon, sede, periodo, dia, hora_inicio_prog, hora_final_prog,
          aula, nrc, lista_cruzada, codigo_docente, docente, curso, carrera,
          hora_inicio_real, hora_final_real, asistencia, puntualidad, observacion,
          real_horas, ciclo, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        a.id, a.pisoPabellon, a.sede, a.periodo, a.dia, a.horaInicioProg, a.horaFinalProg,
        a.aula, a.nrc, a.listaCruzada, a.codigoDocente, a.docente, a.curso, a.carrera,
        a.horaInicioReal, a.horaFinalReal, a.asistencia, a.puntualidad, a.observacion,
        a.real, a.ciclo, new Date().toISOString()
      ]);
    }

    // 2. Tickets
    await run('DELETE FROM tickets');
    for (const t of excelData.tickets) {
      await run(`
        INSERT INTO tickets (
          id, periodo, fecha, dia, hora_reporte, rango, ambiente, piso, pabellon,
          tipo_solicitud, estado, descripcion_solucion, responsable, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        t.id, t.periodo, t.fecha, t.dia, t.horaReporte, t.rango, t.ambiente, t.piso, t.pabellon,
        t.tipoSolicitud, t.estado, t.descripcionSolucion, t.responsable, new Date().toISOString(), new Date().toISOString()
      ]);
    }

    // 3. Hojas Manuales
    await run('DELETE FROM hojas_manuales');
    for (const m of excelData.manualSheets) {
      await run(`
        INSERT OR IGNORE INTO hojas_manuales (
          id, periodo, codigo, fecha, nrc, docente, curso, carrera, motivo, asistente, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        m.id, m.periodo, m.codigo, m.fecha, m.nrc, m.docente, m.curso, m.carrera, m.motivo, m.asistente, new Date().toISOString()
      ]);
    }

    // 4. Reservas
    await run('DELETE FROM reservas');
    for (const r of excelData.reservas) {
      await run(`
        INSERT INTO reservas (
          id, fecha, mes, dia, inicio, final, aula, ubicacion, docente, detalle, usuario, prioridad, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        r.id, r.fecha, r.mes, r.dia, r.inicio, r.final, r.aula, r.ubicacion, r.docente, r.detalle, r.usuario, r.prioridad, new Date().toISOString()
      ]);
    }

    // 5. Ambientes
    await run('DELETE FROM ambientes');
    for (const amb of excelData.ambientes) {
      await run(`
        INSERT OR REPLACE INTO ambientes (
          abrv, nombre, pc, aforo, pabellon, piso, ubicacion, tipo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        amb.abrv, amb.nombre, amb.pc, amb.aforo, amb.pabellon, amb.piso, amb.ubicacion, amb.tipo
      ]);
    }

    await run('COMMIT');
    console.log('[SQLite] Sembrado de datos completado exitosamente.');
  } catch (err) {
    await run('ROLLBACK');
    console.error('[SQLite] Error durante el sembrado de datos:', err);
    throw err;
  }
}

// Map SQLite row to API object
function mapAsistenciaRow(r) {
  return {
    id: r.id,
    pisoPabellon: r.piso_pabellon,
    sede: r.sede,
    periodo: r.periodo,
    dia: r.dia,
    horaInicioProg: r.hora_inicio_prog,
    horaFinalProg: r.hora_final_prog,
    aula: r.aula,
    nrc: r.nrc,
    listaCruzada: r.lista_cruzada,
    codigoDocente: r.codigo_docente,
    docente: r.docente,
    curso: r.curso,
    carrera: r.carrera,
    horaInicioReal: r.hora_inicio_real,
    horaFinalReal: r.hora_final_real,
    asistencia: r.asistencia,
    puntualidad: r.puntualidad,
    observacion: r.observacion,
    real: r.real_horas,
    ciclo: r.ciclo
  };
}

function mapTicketRow(r) {
  return {
    id: r.id,
    periodo: r.periodo,
    fecha: r.fecha,
    dia: r.dia,
    horaReporte: r.hora_reporte,
    rango: r.rango,
    ambiente: r.ambiente,
    piso: r.piso,
    pabellon: r.pabellon,
    tipoSolicitud: r.tipo_solicitud,
    estado: r.estado,
    descripcionSolucion: r.descripcion_solucion,
    responsable: r.responsable,
    firmaEntrega: r.firma_entrega || null,
    firmaRecepcion: r.firma_recepcion || null,
    entregadoPor: r.entregado_por || null,
    recibidoPor: r.recibido_por || null,
    fechaFirma: r.fecha_firma || null,
    createdAt: r.created_at
  };
}

// Queries
async function getAsistencia({ dia, pabellon, piso, hora, search }) {
  let sql = 'SELECT * FROM asistencia WHERE 1=1';
  const params = [];

  if (dia) {
    sql += ' AND UPPER(dia) = ?';
    params.push(normalizeDay(dia));
  }

  if (pabellon) {
    sql += ' AND (UPPER(piso_pabellon) LIKE ? OR UPPER(aula) LIKE ?)';
    params.push(`%- ${pabellon.toUpperCase()}%`, `${pabellon.toUpperCase()}%`);
  }

  if (piso) {
    sql += ' AND UPPER(piso_pabellon) LIKE ?';
    params.push(`%${piso.toUpperCase()}%`);
  }

  if (hora) {
    sql += ' AND hora_inicio_prog = ?';
    params.push(hora);
  }

  if (search) {
    sql += ' AND (LOWER(docente) LIKE ? OR LOWER(curso) LIKE ? OR LOWER(aula) LIKE ? OR nrc LIKE ?)';
    const s = `%${search.toLowerCase().trim()}%`;
    params.push(s, s, s, s);
  }

  sql += ' ORDER BY aula ASC, hora_inicio_prog ASC';
  const rows = await query(sql, params);
  return rows.map(mapAsistenciaRow);
}

async function updateAsistencia(id, updates) {
  const fields = [];
  const params = [];

  if (updates.asistencia !== undefined) {
    fields.push('asistencia = ?');
    params.push(updates.asistencia);
  }
  if (updates.puntualidad !== undefined) {
    fields.push('puntualidad = ?');
    params.push(updates.puntualidad);
  }
  if (updates.horaInicioReal !== undefined) {
    fields.push('hora_inicio_real = ?');
    params.push(updates.horaInicioReal);
  }
  if (updates.horaFinalReal !== undefined) {
    fields.push('hora_final_real = ?');
    params.push(updates.horaFinalReal);
  }
  if (updates.observacion !== undefined) {
    fields.push('observacion = ?');
    params.push(updates.observacion);
  }

  fields.push('updated_at = ?');
  params.push(new Date().toISOString());

  params.push(id);
  await run(`UPDATE asistencia SET ${fields.join(', ')} WHERE id = ?`, params);
  const row = await get('SELECT * FROM asistencia WHERE id = ?', [id]);
  return row ? mapAsistenciaRow(row) : null;
}

async function bulkUpdateAsistencia(ids, updates) {
  if (!ids || ids.length === 0) return 0;
  const placeholders = ids.map(() => '?').join(',');
  const params = [
    updates.asistencia,
    updates.puntualidad,
    updates.horaInicioReal,
    new Date().toISOString(),
    ...ids
  ];
  const res = await run(`
    UPDATE asistencia 
    SET asistencia = ?, puntualidad = ?, hora_inicio_real = ?, updated_at = ?
    WHERE id IN (${placeholders})
  `, params);
  return res.changes;
}

// Tickets CRUD
async function getTickets({ estado, ambiente, responsable, search }) {
  let sql = 'SELECT * FROM tickets WHERE 1=1';
  const params = [];

  if (estado) {
    sql += ' AND estado = ?';
    params.push(estado.toUpperCase().trim());
  }
  if (ambiente) {
    sql += ' AND UPPER(ambiente) LIKE ?';
    params.push(`%${ambiente.toUpperCase().trim()}%`);
  }
  if (responsable) {
    sql += ' AND UPPER(responsable) LIKE ?';
    params.push(`%${responsable.toUpperCase().trim()}%`);
  }
  if (search) {
    sql += ' AND (LOWER(ambiente) LIKE ? OR LOWER(tipo_solicitud) LIKE ? OR LOWER(descripcion_solucion) LIKE ? OR LOWER(responsable) LIKE ?)';
    const s = `%${search.toLowerCase().trim()}%`;
    params.push(s, s, s, s);
  }

  sql += ' ORDER BY created_at DESC';
  const rows = await query(sql, params);
  return rows.map(mapTicketRow);
}

async function createTicket(ticket) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const timeNow = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dateNow = now.toISOString().split('T')[0];
  const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const diaNow = days[now.getDay()];

  const id = `ticket_new_${Date.now()}`;
  const periodo = '2026-2';
  const fecha = ticket.fecha || dateNow;
  const dia = ticket.dia || diaNow;
  const horaReporte = ticket.horaReporte || timeNow;
  const rango = ticket.rango || `${pad(now.getHours())}:00 – ${pad((now.getHours() + 1) % 24)}:00`;
  const ambiente = (ticket.ambiente || '').toUpperCase().trim();
  const piso = ticket.piso || '';
  const pabellon = ticket.pabellon || (ambiente.startsWith('B') ? 'B' : 'A');
  const tipoSolicitud = ticket.tipoSolicitud || 'General';
  const estado = (ticket.estado || 'PENDIENTE').toUpperCase();
  const descripcionSolucion = ticket.descripcionSolucion || '';
  const responsable = ticket.responsable || 'Sin Asignar';
  const firmaEntrega = ticket.firmaEntrega || null;
  const firmaRecepcion = ticket.firmaRecepcion || null;
  const entregadoPor = ticket.entregadoPor || null;
  const recibidoPor = ticket.recibidoPor || null;
  const fechaFirma = ticket.fechaFirma || (firmaEntrega || firmaRecepcion ? now.toISOString() : null);
  const createdAt = now.toISOString();

  await run(`
    INSERT INTO tickets (
      id, periodo, fecha, dia, hora_reporte, rango, ambiente, piso, pabellon,
      tipo_solicitud, estado, descripcion_solucion, responsable, 
      firma_entrega, firma_recepcion, entregado_por, recibido_por, fecha_firma,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, periodo, fecha, dia, horaReporte, rango, ambiente, piso, pabellon,
    tipoSolicitud, estado, descripcionSolucion, responsable,
    firmaEntrega, firmaRecepcion, entregadoPor, recibidoPor, fechaFirma,
    createdAt, createdAt
  ]);

  return {
    id, periodo, fecha, dia, horaReporte, rango, ambiente, piso, pabellon,
    tipoSolicitud, estado, descripcionSolucion, responsable,
    firmaEntrega, firmaRecepcion, entregadoPor, recibidoPor, fechaFirma,
    createdAt
  };
}

async function updateTicket(id, updates) {
  const fields = [];
  const params = [];

  if (updates.estado !== undefined) {
    fields.push('estado = ?');
    params.push(updates.estado);
  }
  if (updates.descripcionSolucion !== undefined) {
    fields.push('descripcion_solucion = ?');
    params.push(updates.descripcionSolucion);
  }
  if (updates.responsable !== undefined) {
    fields.push('responsable = ?');
    params.push(updates.responsable);
  }
  if (updates.firmaEntrega !== undefined) {
    fields.push('firma_entrega = ?');
    params.push(updates.firmaEntrega);
  }
  if (updates.firmaRecepcion !== undefined) {
    fields.push('firma_recepcion = ?');
    params.push(updates.firmaRecepcion);
  }
  if (updates.entregadoPor !== undefined) {
    fields.push('entregado_por = ?');
    params.push(updates.entregadoPor);
  }
  if (updates.recibidoPor !== undefined) {
    fields.push('recibido_por = ?');
    params.push(updates.recibidoPor);
  }
  if (updates.fechaFirma !== undefined) {
    fields.push('fecha_firma = ?');
    params.push(updates.fechaFirma);
  }

  fields.push('updated_at = ?');
  params.push(new Date().toISOString());

  params.push(id);
  await run(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`, params);
  const row = await get('SELECT * FROM tickets WHERE id = ?', [id]);
  return row ? mapTicketRow(row) : null;
}

async function deleteTicket(id) {
  const res = await run('DELETE FROM tickets WHERE id = ?', [id]);
  return res.changes > 0;
}

// Hojas Manuales CRUD
async function getManualSheets({ search, fecha }) {
  let sql = 'SELECT * FROM hojas_manuales WHERE 1=1';
  const params = [];

  if (fecha) {
    sql += ' AND fecha = ?';
    params.push(fecha);
  }
  if (search) {
    sql += ' AND (LOWER(codigo) LIKE ? OR LOWER(docente) LIKE ? OR LOWER(curso) LIKE ? OR nrc LIKE ?)';
    const s = `%${search.toLowerCase().trim()}%`;
    params.push(s, s, s, s);
  }

  sql += ' ORDER BY created_at DESC';
  return await query(sql, params);
}

async function createManualSheet(item) {
  const now = new Date();
  const dateNow = now.toISOString().split('T')[0];

  // Compute next code LN1-XXX
  const existing = await query('SELECT codigo FROM hojas_manuales');
  const existingNums = existing
    .map(m => {
      const match = m.codigo.match(/LN\d*-(\d+)/i);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => !isNaN(n));
  const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
  const autoCode = item.codigo || `LN1-${String(nextNum).padStart(3, '0')}`;

  const id = `manual_new_${Date.now()}`;
  const newSheet = {
    id,
    periodo: '2026-2',
    codigo: autoCode,
    fecha: item.fecha || dateNow,
    nrc: item.nrc || '',
    docente: item.docente || '',
    curso: item.curso || '',
    carrera: item.carrera || '',
    motivo: item.motivo || 'DOCENTE SIN ACCESOS',
    asistente: item.asistente || 'Operador',
    created_at: now.toISOString()
  };

  await run(`
    INSERT INTO hojas_manuales (
      id, periodo, codigo, fecha, nrc, docente, curso, carrera, motivo, asistente, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    newSheet.id, newSheet.periodo, newSheet.codigo, newSheet.fecha, newSheet.nrc,
    newSheet.docente, newSheet.curso, newSheet.carrera, newSheet.motivo, newSheet.asistente, newSheet.created_at
  ]);

  return newSheet;
}

// Reservas CRUD
async function getReservas({ dia, aula, fecha, search }) {
  let sql = 'SELECT * FROM reservas WHERE 1=1';
  const params = [];

  if (dia) {
    sql += ' AND UPPER(dia) = ?';
    params.push(normalizeDay(dia));
  }
  if (aula) {
    sql += ' AND UPPER(aula) LIKE ?';
    params.push(`%${aula.toUpperCase()}%`);
  }
  if (fecha) {
    sql += ' AND fecha = ?';
    params.push(fecha);
  }
  if (search) {
    sql += ' AND (LOWER(aula) LIKE ? OR LOWER(docente) LIKE ? OR LOWER(detalle) LIKE ?)';
    const s = `%${search.toLowerCase().trim()}%`;
    params.push(s, s, s);
  }

  sql += ' ORDER BY fecha DESC, inicio ASC';
  return await query(sql, params);
}

async function createReserva(item) {
  const id = `reserva_new_${Date.now()}`;
  const newRes = {
    id,
    fecha: item.fecha || new Date().toISOString().split('T')[0],
    mes: item.mes || '',
    dia: normalizeDay(item.dia || ''),
    inicio: item.inicio || '08:00',
    final: item.final || '10:00',
    aula: (item.aula || '').toUpperCase(),
    ubicacion: item.ubicacion || '',
    docente: item.docente || '',
    detalle: item.detalle || '',
    usuario: item.usuario || 'Operador',
    prioridad: (item.prioridad || 'NORMAL').toUpperCase(),
    created_at: new Date().toISOString()
  };

  await run(`
    INSERT INTO reservas (
      id, fecha, mes, dia, inicio, final, aula, ubicacion, docente, detalle, usuario, prioridad, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    newRes.id, newRes.fecha, newRes.mes, newRes.dia, newRes.inicio, newRes.final,
    newRes.aula, newRes.ubicacion, newRes.docente, newRes.detalle, newRes.usuario,
    newRes.prioridad, newRes.created_at
  ]);

  return newRes;
}

async function deleteReserva(id) {
  const res = await run('DELETE FROM reservas WHERE id = ?', [id]);
  return res.changes > 0;
}

// Ambientes
async function getAmbientes() {
  return await query('SELECT * FROM ambientes ORDER BY pabellon ASC, abrv ASC');
}

// Dashboard
async function getDashboardStats(diaParam) {
  const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const todayName = days[new Date().getDay()];
  const diaNorm = normalizeDay(diaParam || todayName);

  const classes = await query('SELECT * FROM asistencia WHERE UPPER(dia) = ?', [diaNorm]);
  const totalClasses = classes.length;
  const puntual = classes.filter(c => c.puntualidad === 'PUNTUAL').length;
  const tarde = classes.filter(c => c.puntualidad === 'TARDE').length;
  const falta = classes.filter(c => c.asistencia === 'NO').length;
  const reemplazo = classes.filter(c => c.asistencia && c.asistencia.includes('REEMPLAZO')).length;
  const pendientes = classes.filter(c => c.asistencia === 'PENDIENTE' || (!c.asistencia && !c.puntualidad)).length;

  const totalAsistieron = puntual + tarde + reemplazo;
  const pctAsistencia = totalClasses > 0 ? Math.round((totalAsistieron / totalClasses) * 100) : 0;

  const tickets = await query('SELECT estado, tipo_solicitud FROM tickets');
  const ticketsPendientes = tickets.filter(t => t.estado === 'PENDIENTE').length;
  const ticketsEnProceso = tickets.filter(t => t.estado === 'EN PROCESO').length;
  const ticketsAtendidos = tickets.filter(t => t.estado === 'ATENDIDO').length;

  const categoryCounts = {};
  tickets.forEach(t => {
    const cat = t.tipo_solicitud || 'Otros';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  return {
    dia: diaNorm,
    totalClasses,
    puntual,
    tarde,
    falta,
    reemplazo,
    pendientes,
    pctAsistencia,
    ticketsPendientes,
    ticketsEnProceso,
    ticketsAtendidos,
    categoryCounts
  };
}

// Full Export data getter
async function getAllDataForExport() {
  const asistenciaRows = await query('SELECT * FROM asistencia ORDER BY dia, aula');
  const ticketsRows = await query('SELECT * FROM tickets ORDER BY fecha DESC');
  const manualRows = await query('SELECT * FROM hojas_manuales ORDER BY codigo DESC');
  const reservasRows = await query('SELECT * FROM reservas ORDER BY fecha DESC');
  const ambientesRows = await query('SELECT * FROM ambientes ORDER BY pabellon, abrv');

  return {
    asistencia: asistenciaRows.map(mapAsistenciaRow),
    tickets: ticketsRows.map(mapTicketRow),
    manualSheets: manualRows,
    reservas: reservasRows,
    ambientes: ambientesRows
  };
}

module.exports = {
  initDatabase,
  seedFromExcel,
  getAsistencia,
  updateAsistencia,
  bulkUpdateAsistencia,
  getTickets,
  createTicket,
  updateTicket,
  deleteTicket,
  getManualSheets,
  createManualSheet,
  getReservas,
  createReserva,
  deleteReserva,
  getAmbientes,
  getDashboardStats,
  getAllDataForExport
};

