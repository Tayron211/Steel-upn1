/**
 * Cloudflare Pages Functions API Handler
 * Handles all /api/* requests 24/7 at the edge with Cloudflare D1 (Serverless SQLite)
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

function normalizeDay(day) {
  if (!day) return '';
  return day.trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

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

      let query = 'SELECT * FROM asistencia WHERE 1=1';
      const params = [];

      if (dia) {
        query += ' AND UPPER(dia) = ?';
        params.push(normalizeDay(dia));
      }
      if (pabellon) {
        query += ' AND (UPPER(piso_pabellon) LIKE ? OR UPPER(aula) LIKE ?)';
        params.push(`%- ${pabellon.toUpperCase()}%`, `${pabellon.toUpperCase()}%`);
      }
      if (piso) {
        const pUpper = piso.toUpperCase();
        if (pUpper.includes('SOT')) {
          query += " AND (UPPER(piso_pabellon) LIKE '%SOTANO%' OR UPPER(piso_pabellon) LIKE '%SÓTANO%')";
        } else {
          query += ' AND UPPER(piso_pabellon) LIKE ?';
          params.push(`%${pUpper}%`);
        }
      }
      if (hora) {
        query += ' AND hora_inicio_prog = ?';
        params.push(hora);
      } else if (horaDesde) {
        query += ' AND hora_inicio_prog >= ?';
        params.push(horaDesde);
      }
      if (search) {
        query += ' AND (LOWER(docente) LIKE ? OR LOWER(curso) LIKE ? OR LOWER(aula) LIKE ? OR nrc LIKE ?)';
        const s = `%${search.toLowerCase()}%`;
        params.push(s, s, s, s);
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
    if (path === '/api/tickets' && method === 'GET') {
      const estado = url.searchParams.get('estado');
      let sql = 'SELECT * FROM tickets WHERE 1=1';
      const params = [];
      if (estado) {
        sql += ' AND estado = ?';
        params.push(estado);
      }
      sql += ' ORDER BY created_at DESC';

      const stmt = db.prepare(sql);
      const { results } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

      const mapped = results.map(t => ({
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
        descripcionSolucion: t.descripcion_solucion,
        responsable: t.responsable
      }));

      return json({ success: true, count: mapped.length, data: mapped });
    }

    if (path === '/api/tickets' && method === 'POST') {
      const body = await request.json();
      const id = `ticket_new_${Date.now()}`;
      const now = new Date();
      const fecha = now.toISOString().split('T')[0];
      const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
      const dia = days[now.getDay()];
      const horaReporte = now.toTimeString().slice(0, 5);

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
        descripcion_solucion: body.descripcionSolucion || '',
        responsable: body.responsable || 'OPERACIONES SEDE'
      };

      await db.prepare(`
        INSERT INTO tickets (id, periodo, fecha, dia, hora_reporte, rango, ambiente, piso, pabellon, tipo_solicitud, estado, descripcion_solucion, responsable, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        ins.id, ins.periodo, ins.fecha, ins.dia, ins.hora_reporte,
        ins.rango, ins.ambiente, ins.piso, ins.pabellon, ins.tipo_solicitud,
        ins.estado, ins.descripcion_solucion, ins.responsable
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
        descripcionSolucion: ins.descripcion_solucion,
        responsable: ins.responsable
      };

      return json({ success: true, data: created });
    }

    const ticketMatch = path.match(/^\/api\/tickets\/([^/]+)$/);
    if (ticketMatch && method === 'PUT') {
      const id = ticketMatch[1];
      const body = await request.json();
      const fields = [];
      const values = [];

      if ('estado' in body) { fields.push('estado = ?'); values.push(body.estado); }
      if ('descripcionSolucion' in body) { fields.push('descripcion_solucion = ?'); values.push(body.descripcionSolucion); }
      if ('responsable' in body) { fields.push('responsable = ?'); values.push(body.responsable); }

      if (fields.length > 0) {
        fields.push("updated_at = datetime('now')");
        values.push(id);
        await db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
      }

      const updated = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
      return json({ success: true, data: updated });
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
      const { results } = await db.prepare('SELECT * FROM ambientes ORDER BY abrv ASC').all();
      return json({ success: true, count: results.length, data: results });
    }

    // -------------------------------------------------------------
    // 4. MANUAL SHEETS: /api/manual-sheets
    // -------------------------------------------------------------
    if (path === '/api/manual-sheets' && method === 'GET') {
      const { results } = await db.prepare(`
        SELECT * FROM hojas_manuales 
        WHERE (docente IS NOT NULL AND docente != '') 
           OR (nrc IS NOT NULL AND nrc != '') 
           OR (curso IS NOT NULL AND curso != '')
        ORDER BY fecha DESC, id DESC
      `).all();
      return json({ success: true, count: results.length, data: results });
    }

    if (path === '/api/manual-sheets' && method === 'POST') {
      const body = await request.json();
      const countRow = await db.prepare('SELECT count(*) as total FROM hojas_manuales').first();
      const nextNum = (countRow ? countRow.total : 0) + 1;
      const codigo = `LN1-${String(nextNum).padStart(3, '0')}`;
      const now = new Date();
      const fecha = now.toISOString().split('T')[0];

      await db.prepare(`
        INSERT INTO hojas_manuales (codigo, fecha, nrc, docente, curso, motivo, asistente, detalle, aula, hora_inicio, hora_fin, firma_docente, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        codigo,
        body.fecha || fecha,
        body.nrc || '',
        body.docente || '',
        body.curso || '',
        body.motivo || 'DOCENTE DE REEMPLAZO',
        body.asistente || 'OPERACIONES',
        body.detalle || '',
        body.aula || '',
        body.hora_inicio || '',
        body.hora_fin || '',
        body.firma_docente || ''
      ).run();

      const created = await db.prepare('SELECT * FROM hojas_manuales WHERE codigo = ?').bind(codigo).first();
      return json({ success: true, data: created });
    }

    // -------------------------------------------------------------
    // 5. RESERVATIONS: /api/reservations
    // -------------------------------------------------------------
    if (path === '/api/reservations' && method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM reservas ORDER BY fecha DESC, hora_inicio ASC').all();
      return json({ success: true, count: results.length, data: results });
    }

    if (path === '/api/reservations' && method === 'POST') {
      const body = await request.json();
      const id = `res_${Date.now()}`;
      await db.prepare(`
        INSERT INTO reservas (id, fecha, dia, hora_inicio, hora_fin, aula, docente, motivo, usuario, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        id,
        body.fecha || '',
        body.dia || '',
        body.hora_inicio || '',
        body.hora_fin || '',
        body.aula || '',
        body.docente || '',
        body.motivo || '',
        body.usuario || 'OPERACIONES'
      ).run();

      const created = await db.prepare('SELECT * FROM reservas WHERE id = ?').bind(id).first();
      return json({ success: true, data: created });
    }

    const reservationMatch = path.match(/^\/api\/reservations\/([^/]+)$/);
    if (reservationMatch && method === 'DELETE') {
      const id = reservationMatch[1];
      await db.prepare('DELETE FROM reservas WHERE id = ?').bind(id).run();
      return json({ success: true, message: 'Reserva eliminada' });
    }

    if (path === '/api/sync-excel') {
      return json({ success: true, message: 'Base de datos Cloudflare D1 activa 24/7 y sincronizada.' });
    }

    // -------------------------------------------------------------
    // 6. DASHBOARD: /api/dashboard
    // -------------------------------------------------------------
    if (path === '/api/dashboard' && method === 'GET') {
      const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
      const todayName = days[new Date().getDay()];
      const diaParam = url.searchParams.get('dia');
      const dia = diaParam ? normalizeDay(diaParam) : todayName;

      const { results: classes } = await db.prepare('SELECT puntualidad, asistencia FROM asistencia WHERE UPPER(dia) = ?').bind(dia).all();

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

    return json({ error: 'Ruta no encontrada', path }, 404);
  } catch (err) {
    return json({ error: err.message, stack: err.stack }, 500);
  }
}
