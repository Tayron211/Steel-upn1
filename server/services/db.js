const fs = require('fs');
const path = require('path');
const { importExcelData } = require('./excelImporter');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const EXCEL_PATH = path.join(__dirname, '..', '..', 'CONTROL DOCENTE.xlsx');

function normalizeDay(str) {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

class Database {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(STORE_PATH)) {
      try {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        this.data = JSON.parse(raw);
        console.log('[DB] Base de datos cargada desde store.json');
        return;
      } catch (err) {
        console.error('[DB] Error al leer store.json, re-importando de Excel...', err);
      }
    }

    // Import from original excel safely
    console.log('[DB] Inicializando datos desde CONTROL DOCENTE.xlsx...');
    this.data = importExcelData(EXCEL_PATH);
    this.save();
    console.log(`[DB] Importación completa: ${this.data.asistencia.length} clases, ${this.data.tickets.length} tickets.`);
  }

  save() {
    try {
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Error guardando store.json:', err);
    }
  }

  // --- ASISTENCIA ---
  getAsistencia({ dia, pabellon, piso, search, hora }) {
    let list = this.data.asistencia;

    if (dia) {
      const dNorm = normalizeDay(dia);
      list = list.filter(item => normalizeDay(item.dia) === dNorm);
    }

    if (pabellon) {
      list = list.filter(item => {
        const pb = item.pisoPabellon.toUpperCase();
        return pb.includes(`- ${pabellon.toUpperCase()}`) || pb.includes(`PABELLÓN ${pabellon.toUpperCase()}`);
      });
    }

    if (piso) {
      const pUpper = piso.toUpperCase().trim();
      list = list.filter(item => item.pisoPabellon.toUpperCase().includes(pUpper));
    }

    if (hora) {
      list = list.filter(item => item.horaInicioProg === hora);
    }

    if (search) {
      const s = search.toLowerCase().trim();
      list = list.filter(item =>
        item.docente.toLowerCase().includes(s) ||
        item.curso.toLowerCase().includes(s) ||
        item.aula.toLowerCase().includes(s) ||
        item.nrc.toLowerCase().includes(s) ||
        item.codigoDocente.toLowerCase().includes(s)
      );
    }

    return list;
  }

  updateAsistencia(id, updates) {
    const idx = this.data.asistencia.findIndex(a => a.id === id);
    if (idx === -1) return null;

    this.data.asistencia[idx] = {
      ...this.data.asistencia[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.data.asistencia[idx];
  }

  bulkUpdateAsistencia(ids, updates) {
    let updatedCount = 0;
    const set = new Set(ids);
    this.data.asistencia = this.data.asistencia.map(item => {
      if (set.has(item.id)) {
        updatedCount++;
        return {
          ...item,
          ...updates,
          updatedAt: new Date().toISOString()
        };
      }
      return item;
    });
    this.save();
    return updatedCount;
  }

  // --- TICKETS / ATENCIONES ---
  getTickets({ estado, ambiente, responsable, search }) {
    let list = this.data.tickets;

    if (estado) {
      list = list.filter(t => t.estado === estado.toUpperCase().trim());
    }

    if (ambiente) {
      list = list.filter(t => t.ambiente.toUpperCase().includes(ambiente.toUpperCase().trim()));
    }

    if (responsable) {
      list = list.filter(t => t.responsable.toUpperCase().includes(responsable.toUpperCase().trim()));
    }

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(t =>
        t.ambiente.toLowerCase().includes(s) ||
        t.tipoSolicitud.toLowerCase().includes(s) ||
        t.descripcionSolucion.toLowerCase().includes(s) ||
        t.responsable.toLowerCase().includes(s)
      );
    }

    return list;
  }

  createTicket(ticket) {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timeNow = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const dateNow = now.toISOString().split('T')[0];

    // Determine Day in Spanish
    const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const diaNow = days[now.getDay()];

    const newTicket = {
      id: `ticket_new_${Date.now()}`,
      periodo: '2026-2',
      fecha: ticket.fecha || dateNow,
      dia: ticket.dia || diaNow,
      horaReporte: ticket.horaReporte || timeNow,
      rango: ticket.rango || `${pad(now.getHours())}:00 – ${pad((now.getHours() + 1) % 24)}:00`,
      ambiente: (ticket.ambiente || '').toUpperCase().trim(),
      piso: ticket.piso || '',
      pabellon: ticket.pabellon || (ticket.ambiente && ticket.ambiente.startsWith('B') ? 'B' : 'A'),
      tipoSolicitud: ticket.tipoSolicitud || 'General',
      estado: (ticket.estado || 'PENDIENTE').toUpperCase(),
      descripcionSolucion: ticket.descripcionSolucion || '',
      responsable: ticket.responsable || 'Sin Asignar',
      createdAt: now.toISOString()
    };

    this.data.tickets.unshift(newTicket);
    this.save();
    return newTicket;
  }

  updateTicket(id, updates) {
    const idx = this.data.tickets.findIndex(t => t.id === id);
    if (idx === -1) return null;

    this.data.tickets[idx] = {
      ...this.data.tickets[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.data.tickets[idx];
  }

  deleteTicket(id) {
    const idx = this.data.tickets.findIndex(t => t.id === id);
    if (idx === -1) return false;
    this.data.tickets.splice(idx, 1);
    this.save();
    return true;
  }

  // --- HOJAS DE ASISTENCIA MANUAL ---
  getManualSheets({ search, fecha }) {
    let list = this.data.manualSheets;
    if (fecha) {
      list = list.filter(m => m.fecha === fecha);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(m =>
        m.codigo.toLowerCase().includes(s) ||
        m.docente.toLowerCase().includes(s) ||
        m.curso.toLowerCase().includes(s) ||
        m.nrc.toLowerCase().includes(s)
      );
    }
    return list;
  }

  createManualSheet(item) {
    const now = new Date();
    const dateNow = now.toISOString().split('T')[0];

    // Compute next code LN1-XXX
    const existingNums = this.data.manualSheets
      .map(m => {
        const match = m.codigo.match(/LN\d*-(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 0) + 1;
    const autoCode = `LN1-${String(nextNum).padStart(3, '0')}`;

    const newSheet = {
      id: `manual_new_${Date.now()}`,
      periodo: '2026-2',
      codigo: item.codigo || autoCode,
      fecha: item.fecha || dateNow,
      nrc: item.nrc || '',
      docente: item.docente || '',
      curso: item.curso || '',
      carrera: item.carrera || '',
      motivo: item.motivo || 'DOCENTE SIN ACCESOS',
      asistente: item.asistente || 'Operador',
      createdAt: now.toISOString()
    };

    this.data.manualSheets.unshift(newSheet);
    this.save();
    return newSheet;
  }

  // --- RESERVAS ---
  getReservas({ dia, aula, fecha, search }) {
    let list = this.data.reservas;
    if (dia) list = list.filter(r => normalizeDay(r.dia) === normalizeDay(dia));
    if (aula) list = list.filter(r => r.aula.toUpperCase().includes(aula.toUpperCase()));
    if (fecha) list = list.filter(r => r.fecha === fecha);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(r =>
        r.aula.toLowerCase().includes(s) ||
        r.docente.toLowerCase().includes(s) ||
        r.detalle.toLowerCase().includes(s) ||
        r.usuario.toLowerCase().includes(s)
      );
    }
    return list;
  }

  createReserva(item) {
    const newRes = {
      id: `reserva_new_${Date.now()}`,
      fecha: item.fecha || new Date().toISOString().split('T')[0],
      mes: item.mes || '',
      dia: (item.dia || '').toUpperCase(),
      inicio: item.inicio || '08:00',
      final: item.final || '10:00',
      aula: (item.aula || '').toUpperCase(),
      ubicacion: item.ubicacion || '',
      docente: item.docente || '',
      detalle: item.detalle || '',
      usuario: item.usuario || 'Operador',
      prioridad: (item.prioridad || 'NORMAL').toUpperCase(),
      createdAt: new Date().toISOString()
    };

    this.data.reservas.unshift(newRes);
    this.save();
    return newRes;
  }

  deleteReserva(id) {
    const idx = this.data.reservas.findIndex(r => r.id === id);
    if (idx === -1) return false;
    this.data.reservas.splice(idx, 1);
    this.save();
    return true;
  }

  // --- AMBIENTES ---
  getAmbientes() {
    return this.data.ambientes;
  }

  // --- CATALOGO ---
  getCatalogo() {
    return this.data.catalogo;
  }

  // --- DASHBOARD STATS ---
  getDashboardStats(diaParam) {
    const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    const todayName = days[new Date().getDay()];
    const diaNorm = normalizeDay(diaParam || todayName);

    // Classes for selected day
    const dayClasses = this.data.asistencia.filter(c => normalizeDay(c.dia) === diaNorm);
    const totalClasses = dayClasses.length;
    const puntual = dayClasses.filter(c => c.puntualidad === 'PUNTUAL').length;
    const tarde = dayClasses.filter(c => c.puntualidad === 'TARDE').length;
    const falta = dayClasses.filter(c => c.asistencia === 'NO').length;
    const reemplazo = dayClasses.filter(c => c.asistencia.includes('REEMPLAZO')).length;
    const pendientes = dayClasses.filter(c => c.asistencia === 'PENDIENTE' || (!c.asistencia && !c.puntualidad)).length;

    const asistieronTotal = puntual + tarde + reemplazo;
    const pctAsistencia = totalClasses > 0 ? Math.round((asistieronTotal / totalClasses) * 100) : 0;

    // Tickets summary
    const tickets = this.data.tickets;
    const ticketsPendientes = tickets.filter(t => t.estado === 'PENDIENTE').length;
    const ticketsEnProceso = tickets.filter(t => t.estado === 'EN PROCESO').length;
    const ticketsAtendidos = tickets.filter(t => t.estado === 'ATENDIDO').length;

    // Tickets by Category
    const categoryCounts = {};
    tickets.forEach(t => {
      const cat = t.tipoSolicitud || 'Otros';
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

  // Reload fresh from original excel
  resetFromExcel() {
    this.data = importExcelData(EXCEL_PATH);
    this.save();
    return true;
  }
}

const db = new Database();
module.exports = db;
