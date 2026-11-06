/**
 * Cloudflare Pages Functions API Handler
 * Handles all /api/* requests 24/7 at the edge with Cloudflare D1 (Serverless SQLite)
 */
import { buildMasterExcelFromTemplate } from '../../src/utils/excelTemplateExporter';

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
      const nrc = url.searchParams.get('nrc');

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
        query += ' AND (LOWER(docente) LIKE ? OR LOWER(curso) LIKE ? OR LOWER(aula) LIKE ? OR CAST(nrc AS TEXT) LIKE ?)';
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
    if (path.startsWith('/api/tickets')) {
      try { await db.prepare('ALTER TABLE tickets ADD COLUMN firma_entrega TEXT').run(); } catch (e) {}
      try { await db.prepare('ALTER TABLE tickets ADD COLUMN firma_recepcion TEXT').run(); } catch (e) {}
      try { await db.prepare('ALTER TABLE tickets ADD COLUMN entregado_por TEXT').run(); } catch (e) {}
      try { await db.prepare('ALTER TABLE tickets ADD COLUMN recibido_por TEXT').run(); } catch (e) {}
      try { await db.prepare('ALTER TABLE tickets ADD COLUMN fecha_firma TEXT').run(); } catch (e) {}
      try { await db.prepare('ALTER TABLE tickets ADD COLUMN firma_devolucion TEXT').run(); } catch (e) {}
      try { await db.prepare('ALTER TABLE tickets ADD COLUMN fecha_devolucion TEXT').run(); } catch (e) {}
    }

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
        responsable: t.responsable,
        firmaEntrega: t.firma_entrega || null,
        firmaRecepcion: t.firma_recepcion || null,
        firmaDevolucion: t.firma_devolucion || null,
        entregadoPor: t.entregado_por || null,
        recibidoPor: t.recibido_por || null,
        fechaFirma: t.fecha_firma || null,
        fechaDevolucion: t.fecha_devolucion || null
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
          tipo_solicitud, estado, descripcion_solucion, responsable,
          firma_entrega, firma_recepcion, entregado_por, recibido_por, fecha_firma,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        ins.id, ins.periodo, ins.fecha, ins.dia, ins.hora_reporte,
        ins.rango, ins.ambiente, ins.piso, ins.pabellon, ins.tipo_solicitud,
        ins.estado, ins.descripcion_solucion, ins.responsable,
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

    const ticketMatch = path.match(/^\/api\/tickets\/([^/]+)$/);
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
      // Siguiente código según el mayor LN1-XXX existente (evita duplicados)
      const { results: codes } = await db.prepare('SELECT codigo FROM hojas_manuales').all();
      const maxNum = codes.reduce((max, r) => {
        const m = String(r.codigo || '').match(/LN\d*-(\d+)/i);
        const n = m ? parseInt(m[1], 10) : 0;
        return n > max ? n : max;
      }, 0);
      const codigo = `LN1-${String(maxNum + 1).padStart(3, '0')}`;
      const id = `manual_new_${Date.now()}`;
      const fecha = new Date().toISOString().split('T')[0];

      await db.prepare(`
        INSERT INTO hojas_manuales (id, periodo, codigo, fecha, nrc, docente, curso, carrera, motivo, asistente, detalle, aula, hora_inicio, hora_fin, firma_docente, docente_reemplazo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        id,
        body.periodo || '2026-2',
        codigo,
        body.fecha || fecha,
        body.nrc ? String(body.nrc) : '',
        body.docente || '',
        body.curso || '',
        body.carrera || '',
        body.motivo || 'DOCENTE SIN ACCESOS',
        body.asistente || 'OPERACIONES',
        body.detalle || '',
        body.aula || '',
        body.hora_inicio || '',
        body.hora_fin || '',
        body.firma_docente || '',
        body.docenteReemplazo || ''
      ).run();

      const created = await db.prepare('SELECT * FROM hojas_manuales WHERE id = ?').bind(id).first();
      return json({ success: true, data: created });
    }

    // -------------------------------------------------------------
    // 5. RESERVATIONS: /api/reservations
    // -------------------------------------------------------------
    if (path === '/api/reservations' && method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM reservas ORDER BY fecha DESC, inicio ASC').all();
      return json({ success: true, count: results.length, data: results });
    }

    if (path === '/api/reservations' && method === 'POST') {
      const body = await request.json();
      const id = `res_${Date.now()}`;
      const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
      const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
      const fechaStr = body.fecha || new Date().toISOString().split('T')[0];
      const dt = new Date(fechaStr + 'T12:00:00');
      const mes = body.mes || months[dt.getMonth()] || 'NOVIEMBRE';
      const dia = body.dia || days[dt.getDay()] || 'LUNES';
      const inicio = body.inicio || body.hora_inicio || body.horaInicio || '08:00';
      const final = body.final || body.hora_fin || body.horaFin || '10:00';
      const aula = (body.aula || '').toUpperCase();
      const ubicacion = body.ubicacion || '';
      const docente = body.docente || '';
      const detalle = body.detalle || body.motivo || body.actividades || 'RESERVA DE AULA';
      const usuario = body.usuario || 'OPERACIONES';
      const prioridad = body.prioridad || 'NORMAL';

      await db.prepare(`
        INSERT INTO reservas (id, fecha, mes, dia, inicio, final, aula, ubicacion, docente, detalle, usuario, prioridad, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
        usuario,
        prioridad
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
      return json({ 
        success: true, 
        message: 'Base de datos Cloudflare D1 activa 24/7 y sincronizada.',
        data: { message: 'Base de datos Cloudflare D1 activa 24/7 y sincronizada.' }
      });
    }

    // -------------------------------------------------------------
    // IMPORTACIÓN MASIVA DE EXCEL A CLOUDFLARE D1
    // -------------------------------------------------------------
    if (path === '/api/import-excel-data' && method === 'POST') {
      const body = await request.json();
      const { asistencia = [], ambientes = [], clearExisting = true } = body;

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
        message: `Base de datos actualizada con éxito: ${asistencia.length} clases y ${ambientes.length} ambientes sincronizados.`,
        data: { count: asistencia.length }
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

    // -------------------------------------------------------------
    // 7. ALL DATA SNAPSHOT (para sincronización en vivo con OneDrive / Excel): /api/all-data
    // -------------------------------------------------------------
    if (path === '/api/all-data' && method === 'GET') {
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

    return json({ error: 'Ruta no encontrada', path }, 404);
  } catch (err) {
    return json({ error: err.message, stack: err.stack }, 500);
  }
}
