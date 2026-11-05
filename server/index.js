const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database/sqliteService');
const { exportToExcelBuffer } = require('./services/excelExporter');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- ASISTENCIA ---
app.get('/api/attendance', async (req, res) => {
  try {
    const { dia, pabellon, piso, hora, search } = req.query;
    const list = await db.getAsistencia({ dia, pabellon, piso, hora, search });
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/attendance/:id', async (req, res) => {
  try {
    const updated = await db.updateAsistencia(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/attendance/bulk', async (req, res) => {
  try {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || !updates) {
      return res.status(400).json({ success: false, message: 'Parámetros inválidos' });
    }
    const count = await db.bulkUpdateAsistencia(ids, updates);
    res.json({ success: true, updatedCount: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- TICKETS / ATENCIONES ---
app.get('/api/tickets', async (req, res) => {
  try {
    const { estado, ambiente, responsable, search } = req.query;
    const list = await db.getTickets({ estado, ambiente, responsable, search });
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/tickets', async (req, res) => {
  try {
    const ticket = await db.createTicket(req.body);
    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/tickets/:id', async (req, res) => {
  try {
    const updated = await db.updateTicket(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Ticket no encontrado' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/tickets/:id', async (req, res) => {
  try {
    const success = await db.deleteTicket(req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- HOJAS MANUALES ---
app.get('/api/manual-sheets', async (req, res) => {
  try {
    const { search, fecha } = req.query;
    const list = await db.getManualSheets({ search, fecha });
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/manual-sheets', async (req, res) => {
  try {
    const item = await db.createManualSheet(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- RESERVAS ---
app.get('/api/reservations', async (req, res) => {
  try {
    const { dia, aula, fecha, search } = req.query;
    const list = await db.getReservas({ dia, aula, fecha, search });
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/reservations', async (req, res) => {
  try {
    const item = await db.createReserva(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/reservations/:id', async (req, res) => {
  try {
    const success = await db.deleteReserva(req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- AMBIENTES ---
app.get('/api/rooms', async (req, res) => {
  try {
    const list = await db.getAmbientes();
    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- DASHBOARD ---
app.get('/api/dashboard', async (req, res) => {
  try {
    const stats = await db.getDashboardStats(req.query.dia);
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// --- EXPORT TO EXCEL ---
app.get('/api/export-excel', async (req, res) => {
  try {
    const exportData = await db.getAllDataForExport();
    const buffer = exportToExcelBuffer(exportData);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="CONTROL_DOCENTE_EXPORTADO.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error('Error exportando Excel:', err);
    res.status(500).json({ success: false, message: 'Error generando archivo Excel' });
  }
});

// --- RESET FROM ORIGINAL EXCEL ---
app.post('/api/reset-excel', async (req, res) => {
  try {
    await db.seedFromExcel();
    res.json({ success: true, message: 'Base de datos SQLite sincronizada desde CONTROL DOCENTE.xlsx' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Serve frontend build if present
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexHtml = path.join(distPath, 'index.html');
  if (require('fs').existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    next();
  }
});

// Start DB then server
(async () => {
  try {
    await db.initDatabase();
    app.listen(PORT, () => {
      console.log(`[SERVER] API con SQLite activa en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Error iniciando el servidor:', err);
  }
})();
