/**
 * Cloudflare Pages Functions API Handler
 * Handles all /api/* requests 24/7 at the edge with Cloudflare D1 (Serverless SQLite)
 */
import { buildMasterExcelFromTemplate } from '../../src/utils/excelTemplateExporter';
import { 
  pushToExcel, 
  pullIfExcelChanged, 
  debugInspect, 
  ensureTables,
  getReservasSheetsList,
  appendReservationToExcel,
  deleteReservationFromExcel,
  pullReservationsFromExcel,
  getReservasSheetNameForDate
} from '../../src/utils/onedriveGraphSync';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      // Datos siempre frescos: los pollers dependen de ver los cambios al instante
      'Cache-Control': 'no-store'
    }
  });
}

function normalizeDay(day) {
  if (!day) return '';
  return day.trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function mapTicket(t) {
  return {
    id: t.id,
    periodo: t.periodo,
    fecha: t.fecha,
    dia: t.dia,
    horaReporte: t.hora_reporte,
    rango: t.rango,
    ambiente: t.ambiente,
    piso: t.piso,
    pabellon: t.pabellon,
    tipoSolicitud: t.tipo_solicitud,
    estado: t.estado,
    usuario: t.usuario || (String(t.descripcion_solucion || '').toUpperCase().includes('ALUMNO') ? 'ALUMNO' : 'DOCENTE'),
    descripcionSolucion: t.descripcion_solucion,
    responsable: t.responsable,
    firmaEntrega: t.firma_entrega || null,
    firmaRecepcion: t.firma_recepcion || null,
    firmaDevolucion: t.firma_devolucion || null,
    entregadoPor: t.entregado_por || null,
    recibidoPor: t.recibido_por || null,
    fechaFirma: t.fecha_firma || null,
    fechaDevolucion: t.fecha_devolucion || null
  };
}

// El push a Excel lee todas las tablas de D1. Con escrituras seguidas (ronda de
// asistencia) cada 30 s se agotaba el límite diario de filas leídas. 2 minutos
// mantiene el Excel razonablemente al día con una fracción de las lecturas.
const SYNC_THROTTLE_MS = 120000;

// Columnas ya verificadas y creadas permanentemente en D1
function ensureTicketColumns(db) {
  return Promise.resolve();
}

export async function onRequest(context) {
  const { request, env } = context;
  const response = await handleApiRequest(context);
  try {
    const p = new URL(request.url).pathname;
    const m = request.method;
    // Cada cambio (POST/PUT/DELETE) marca la BD como sucia y dispara la sincronización con OneDrive
    // como máximo una vez cada 30 s (throttle): evita agotar el límite diario de lecturas de filas de D1
    if (
      response.ok &&
      (m === 'POST' || m === 'PUT' || m === 'DELETE') &&
      p.startsWith('/api/') &&
      !p.startsWith('/api/onedrive/')
    ) {
      context.waitUntil(
        (async () => {
          try {
            const db = env.DB;
            await ensureTables(db);
            const nowMs = String(Date.now());
            await db.prepare("INSERT OR REPLACE INTO onedrive_state (k, v) VALUES ('dirty', '1')").run();
            await db.prepare("INSERT OR REPLACE INTO onedrive_state (k, v) VALUES ('last_write_ts', ?)").bind(nowMs).run();
            // Disparar sincronización directa a OneDrive (pushToExcel maneja lock, snapshot y dirty)
            await pushToExcel(db);
          } catch (err) {
            console.error('Auto sync to OneDrive error:', err);
          }
        })()
      );
    }
  } catch (_) {}
  return response;
}

async function handleApiRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // Deja listos índices/tablas de apoyo (memorizado por isolate). No debe romper
  // la API si algo falla: las optimizaciones son opcionales.
  try { await ensureTables(db); } catch (_) {}

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const method = request.method;

  try {
    // -------------------------------------------------------------
    // 1. ATTENDANCE: /api/attendance
    // -------------------------------------------------------------
    if (path === '/api/attendance' && method === 'GET') {
      const dia = url.searchParams.get('dia');
      const pabellon = url.searchParams.get('pabellon');
      const piso = url.searchParams.get('piso');
      const hora = url.searchParams.get('hora');
      const horaDesde = url.searchParams.get('hora_desde');
      const search = url.searchParams.get('search');
      const nrc = url.searchParams.get('nrc');

      let query = 'SELECT * FROM asistencia WHERE 1=1';
      const params = [];

      if (dia) {
        query += ' AND dia = ?';
        params.push(normalizeDay(dia));
      }
      if (pabellon) {
        query += ' AND (UPPER(piso_pabellon) LIKE ? OR UPPER(aula) LIKE ?)';
        params.push(`%- ${pabellon.toUpperCase()}%`, `${pabellon.toUpperCase()}%`);
      }
      if (piso) {
        const pisoItems = piso.split(',').map(p => p.trim()).filter(Boolean);
        if (pisoItems.length === 1) {
          const pUpper = pisoItems[0].toUpperCase();
          if (pUpper.includes('SOT')) {
            query += " AND (UPPER(piso_pabellon) LIKE '%SOTANO%' OR UPPER(piso_pabellon) LIKE '%SÓTANO%')";
          } else {
            query += ' AND UPPER(piso_pabellon) LIKE ?';
            params.push(`%${pUpper}%`);
          }
        } else if (pisoItems.length > 1) {
          const orClauses = [];
          for (const item of pisoItems) {
            const pUpper = item.toUpperCase();
            if (pUpper.includes('SOT')) {
              orClauses.push("(UPPER(piso_pabellon) LIKE '%SOTANO%' OR UPPER(piso_pabellon) LIKE '%SÓTANO%')");
            } else {
              orClauses.push('UPPER(piso_pabellon) LIKE ?');
              params.push(`%${pUpper}%`);
            }
          }
          if (orClauses.length > 0) {
            query += ` AND (${orClauses.join(' OR ')})`;
          }
        }
      }
      if (hora) {
        query += ' AND hora_inicio_prog = ?';
        params.push(hora);
      } else if (horaDesde) {
        query += ' AND hora_inicio_prog >= ?';
        params.push(horaDesde);
      }
      if (nrc) {
        query += ' AND (nrc = ? OR CAST(nrc AS TEXT) = ? OR CAST(nrc AS TEXT) LIKE ?)';
        params.push(nrc, nrc, `%${nrc}%`);
      }
      if (search) {
        query += ' AND (LOWER(docente) LIKE ? OR LOWER(curso) LIKE ? OR LOWER(aula) LIKE ? OR LOWER(carrera) LIKE ? OR CAST(nrc AS TEXT) LIKE ?)';
        const s = `%${search.toLowerCase()}%`;
        params.push(s, s, s, s, s);
      }

      query += ' ORDER BY hora_inicio_prog ASC, aula ASC';

      const stmt = db.prepare(query);
      const { results } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

      const mapped = results.map(r => ({
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
      }));

      return json({ success: true, count: mapped.length, data: mapped });
    }

    // PUT /api/attendance/:id
    const attendanceMatch = path.match(/^\/api\/attendance\/([^/]+)$/);
    if (attendanceMatch && method === 'PUT') {
      const id = attendanceMatch[1];
      const body = await request.json();

      const fields = [];
      const values = [];

      if ('asistencia' in body) { fields.push('asistencia = ?'); values.push(body.asistencia); }
      if ('puntualidad' in body) { fields.push('puntualidad = ?'); values.push(body.puntualidad); }
      if ('horaInicioReal' in body) { fields.push('hora_inicio_real = ?'); values.push(body.horaInicioReal); }
      if ('horaFinalReal' in body) { fields.push('hora_final_real = ?'); values.push(body.horaFinalReal); }
      if ('observacion' in body) { fields.push('observacion = ?'); values.push(body.observacion); }
      if ('docente' in body) { fields.push('docente = ?'); values.push(body.docente); }

      if (fields.length > 0) {
        fields.push("updated_at = datetime('now')");
        values.push(id);
        const updateSql = `UPDATE asistencia SET ${fields.join(', ')} WHERE id = ?`;
        await db.prepare(updateSql).bind(...values).run();
      }

      const updated = await db.prepare('SELECT * FROM asistencia WHERE id = ?').bind(id).first();
      return json({ success: true, data: updated });
    }

    // -------------------------------------------------------------
    // 2. TICKETS / PRÉSTAMOS: /api/tickets
    // -------------------------------------------------------------
    if (path.startsWith('/api/tickets')) {
      await ensureTicketColumns(db);
    }

    if (path === '/api/tickets' && method === 'GET') {
      const estado = url.searchParams.get('estado');
      if (url.searchParams.get('count') === '1') {
        // Solo devuelve el número, sin traer todas las filas al cliente (contador del header)
        let csql = 'SELECT COUNT(*) AS c FROM tickets WHERE 1=1';
        const cparams = [];
        if (estado) {
          csql += ' AND estado = ?';
          cparams.push(estado);
        }
        const cr = cparams.length > 0 ? await db.prepare(csql).bind(...cparams).all() : await db.prepare(csql).all();
        return json({ success: true, count: cr.results && cr.results[0] ? Number(cr.results[0].c) : 0 });
      }
      let sql = 'SELECT * FROM tickets WHERE 1=1';
      const params = [];
      if (estado) {
        sql += ' AND estado = ?';
        params.push(estado);
      }
      sql += ' ORDER BY created_at DESC';

      const stmt = db.prepare(sql);
      const { results } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

      const mapped = results.map(mapTicket);

      return json({ success: true, count: mapped.length, data: mapped });
    }

    // Un solo ticket: lo usa el modal de firmas para no releer toda la tabla
    const ticketMatch = path.match(/^\/api\/tickets\/([^/]+)$/);
    if (ticketMatch && method === 'GET') {
      const t = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(ticketMatch[1]).first();
      if (!t) return json({ success: false, error: 'Ticket no encontrado' }, 404);
      return json({ success: true, data: mapTicket(t) });
    }

    if (path === '/api/tickets' && method === 'POST') {
      const body = await request.json();
      const id = `ticket_new_${Date.now()}`;
      const now = new Date();
      const fecha = now.toISOString().split('T')[0];
      const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
      const dia = days[now.getDay()];
      const horaReporte = now.toTimeString().slice(0, 5);
      const inferredUsuario = body.usuario
        ? String(body.usuario).toUpperCase().trim()
        : String(body.descripcionSolucion || '').toUpperCase().includes('ALUMNO')
          ? 'ALUMNO'
          : 'DOCENTE';

      const ins = {
        id,
        periodo: '226434',
        fecha,
        dia,
        hora_reporte: horaReporte,
        rango: body.rango || '',
        ambiente: body.ambiente || '',
        piso: body.piso || '',
        pabellon: body.pabellon || '',
        tipo_solicitud: body.tipoSolicitud || 'PLUMONES / MATERIALES',
        estado: body.estado || 'EN PROCESO',
        usuario: inferredUsuario,
        descripcion_solucion: body.descripcionSolucion || '',
        responsable: body.responsable || 'OPERACIONES SEDE',
        firma_entrega: body.firmaEntrega || null,
        firma_recepcion: body.firmaRecepcion || null,
        entregado_por: body.entregadoPor || null,
        recibido_por: body.recibidoPor || null,
        fecha_firma: body.fechaFirma || (body.firmaEntrega || body.firmaRecepcion ? now.toISOString() : null)
      };

      await db.prepare(`
        INSERT INTO tickets (
          id, periodo, fecha, dia, hora_reporte, rango, ambiente, piso, pabellon, 
          tipo_solicitud, estado, usuario, descripcion_solucion, responsable,
          firma_entrega, firma_recepcion, entregado_por, recibido_por, fecha_firma,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        ins.id, ins.periodo, ins.fecha, ins.dia, ins.hora_reporte,
        ins.rango, ins.ambiente, ins.piso, ins.pabellon, ins.tipo_solicitud,
        ins.estado, ins.usuario, ins.descripcion_solucion, ins.responsable,
        ins.firma_entrega, ins.firma_recepcion, ins.entregado_por, ins.recibido_por, ins.fecha_firma
      ).run();

      const created = {
        id: ins.id,
        periodo: ins.periodo,
        fecha: ins.fecha,
        dia: ins.dia,
        horaReporte: ins.hora_reporte,
        rango: ins.rango,
        ambiente: ins.ambiente,
        piso: ins.piso,
        pabellon: ins.pabellon,
        tipoSolicitud: ins.tipo_solicitud,
        estado: ins.estado,
        usuario: ins.usuario,
        descripcionSolucion: ins.descripcion_solucion,
        responsable: ins.responsable,
        firmaEntrega: ins.firma_entrega,
        firmaRecepcion: ins.firma_recepcion,
        entregadoPor: ins.entregado_por,
        recibidoPor: ins.recibido_por,
        fechaFirma: ins.fecha_firma
      };

      return json({ success: true, data: created });
    }

    if (ticketMatch && method === 'PUT') {
      const id = ticketMatch[1];
      const body = await request.json();
      const fields = [];
      const values = [];

      if ('estado' in body) { fields.push('estado = ?'); values.push(body.estado); }
      if ('descripcionSolucion' in body) { fields.push('descripcion_solucion = ?'); values.push(body.descripcionSolucion); }
      if ('responsable' in body) { fields.push('responsable = ?'); values.push(body.responsable); }
      if ('firmaEntrega' in body) { fields.push('firma_entrega = ?'); values.push(body.firmaEntrega); }
      if ('firmaRecepcion' in body) { fields.push('firma_recepcion = ?'); values.push(body.firmaRecepcion); }
      if ('firmaDevolucion' in body) { fields.push('firma_devolucion = ?'); values.push(body.firmaDevolucion); }
      if ('entregadoPor' in body) { fields.push('entregado_por = ?'); values.push(body.entregadoPor); }
      if ('recibidoPor' in body) { fields.push('recibido_por = ?'); values.push(body.recibidoPor); }
      if ('fechaFirma' in body) { fields.push('fecha_firma = ?'); values.push(body.fechaFirma); }
      if ('fechaDevolucion' in body) { fields.push('fecha_devolucion = ?'); values.push(body.fechaDevolucion); }

      if (fields.length > 0) {
        fields.push("updated_at = datetime('now')");
        values.push(id);
        await db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
      }

      const updated = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
      return json({ 
        success: true, 
        data: updated ? {
          id: updated.id,
          periodo: updated.periodo,
          fecha: updated.fecha,
          dia: updated.dia,
          horaReporte: updated.hora_reporte,
          rango: updated.rango,
          ambiente: updated.ambiente,
          piso: updated.piso,
          pabellon: updated.pabellon,
          tipoSolicitud: updated.tipo_solicitud,
          estado: updated.estado,
          descripcionSolucion: updated.descripcion_solucion,
          responsable: updated.responsable,
          firmaEntrega: updated.firma_entrega || null,
          firmaRecepcion: updated.firma_recepcion || null,
          firmaDevolucion: updated.firma_devolucion || null,
          entregadoPor: updated.entregado_por || null,
          recibidoPor: updated.recibido_por || null,
          fechaFirma: updated.fecha_firma || null,
          fechaDevolucion: updated.fecha_devolucion || null
        } : null 
      });
    }

    if (ticketMatch && method === 'DELETE') {
      const id = ticketMatch[1];
      await db.prepare('DELETE FROM tickets WHERE id = ?').bind(id).run();
      return json({ success: true, message: 'Ticket eliminado' });
    }

    // -------------------------------------------------------------
    // 3. ROOMS: /api/rooms
    // -------------------------------------------------------------
    if (path === '/api/rooms' && method === 'GET') {
      const { results } = await db.prepare(`
        SELECT * FROM ambientes 
        ORDER BY pabellon ASC, 
                 CASE 
                   WHEN piso LIKE '%SÓT%' OR piso LIKE '%SOT%' THEN 0
                   WHEN piso LIKE '%1%' OR piso LIKE '%PRIMER%' THEN 1
                   WHEN piso LIKE '%2%' OR piso LIKE '%SEGUNDO%' THEN 2
                   WHEN piso LIKE '%3%' OR piso LIKE '%TERCER%' THEN 3
                   WHEN piso LIKE '%4%' OR piso LIKE '%CUARTO%' THEN 4
                   WHEN piso LIKE '%5%' OR piso LIKE '%QUINTO%' THEN 5
                   ELSE 6
                 END ASC, 
                 abrv ASC
      `).all();
      return json({ success: true, count: results.length, data: results });
    }

    // -------------------------------------------------------------
    // 3.5 ASISTENTES Y RESPONSABLES: /api/assistants
    // -------------------------------------------------------------
    if (path === '/api/assistants' && method === 'GET') {
      const defaultList = [
        'TAYRON SALINAS',
        'JOSÉ CARLOS MIRANDA ROSALES',
        'FRANCISCO ALONSO VILLAFAN COLONIA',
        'JAVIER ALEXANDER BENITES ALBAN',
        'ALESSANDRO PASCUAL ROMERO',
        'JAEL ZULEMA GALLARDO CARRANZA',
        'JANETH VIVAR PEREZ',
        'JHONAYKER MAGUIÑA',
        'EDUARDO ANTONIO VELASQUEZ CARRION',
        'JUNIOR MARINO FLORES PUMACAYO',
        'DAVID SAMUEL HUSAREZ CABRERA'
      ];
      const set = new Set();
      const results = [];
      const add = (name) => {
        const clean = String(name || '').trim().toUpperCase();
        if (clean && clean.length > 2 && !clean.includes('#N/D') && !clean.includes('#N/A') && !set.has(clean)) {
          set.add(clean);
          results.push(clean);
        }
      };

      // TAYRON SALINAS siempre primero
      add('TAYRON SALINAS');

      try {
        const { results: r1 } = await db.prepare(`
          SELECT DISTINCT asistente FROM hojas_manuales WHERE asistente IS NOT NULL AND TRIM(asistente) != ''
        `).all();
        if (r1) r1.forEach(row => add(row.asistente));
      } catch (_) {}

      try {
        const { results: r2 } = await db.prepare(`
          SELECT DISTINCT responsable FROM tickets WHERE responsable IS NOT NULL AND TRIM(responsable) != ''
        `).all();
        if (r2) r2.forEach(row => add(row.responsable));
      } catch (_) {}

      defaultList.forEach(add);

      return json({ success: true, count: results.length, data: results });
    }

    // -------------------------------------------------------------
    // 4. MANUAL SHEETS: /api/manual-sheets
    // -------------------------------------------------------------
    if (path === '/api/manual-sheets' && method === 'GET') {
      // Limpiar automáticamente filas fantasma de plantilla vacía en Excel (#N/D y sin nrc/fecha)
      try {
        await db.prepare(`
          DELETE FROM hojas_manuales 
          WHERE (nrc IS NULL OR TRIM(nrc) = '') 
            AND (fecha IS NULL OR TRIM(fecha) = '') 
            AND (docente IS NULL OR TRIM(docente) = '' OR docente LIKE '%#N/D%' OR docente LIKE '%#N/A%')
        `).run();
      } catch (_) {}

      const { results } = await db.prepare(`
        SELECT * FROM hojas_manuales 
        WHERE (docente IS NOT NULL AND TRIM(docente) != '' AND docente NOT LIKE '%#N/D%' AND docente NOT LIKE '%#N/A%') 
           OR (nrc IS NOT NULL AND TRIM(nrc) != '') 
           OR (fecha IS NOT NULL AND TRIM(fecha) != '')
        ORDER BY fecha DESC, id DESC
      `).all();
      return json({ success: true, count: results.length, data: results });
    }

    if (path === '/api/manual-sheets' && method === 'POST') {
      const body = await request.json();
      
      // Limpiar filas fantasma si las hubiera
      try {
        await db.prepare(`
          DELETE FROM hojas_manuales 
          WHERE (nrc IS NULL OR TRIM(nrc) = '') 
            AND (fecha IS NULL OR TRIM(fecha) = '') 
            AND (docente IS NULL OR TRIM(docente) = '' OR docente LIKE '%#N/D%' OR docente LIKE '%#N/A%')
        `).run();
      } catch (_) {}

      let codigo = (body.codigo || '').trim().toUpperCase().replace(/^LNI-/i, 'LN1-');
      if (codigo) {
        // Asegurar formato LN1-XXX
        const m = codigo.match(/^(?:LN\d*-)?(\d+)$/i);
        if (m) {
          codigo = `LN1-${m[1].padStart(3, '0')}`;
        }
        // Validación estricta: El código es ÚNICO e IRREPETIBLE entre hojas REALES
        const existing = await db.prepare(`
          SELECT id, codigo FROM hojas_manuales 
          WHERE UPPER(TRIM(REPLACE(codigo, 'LNI-', 'LN1-'))) = ?
            AND ((docente IS NOT NULL AND TRIM(docente) != '' AND docente NOT LIKE '%#N/D%' AND docente NOT LIKE '%#N/A%') 
                 OR (nrc IS NOT NULL AND TRIM(nrc) != '') 
                 OR (fecha IS NOT NULL AND TRIM(fecha) != ''))
        `).bind(codigo).first();

        if (existing) {
          return json({
            success: false,
            error: `El código "${codigo}" ya está registrado y no puede repetirse.`
          }, 409);
        }
      } else {
        // Siguiente código según el mayor LN1-XXX de hojas REALES
        const { results: codes } = await db.prepare(`
          SELECT codigo FROM hojas_manuales 
          WHERE (docente IS NOT NULL AND TRIM(docente) != '' AND docente NOT LIKE '%#N/D%' AND docente NOT LIKE '%#N/A%') 
             OR (nrc IS NOT NULL AND TRIM(nrc) != '') 
             OR (fecha IS NOT NULL AND TRIM(fecha) != '')
        `).all();
        const maxNum = (codes || []).reduce((max, r) => {
          const m = String(r.codigo || '').match(/LN\d*-(\d+)/i);
          const n = m ? parseInt(m[1], 10) : 0;
          return n > max ? n : max;
        }, 0);
        codigo = `LN1-${String(maxNum + 1).padStart(3, '0')}`;
      }

      const id = `manual_new_${Date.now()}`;
      const fecha = body.fecha || new Date().toISOString().split('T')[0];
      let motivo = String(body.motivo || 'DOCENTE SIN ACCESOS').trim();
      let suplente = String(body.docenteReemplazo || body.docente_reemplazo || '').trim().toUpperCase();
      if (!suplente) {
        const m = motivo.match(/REEMPLAZO\s*\(([^)]+)\)/i);
        if (m) suplente = m[1].trim().toUpperCase();
      }
      motivo = motivo.replace(/\s*\([^)]*\)\s*$/, '').trim();

      let carrera = String(body.carrera || '').trim();
      let curso = String(body.curso || '').trim();
      let docente = String(body.docente || '').trim();

      // Si carrera o datos clave vienen vacíos, resolver automáticamente desde la tabla asistencia por NRC o Curso
      if ((!carrera || !curso || !docente) && (body.nrc || curso)) {
        const cleanNrc = String(body.nrc || '').trim();
        const paddedNrc = cleanNrc ? cleanNrc.padStart(5, '0') : '';
        const unpaddedNrc = cleanNrc ? cleanNrc.replace(/^0+/, '') : '';
        const match = await db.prepare(`
          SELECT carrera, curso, docente FROM asistencia 
          WHERE (
            (? != '' AND (nrc = ? OR nrc = ? OR nrc = ? OR nrc LIKE ?))
            OR (? != '' AND UPPER(TRIM(curso)) = UPPER(TRIM(?)))
          ) AND carrera IS NOT NULL AND TRIM(carrera) != ''
          LIMIT 1
        `).bind(
          cleanNrc, cleanNrc, paddedNrc, unpaddedNrc, `%${cleanNrc}%`,
          curso, curso
        ).first();

        if (match) {
          if (!carrera && match.carrera) carrera = String(match.carrera).trim();
          if (!curso && match.curso) curso = String(match.curso).trim();
          if (!docente && match.docente) docente = String(match.docente).trim();
        }
      }

      await db.prepare(`
        INSERT INTO hojas_manuales (id, periodo, codigo, fecha, nrc, docente, curso, carrera, motivo, asistente, detalle, aula, hora_inicio, hora_fin, firma_docente, docente_reemplazo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        id,
        body.periodo || '2026-2',
        codigo,
        fecha,
        body.nrc ? String(body.nrc) : '',
        docente,
        curso,
        carrera,
        motivo,
        body.asistente || 'OPERACIONES',
        body.detalle || '',
        body.aula || '',
        body.hora_inicio || '',
        body.hora_fin || '',
        body.firma_docente || '',
        suplente
      ).run();

      const created = await db.prepare('SELECT * FROM hojas_manuales WHERE id = ?').bind(id).first();
      return json({ success: true, data: created });
    }

    // -------------------------------------------------------------
    // 5. RESERVATIONS: /api/reservations (Vinculado a RESERVAS 2026 - TAY.xlsx)
    // -------------------------------------------------------------
    if (path === '/api/reservations/sheets' && method === 'GET') {
      try {
        const sheets = await getReservasSheetsList(db);
        return json({ success: true, count: sheets.length, data: sheets });
      } catch (err) {
        console.error('Error obteniendo hojas de reservas:', err);
        return json({ success: false, error: err.message }, 500);
      }
    }

    if (path === '/api/reservations/pull' && method === 'POST') {
      try {
        let reqSheet = null;
        try {
          const body = await request.json();
          reqSheet = body?.sheet || null;
        } catch (_) {}
        const pullRes = await pullReservationsFromExcel(db, reqSheet);
        return json(pullRes);
      } catch (err) {
        console.error('Error importando reservas de Excel:', err);
        return json({ success: false, error: err.message }, 500);
      }
    }

    if (path === '/api/reservations' && method === 'GET') {
      const sheet = url.searchParams.get('sheet') || url.searchParams.get('hoja');
      const fecha = url.searchParams.get('fecha');
      const dia = url.searchParams.get('dia');

      let query = 'SELECT * FROM reservas WHERE 1=1';
      const params = [];

      if (sheet) {
        query += ' AND (TRIM(hoja) = TRIM(?) OR hoja LIKE ?)';
        params.push(sheet, `%${sheet.trim()}%`);
      }
      if (fecha) {
        query += ' AND fecha = ?';
        params.push(fecha);
      }
      if (dia) {
        query += ' AND UPPER(dia) = ?';
        params.push(dia.toUpperCase());
      }
      query += ' ORDER BY fecha DESC, inicio ASC';

      const { results } = await db.prepare(query).bind(...params).all();
      return json({ success: true, count: results.length, data: results });
    }

    if (path === '/api/reservations' && method === 'POST') {
      const body = await request.json();
      const id = `res_${Date.now()}`;
      const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
      const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
      const fechaStr = body.fecha || new Date().toISOString().split('T')[0];
      const dt = new Date(fechaStr + 'T12:00:00');
      const mes = body.mes || months[dt.getMonth()] || 'NOVIEMBRE';
      const dia = body.dia || days[dt.getDay()] || 'LUNES';
      const inicio = body.inicio || body.hora_inicio || body.horaInicio || '08:00';
      const final = body.final || body.hora_fin || body.horaFin || '10:00';
      const aula = (body.aula || '').toUpperCase().trim();
      const ubicacion = body.ubicacion || '';
      const docente = (body.docente || '').toUpperCase().trim();
      const motivo = (body.motivo || body.detalle || body.actividades || 'RESERVA DE AULA').toUpperCase().trim();
      const detalle = motivo;
      const usuario = (body.usuario || 'OPERACIONES').toUpperCase().trim();
      const prioridad = body.prioridad || 'NORMAL';
      const obs = (body.obs || body.observaciones || '').trim();
      const targetSheet = getReservasSheetNameForDate(fechaStr) || '';
      const hoja = (body.hoja || targetSheet || '').trim();

      await db.prepare(`
        INSERT INTO reservas (id, fecha, mes, dia, inicio, final, aula, ubicacion, docente, detalle, motivo, usuario, prioridad, obs, hoja, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        id,
        fechaStr,
        mes,
        dia,
        inicio,
        final,
        aula,
        ubicacion,
        docente,
        detalle,
        motivo,
        usuario,
        prioridad,
        obs,
        hoja
      ).run();

      const created = await db.prepare('SELECT * FROM reservas WHERE id = ?').bind(id).first();

      // Guardar inmediatamente en la hoja y columna respectiva de RESERVAS 2026 - TAY.xlsx
      let excelSync = null;
      try {
        excelSync = await appendReservationToExcel(db, created);
      } catch (errSync) {
        console.error('Error escribiendo en Excel de OneDrive:', errSync);
      }

      return json({ success: true, data: created, sheet: hoja, excelSync });
    }

    const reservationMatch = path.match(/^\/api\/reservations\/([^/]+)$/);
    if (reservationMatch && method === 'DELETE') {
      const id = reservationMatch[1];
      const existing = await db.prepare('SELECT * FROM reservas WHERE id = ?').bind(id).first();
      await db.prepare('DELETE FROM reservas WHERE id = ?').bind(id).run();
      if (existing) {
        try {
          await deleteReservationFromExcel(db, existing);
        } catch (errDel) {
          console.error('Error eliminando fila en Excel:', errDel);
        }
      }
      return json({ success: true, message: 'Reserva eliminada' });
    }

    if (path === '/api/sync-excel') {
      return json({ 
        success: true, 
        message: 'Base de datos Cloudflare D1 activa 24/7 y sincronizada.',
        data: { message: 'Base de datos Cloudflare D1 activa 24/7 y sincronizada.' }
      });
    }

    // -------------------------------------------------------------
    // IMPORTACIÓN MASIVA DE EXCEL A CLOUDFLARE D1 (TODAS LAS HOJAS)
    // -------------------------------------------------------------
    if (path === '/api/import-excel-data' && method === 'POST') {
      const body = await request.json();
      const {
        asistencia = [],
        tickets = [],
        manualSheets = [],
        reservas = [],
        ambientes = [],
        clearExisting = true
      } = body;

      if (clearExisting && asistencia.length > 0) {
        await db.prepare('DELETE FROM asistencia').run();
      }

      if (asistencia.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < asistencia.length; i += chunkSize) {
          const chunk = asistencia.slice(i, i + chunkSize);
          const stmts = chunk.map((a, idx) => {
            const id = a.id || `asist_imp_${Date.now()}_${i + idx}`;
            return db.prepare(`
              INSERT OR REPLACE INTO asistencia (
                id, piso_pabellon, sede, periodo, dia, hora_inicio_prog, hora_final_prog,
                aula, nrc, lista_cruzada, codigo_docente, docente, curso, carrera,
                hora_inicio_real, hora_final_real, asistencia, puntualidad, observacion,
                real_horas, ciclo, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `).bind(
              id,
              a.pisoPabellon || a.piso_pabellon || '',
              a.sede || 'Comas',
              a.periodo || '2026-2',
              normalizeDay(a.dia || ''),
              a.horaInicioProg || a.hora_inicio_prog || '',
              a.horaFinalProg || a.hora_final_prog || '',
              (a.aula || '').trim().toUpperCase(),
              a.nrc ? String(a.nrc).trim() : '',
              a.listaCruzada || a.lista_cruzada || '',
              a.codigoDocente || a.codigo_docente || '',
              (a.docente || '').trim().toUpperCase(),
              (a.curso || '').trim().toUpperCase(),
              a.carrera || '',
              a.horaInicioReal || a.hora_inicio_real || '',
              a.horaFinalReal || a.hora_final_real || '',
              (a.asistencia || 'PENDIENTE').trim().toUpperCase(),
              a.puntualidad || '-',
              a.observacion || '',
              a.real !== undefined && a.real !== null ? Number(a.real) : null,
              a.ciclo || ''
            );
          });
          await db.batch(stmts);
        }
      }

      if (tickets.length > 0) {
        try {
          await db.prepare('ALTER TABLE tickets ADD COLUMN usuario TEXT DEFAULT "DOCENTE"').run();
        } catch (_) {}
        const stmts = tickets.map((t, idx) => {
          const id = t.id || `ticket_imp_${Date.now()}_${idx}`;
          const usuarioVal = String(t.usuario || 'DOCENTE').trim().toUpperCase().includes('ALUMNO') ? 'ALUMNO' : 'DOCENTE';
          return db.prepare(`
            INSERT OR REPLACE INTO tickets (
              id, periodo, fecha, dia, hora_reporte, rango, ambiente, piso, pabellon,
              tipo_solicitud, estado, usuario, descripcion_solucion, responsable, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            id, t.periodo || '2026-2', t.fecha || '', normalizeDay(t.dia || ''),
            t.horaReporte || t.hora_reporte || '', t.rango || '',
            (t.ambiente || '').trim().toUpperCase(), t.piso || '', t.pabellon || '',
            t.tipoSolicitud || t.tipo_solicitud || '', (t.estado || 'ATENDIDO').trim().toUpperCase(),
            usuarioVal, t.descripcionSolucion || t.descripcion_solucion || '', t.responsable || ''
          );
        });
        for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
      }

      if (manualSheets.length > 0) {
        const stmts = manualSheets
          .filter(m => (m.codigo || m.n_hoja))
          .map((m, idx) => {
            const codigo = String(m.codigo || m.n_hoja).toUpperCase().replace(/^LNI-/, 'LN1-');
            return db.prepare(`
              INSERT INTO hojas_manuales (id, periodo, codigo, fecha, nrc, docente, curso, carrera, motivo, asistente, docente_reemplazo, created_at)
              VALUES (?, '2026-2', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
              ON CONFLICT(codigo) DO UPDATE SET
                fecha = excluded.fecha, nrc = excluded.nrc, docente = excluded.docente, curso = excluded.curso,
                carrera = excluded.carrera, motivo = excluded.motivo, asistente = excluded.asistente,
                docente_reemplazo = excluded.docente_reemplazo
            `).bind(
              m.id || `manual_imp_${Date.now()}_${idx}`, codigo, m.fecha || '', m.nrc ? String(m.nrc) : '',
              (m.docente || '').trim().toUpperCase(), (m.curso || '').trim().toUpperCase(), m.carrera || '',
              m.motivo || '', m.asistente || m.observacion || '', (m.docente_reemplazo || m.docenteReemplazo || '').trim().toUpperCase()
            );
          });
        for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
      }

      if (reservas.length > 0) {
        const stmts = reservas.map((r, idx) => db.prepare(`
          INSERT OR REPLACE INTO reservas (id, fecha, mes, dia, inicio, final, aula, ubicacion, docente, detalle, usuario, prioridad, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          r.id || `res_imp_${Date.now()}_${idx}`, r.fecha || '', (r.mes || '').toUpperCase(), normalizeDay(r.dia || ''),
          r.inicio || '', r.final || '', (r.aula || r.ambiente || '').trim().toUpperCase(), r.ubicacion || r.piso_pabellon || '',
          (r.docente || r.responsable || '').toUpperCase(), (r.detalle || r.motivo || '').toUpperCase(),
          (r.usuario || 'OPERACIONES').toUpperCase(), (r.prioridad || 'NORMAL').toUpperCase()
        ));
        for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
      }

      if (ambientes.length > 0) {
        if (clearExisting) {
          await db.prepare('DELETE FROM ambientes').run();
        }
        const chunkSize = 50;
        for (let i = 0; i < ambientes.length; i += chunkSize) {
          const chunk = ambientes.slice(i, i + chunkSize);
          const stmts = chunk.map(amb => {
            return db.prepare(`
              INSERT OR REPLACE INTO ambientes (
                abrv, nombre, pc, aforo, pabellon, piso, ubicacion, tipo
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              (amb.abrv || '').trim().toUpperCase(),
              amb.nombre || '',
              amb.pc ? Number(amb.pc) : 0,
              amb.aforo ? Number(amb.aforo) : 30,
              amb.pabellon || '',
              amb.piso || '',
              amb.ubicacion || '',
              amb.tipo || 'AULA'
            );
          });
          await db.batch(stmts);
        }
      }

      return json({
        success: true,
        message: `Base de datos sincronizada: ${asistencia.length} clases, ${tickets.length} atenciones, ${manualSheets.length} hojas manuales y ${reservas.length} reservas.`,
        data: {
          count: asistencia.length,
          ticketsCount: tickets.length,
          manualCount: manualSheets.length,
          reservasCount: reservas.length
        }
      });
    }

    // -------------------------------------------------------------
    // 6. DASHBOARD: /api/dashboard
    // -------------------------------------------------------------
    if (path === '/api/dashboard' && method === 'GET') {
      const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
      const todayName = days[new Date().getDay()];
      const diaParam = url.searchParams.get('dia');
      const dia = diaParam ? normalizeDay(diaParam) : todayName;

      const { results: classes } = await db.prepare('SELECT puntualidad, asistencia FROM asistencia WHERE dia = ?').bind(dia).all();

      const totalClasses = classes.length;
      let puntual = 0, tarde = 0, falta = 0, reemplazo = 0, pendientes = 0;

      for (const c of classes) {
        const p = (c.puntualidad || '').toUpperCase();
        const a = (c.asistencia || '').toUpperCase();

        if (p === 'PUNTUAL') puntual++;
        else if (p === 'TARDE') tarde++;
        else if (a === 'NO') falta++;
        else if (a.includes('REEMPLAZO')) reemplazo++;
        else pendientes++;
      }

      const totalAsistieron = puntual + tarde + reemplazo;
      const pctAsistencia = totalClasses > 0 ? Math.round((totalAsistieron / totalClasses) * 100) : 0;

      const { results: tickets } = await db.prepare('SELECT estado, tipo_solicitud FROM tickets').all();
      let ticketsPendientes = 0, ticketsEnProceso = 0, ticketsAtendidos = 0;
      const categoryCounts = {};

      for (const t of tickets) {
        const est = (t.estado || '').toUpperCase();
        if (est === 'PENDIENTE') ticketsPendientes++;
        else if (est === 'EN PROCESO') ticketsEnProceso++;
        else if (est === 'ATENDIDO') ticketsAtendidos++;

        const cat = (t.tipo_solicitud || 'Otros').trim() || 'Otros';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }

      return json({
        success: true,
        data: {
          dia,
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
        }
      });
    }

    // -------------------------------------------------------------
    // 7. ALL DATA SNAPSHOT (para sincronización en vivo con OneDrive / Excel): /api/all-data
    // -------------------------------------------------------------
    if (path === '/api/all-data' && method === 'GET') {
      const waitParam = Number(url.searchParams.get('wait') || 0);
      if (waitParam > 0 && waitParam <= 5000) {
        await new Promise(resolve => setTimeout(resolve, waitParam));
      }
      const [asistRes, ticketRes, manualRes, resRes] = await Promise.all([
        db.prepare('SELECT * FROM asistencia ORDER BY hora_inicio_prog ASC, aula ASC').all(),
        db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all(),
        db.prepare(`
          SELECT * FROM hojas_manuales 
          WHERE (docente IS NOT NULL AND docente != '') 
             OR (nrc IS NOT NULL AND nrc != '') 
             OR (curso IS NOT NULL AND curso != '')
          ORDER BY fecha DESC, id DESC
        `).all(),
        db.prepare('SELECT * FROM reservas ORDER BY fecha DESC, inicio ASC').all()
      ]);

      const asistencia = (asistRes.results || []).map(r => ({
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
      }));

      const tickets = (ticketRes.results || []).map(t => ({
        id: t.id,
        periodo: t.periodo,
        fecha: t.fecha,
        dia: t.dia,
        horaReporte: t.hora_reporte,
        rango: t.rango,
        ambiente: t.ambiente,
        piso: t.piso,
        pabellon: t.pabellon,
        tipoSolicitud: t.tipo_solicitud,
        estado: t.estado,
        usuario: t.usuario || (String(t.descripcion_solucion || '').toUpperCase().includes('ALUMNO') ? 'ALUMNO' : 'DOCENTE'),
        descripcionSolucion: t.descripcion_solucion,
        responsable: t.responsable
      }));

      return json({
        success: true,
        updatedAt: new Date().toISOString(),
        data: {
          asistencia,
          tickets,
          manualSheets: manualRes.results || [],
          reservas: resRes.results || []
        }
      });
    }

    // -------------------------------------------------------------
    // 8. LIVE EXCEL FILE ENDPOINT: /api/export-excel
    // Devuelve el archivo CONTROL DOCENTE.xlsx en vivo con el formato, colores y fórmulas originales
    // -------------------------------------------------------------
    if (path === '/api/export-excel' && method === 'GET') {
      const tplUrl = new URL('/CONTROL_DOCENTE.xlsx', request.url);
      const tplRes = env.ASSETS ? await env.ASSETS.fetch(tplUrl) : await fetch(tplUrl);
      if (!tplRes.ok) {
        return json({ error: 'No se pudo cargar la plantilla maestra CONTROL_DOCENTE.xlsx' }, 500);
      }

      const [tplBuffer, asistRes, ticketRes, manualRes, resRes] = await Promise.all([
        tplRes.arrayBuffer(),
        db.prepare('SELECT * FROM asistencia ORDER BY hora_inicio_prog ASC, aula ASC').all(),
        db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all(),
        db.prepare(`
          SELECT * FROM hojas_manuales 
          WHERE (docente IS NOT NULL AND docente != '') 
             OR (nrc IS NOT NULL AND nrc != '') 
             OR (curso IS NOT NULL AND curso != '')
          ORDER BY fecha DESC, id DESC
        `).all(),
        db.prepare('SELECT * FROM reservas ORDER BY fecha DESC, inicio ASC').all()
      ]);

      const asistencia = (asistRes.results || []).map(r => ({
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
      }));

      const tickets = (ticketRes.results || []).map(t => ({
        id: t.id,
        periodo: t.periodo,
        fecha: t.fecha,
        dia: t.dia,
        horaReporte: t.hora_reporte,
        rango: t.rango,
        ambiente: t.ambiente,
        piso: t.piso,
        pabellon: t.pabellon,
        tipoSolicitud: t.tipo_solicitud,
        estado: t.estado,
        usuario: t.usuario || (String(t.descripcion_solucion || '').toUpperCase().includes('ALUMNO') ? 'ALUMNO' : 'DOCENTE'),
        descripcionSolucion: t.descripcion_solucion,
        responsable: t.responsable
      }));

      const outputUint8 = buildMasterExcelFromTemplate(new Uint8Array(tplBuffer), {
        asistencia,
        tickets,
        manualSheets: manualRes.results || [],
        reservas: resRes.results || []
      });

      return new Response(outputUint8, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="CONTROL DOCENTE.xlsx"',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // -------------------------------------------------------------
    // 9. CONEXIÓN DIRECTA MICROSOFT GRAPH ONEDRIVE UPN (/api/onedrive/*)
    // Sincroniza directamente CONTROL DOCENTE - Copia.xlsx / TAY.xlsx en la nube en tiempo real
    // -------------------------------------------------------------
    const TENANT_ID = 'ae544a57-aecb-4bf9-828a-5b520732b110';
    const CLIENT_ID = 'd3590ed6-52b3-4102-aeff-aad2292ab01c';

    if (path.startsWith('/api/onedrive/')) {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS onedrive_auth (
          id TEXT PRIMARY KEY,
          refresh_token TEXT,
          access_token TEXT,
          expires_at INTEGER,
          item_id TEXT,
          file_name TEXT,
          last_web_hash TEXT,
          last_excel_hash TEXT,
          updated_at TEXT
        )
      `).run();
    }

    if (path === '/api/onedrive/status' && method === 'GET') {
      const row = await db.prepare('SELECT item_id, file_name, updated_at, refresh_token FROM onedrive_auth WHERE id = ?').bind('primary').first();
      return json({
        success: true,
        connected: Boolean(row && row.refresh_token),
        fileName: row?.file_name || 'CONTROL DOCENTE - Copia.xlsx',
        itemId: row?.item_id || null,
        updatedAt: row?.updated_at || null
      });
    }

    if (path === '/api/onedrive/device-code' && method === 'POST') {
      const dcRes = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/devicecode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          scope: 'https://graph.microsoft.com/.default offline_access'
        })
      });
      const dcJson = await dcRes.json();
      return json({ success: true, data: dcJson });
    }

    if (path === '/api/onedrive/poll-token' && method === 'POST') {
      const { device_code } = await request.json();
      const tkRes = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          client_id: CLIENT_ID,
          device_code
        })
      });
      const tkJson = await tkRes.json();
      if (!tkRes.ok || !tkJson.access_token) {
        return json({
          success: false,
          pending: tkJson.error === 'authorization_pending',
          error: tkJson.error_description || tkJson.error || 'Esperando autorización'
        });
      }

      let itemId = null;
      let fileName = 'CONTROL DOCENTE - Copia.xlsx';
      try {
        const searchRes = await fetch("https://graph.microsoft.com/v1.0/me/drive/root/search(q='CONTROL DOCENTE')", {
          headers: { Authorization: `Bearer ${tkJson.access_token}` }
        });
        if (searchRes.ok) {
          const sJson = await searchRes.json();
          const match = (sJson.value || []).find(f => String(f.name || '').toUpperCase().includes('COPIA')) || (sJson.value || [])[0];
          if (match) {
            itemId = match.id;
            fileName = match.name;
          }
        }
      } catch (_) {}

      const expiresAt = Date.now() + Number(tkJson.expires_in || 3600) * 1000;
      await db.prepare(`
        INSERT OR REPLACE INTO onedrive_auth (
          id, refresh_token, access_token, expires_at, item_id, file_name, updated_at
        ) VALUES ('primary', ?, ?, ?, ?, ?, datetime('now'))
      `).bind(tkJson.refresh_token || '', tkJson.access_token, expiresAt, itemId || '', fileName).run();

      return json({
        success: true,
        connected: true,
        fileName,
        itemId
      });
    }

    if (path === '/api/onedrive/sync' && method === 'POST') {
      const result = await pushToExcel(db);
      return json(result);
    }

    if (path === '/api/web-sign' && method === 'GET') {
      // Marca barata de "¿la BD cambió?" para el polling de la app y el watcher del Excel local (1 fila leída)
      await ensureTables(db);
      const waitParam = Number(url.searchParams.get('wait') || 0);
      let r = await db.prepare("SELECT v FROM onedrive_state WHERE k = 'last_write_ts'").first();
      // Long-poll opcional (usado por el script de Excel Online): espera y
      // vuelve a leer. Cuesta 2 filas en vez de traer todas las tablas cada 2 s.
      if (waitParam > 0 && waitParam <= 5000) {
        await new Promise((resolve) => setTimeout(resolve, waitParam));
        r = await db.prepare("SELECT v FROM onedrive_state WHERE k = 'last_write_ts'").first();
      }
      return json({ success: true, ts: r ? Number(r.v) : 0 });
    }

    if (path === '/api/onedrive/debug' && method === 'GET') {
      return json(await debugInspect(db));
    }

    if (path === '/api/onedrive/pull' && method === 'POST') {
      const result = await pullIfExcelChanged(db);
      return json(result);
    }

    return json({ error: 'Ruta no encontrada', path }, 404);
  } catch (err) {
    return json({ error: err.message, stack: err.stack }, 500);
  }
}
