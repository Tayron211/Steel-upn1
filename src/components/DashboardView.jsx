import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { buildMasterExcelFromTemplate } from '../utils/excelTemplateExporter';
import { createDbChangeGate } from '../utils/webSignGate';
import OneDriveSyncModal from './OneDriveSyncModal';
import {
  linkOneDriveExcelFile,
  reauthorizeSavedExcel,
  subscribeLiveExcelStatus,
  getLiveExcelState,
  syncAllDataToLinkedExcel,
  clearSavedFileHandle
} from '../utils/liveExcelSync';
import {
  LayoutDashboard,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Wrench,
  Flame,
  Award,
  Calendar,
  Download,
  RotateCw,
  Database,
  FileSpreadsheet,
  Upload,
  ChevronDown,
  Cloud
} from 'lucide-react';

function formatExcelTime(val) {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') {
    const frac = val < 1 ? val : val - Math.floor(val);
    const totalMinutes = Math.round(frac * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
  return String(val);
}

function formatExcelDate(val) {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' && val > 20000) {
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }
  return String(val);
}

export default function DashboardView() {
  const daysOfWeek = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const todayDefault = daysOfWeek[new Date().getDay()];

  const [selectedDia, setSelectedDia] = useState(todayDefault);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [liveExcel, setLiveExcel] = useState(() => getLiveExcelState());
  const [showOneDriveModal, setShowOneDriveModal] = useState(false);

  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    return subscribeLiveExcelStatus((nextState) => {
      setLiveExcel((prev) => ({ ...prev, ...nextState }));
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?dia=${selectedDia}`);
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const dbChanged = useMemo(() => createDbChangeGate(), []);

  // Silent background refresh for multi-user real-time state
  const silentRefreshStats = async () => {
    try {
      if (!(await dbChanged())) return; // sin escrituras nuevas -> no gastar lecturas de D1
      const res = await fetch(`/api/dashboard?dia=${selectedDia}`);
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      // silent
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(silentRefreshStats, 5000);
    return () => clearInterval(interval);
  }, [selectedDia]);

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/sync-excel', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSyncMessage(json.data?.message || json.message || 'Sincronización completada exitosamente.');
        silentRefreshStats();
        setTimeout(() => setSyncMessage(''), 5000);
      }
    } catch (err) {
      console.error(err);
      setSyncMessage('Error al sincronizar con el archivo Excel.');
    } finally {
      setSyncing(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    setImporting(true);
    setSyncMessage('Leyendo archivo Excel...');

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      const sheetNames = wb.SheetNames;
      const asistSheetName = sheetNames.find(n => 
        n.toUpperCase().includes('ASISTENCIA') || n.toUpperCase().includes('CLASES') || n.toUpperCase().includes('CONTROL')
      ) || sheetNames[0];

      const sheetAsist = wb.Sheets[asistSheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheetAsist, { header: 1 });

      if (rawRows.length < 2) {
        alert('El archivo Excel seleccionado no contiene filas de datos válidas.');
        setImporting(false);
        setSyncMessage('');
        return;
      }

      let headerIdx = 0;
      let headers = rawRows[0].map(h => String(h || '').toUpperCase().trim());
      if (!headers.some(h => h.includes('DOCENTE') || h.includes('AULA') || h.includes('NRC'))) {
        if (rawRows[1] && rawRows[1].some(h => String(h || '').toUpperCase().includes('DOCENTE') || String(h || '').toUpperCase().includes('AULA'))) {
          headerIdx = 1;
          headers = rawRows[1].map(h => String(h || '').toUpperCase().trim());
        }
      }

      const findCol = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));

      const colPisoPab = findCol(['PABELLON/PISO', 'PABELLÓN/PISO', 'PISO', 'PABELLON', 'PABELLÓN']);
      const colSede = findCol(['SEDE', 'CAMPUS']);
      const colPeriodo = findCol(['PERIODO', 'CICLO']);
      const colDia = findCol(['DIA', 'DÍA']);
      const colInicioProg = findCol(['INICIO PROG', 'HORA INICIO', 'INICIO']);
      const colFinProg = findCol(['FINAL PROG', 'HORA FIN', 'FIN PROG', 'FINAL']);
      const colAula = findCol(['AULA', 'AMBIENTE']);
      const colNrc = findCol(['NRC', 'CODIGO CLASE', 'CÓDIGO CLASE']);
      const colCruzada = findCol(['CRUZADA', 'LISTA CRUZADA']);
      const colCodDocente = findCol(['CODIGO DOCENTE', 'CÓDIGO DOCENTE', 'COD DOCENTE', 'DNI']);
      const colDocente = findCol(['DOCENTE', 'PROFESOR']);
      const colCurso = findCol(['CURSO', 'ASIGNATURA']);
      const colCarrera = findCol(['CARRERA', 'PROGRAMA']);
      const colAsistencia = findCol(['ASISTENCIA']);
      const colPuntualidad = findCol(['PUNTUALIDAD']);
      const colObs = findCol(['OBSERVACION', 'OBSERVACIONES']);

      const parsedClasses = [];
      for (let r = headerIdx + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const aula = colAula >= 0 && row[colAula] ? String(row[colAula]).trim().toUpperCase() : (row[6] ? String(row[6]).trim().toUpperCase() : '');
        const docente = colDocente >= 0 && row[colDocente] ? String(row[colDocente]).trim().toUpperCase() : (row[10] ? String(row[10]).trim().toUpperCase() : '');
        const nrc = colNrc >= 0 && row[colNrc] ? String(row[colNrc]).trim() : (row[7] ? String(row[7]).trim() : '');

        if (!aula && !docente && !nrc) continue;

        const diaVal = colDia >= 0 && row[colDia] ? String(row[colDia]).trim().toUpperCase() : (row[3] ? String(row[3]).trim().toUpperCase() : '');
        const horaIniVal = colInicioProg >= 0 ? formatExcelTime(row[colInicioProg]) : formatExcelTime(row[4]);
        const horaFinVal = colFinProg >= 0 ? formatExcelTime(row[colFinProg]) : formatExcelTime(row[5]);

        parsedClasses.push({
          id: `asist_imp_${r}`,
          pisoPabellon: colPisoPab >= 0 && row[colPisoPab] ? String(row[colPisoPab]).trim() : (row[0] ? String(row[0]).trim() : ''),
          sede: colSede >= 0 && row[colSede] ? String(row[colSede]).trim() : 'Comas',
          periodo: colPeriodo >= 0 && row[colPeriodo] ? String(row[colPeriodo]).trim() : '2026-2',
          dia: diaVal,
          horaInicioProg: horaIniVal,
          horaFinalProg: horaFinVal,
          aula,
          nrc,
          listaCruzada: colCruzada >= 0 && row[colCruzada] ? String(row[colCruzada]).trim() : '',
          codigoDocente: colCodDocente >= 0 && row[colCodDocente] ? String(row[colCodDocente]).trim() : '',
          docente,
          curso: colCurso >= 0 && row[colCurso] ? String(row[colCurso]).trim().toUpperCase() : (row[11] ? String(row[11]).trim().toUpperCase() : ''),
          carrera: colCarrera >= 0 && row[colCarrera] ? String(row[colCarrera]).trim() : '',
          asistencia: colAsistencia >= 0 && row[colAsistencia] ? String(row[colAsistencia]).trim().toUpperCase() : 'PENDIENTE',
          puntualidad: colPuntualidad >= 0 && row[colPuntualidad] ? String(row[colPuntualidad]).trim().toUpperCase() : '-',
          observacion: colObs >= 0 && row[colObs] ? String(row[colObs]).trim() : '',
          real: null,
          ciclo: ''
        });
      }

      // Sheet de Atenciones (ATENCIONES 2026-2 y ATENCIONES 2026-1)
      const parsedTickets = [];
      const atenSheets = sheetNames.filter(n => n.toUpperCase().includes('ATENCION'));
      for (const atenName of atenSheets) {
        const is20261 = atenName.includes('2026-1');
        const defaultPeriodo = is20261 ? '2026-1' : '2026-2';
        const atenRows = XLSX.utils.sheet_to_json(wb.Sheets[atenName], { header: 1 });
        for (let r = 1; r < atenRows.length; r++) {
          const row = atenRows[r];
          if (!row || (!row[4] && !row[7] && !row[10])) continue;
          const headerCheck = String(row[0] || '').toUpperCase();
          if (headerCheck.includes('PERIODO') || String(row[4] || '').toUpperCase() === 'AMBIENTE') continue;
          parsedTickets.push({
            id: `ticket_${is20261 ? '1' : '2'}_${r}`,
            periodo: row[0] ? String(row[0]).trim() : defaultPeriodo,
            fecha: formatExcelDate(row[1]),
            dia: row[2] ? String(row[2]).trim().toUpperCase() : '',
            horaReporte: formatExcelTime(row[3]),
            ambiente: row[4] ? String(row[4]).trim().toUpperCase() : '',
            piso: row[5] !== undefined && row[5] !== null ? String(row[5]).trim() : '',
            pabellon: row[6] ? String(row[6]).trim().toUpperCase() : '',
            tipoSolicitud: row[7] ? String(row[7]).trim().toUpperCase() : 'ASISTENCIA TÉCNICA',
            estado: row[8] ? String(row[8]).trim().toUpperCase() : 'ATENDIDO',
            usuario: row[9] ? (String(row[9]).toUpperCase().includes('ALUMNO') ? 'ALUMNO' : 'DOCENTE') : 'DOCENTE',
            descripcionSolucion: row[10] !== undefined ? String(row[10] || '').trim() : (row[9] ? String(row[9]).trim() : ''),
            responsable: row[11] !== undefined ? String(row[11] || '').trim() : (row[10] ? String(row[10]).trim() : '')
          });
        }
      }

      // Sheet de Hojas Manuales (HOJA DE ASISTENCIA 2026-2)
      const parsedManualSheets = [];
      const manualSheetName = sheetNames.find(n => n.toUpperCase().includes('HOJA DE ASISTENCIA 2026-2')) ||
                              sheetNames.find(n => n.toUpperCase().includes('HOJA DE ASISTENCIA'));
      if (manualSheetName && wb.Sheets[manualSheetName]) {
        const manRows = XLSX.utils.sheet_to_json(wb.Sheets[manualSheetName], { header: 1 });
        for (let r = 1; r < manRows.length; r++) {
          const row = manRows[r];
          if (!row) continue;
          const nHoja = row[0] ? String(row[0]).trim().toUpperCase() : '';
          if (nHoja.includes('HOJA') || String(row[4] || '').toUpperCase().includes('NOMBRE')) continue;
          const docente = row[5] ? String(row[5]).trim().toUpperCase() : '';
          const nrc = row[3] ? String(row[3]).trim() : '';
          const curso = row[6] ? String(row[6]).trim().toUpperCase() : '';
          const docReemp = row[8] ? String(row[8]).trim().toUpperCase() : '';
          if (!docente && !nrc && !curso && !docReemp) continue;
          parsedManualSheets.push({
            id: `manual_2_${r}`,
            n_hoja: nHoja.replace(/^LNI-/i, 'LN1-'),
            fecha: formatExcelDate(row[1]),
            aula: row[2] ? String(row[2]).trim().toUpperCase() : '',
            nrc,
            codigo_docente: row[4] ? String(row[4]).trim() : '',
            docente,
            curso,
            observacion: row[7] ? String(row[7]).trim() : '',
            docente_reemplazo: docReemp,
            motivo: docReemp ? 'REEMPLAZO DOCENTE' : 'CLASE REGULAR',
            estado_hoja: 'REGISTRADO'
          });
        }
      }

      // Sheet de Reservas (RESERVAS)
      const parsedReservas = [];
      const resSheetName = sheetNames.find(n => n.toUpperCase().includes('RESERVA'));
      if (resSheetName && wb.Sheets[resSheetName]) {
        const resRows = XLSX.utils.sheet_to_json(wb.Sheets[resSheetName], { header: 1 });
        for (let r = 1; r < resRows.length; r++) {
          const row = resRows[r];
          if (!row || (!row[0] && !row[5])) continue;
          if (String(row[0] || '').toUpperCase().includes('RESPONSABLE')) continue;
          parsedReservas.push({
            id: `res_imp_${r}`,
            responsable: row[0] ? String(row[0]).trim() : '',
            fecha: formatExcelDate(row[1]),
            dia: row[2] ? String(row[2]).trim().toUpperCase() : '',
            inicio: formatExcelTime(row[3]),
            final: formatExcelTime(row[4]),
            ambiente: row[5] ? String(row[5]).trim().toUpperCase() : '',
            piso_pabellon: row[6] ? String(row[6]).trim() : '',
            motivo: row[7] ? String(row[7]).trim() : '',
            soporte: row[8] ? String(row[8]).trim() : ''
          });
        }
      }

      // Sheet de Ambientes si está presente
      const ambSheetName = sheetNames.find(n => 
        n.toUpperCase().includes('UBICACION') || n.toUpperCase().includes('AMBIENTES') || n.toUpperCase().includes('AULAS')
      );
      const parsedAmbientes = [];
      if (ambSheetName && wb.Sheets[ambSheetName]) {
        const ambRows = XLSX.utils.sheet_to_json(wb.Sheets[ambSheetName], { header: 1 });
        for (let r = 1; r < ambRows.length; r++) {
          const row = ambRows[r];
          if (!row || !row[3]) continue;
          parsedAmbientes.push({
            abrv: String(row[3]).trim().toUpperCase(),
            nombre: row[1] ? String(row[1]).trim() : '',
            tipo: row[2] ? String(row[2]).trim().toUpperCase() : 'AULA',
            aforo: row[4] ? Number(row[4]) : 30,
            pabellon: row[5] ? String(row[5]).trim().toUpperCase() : '',
            piso: row[6] ? String(row[6]).trim().toUpperCase() : '',
            ubicacion: row[7] ? String(row[7]).trim() : ''
          });
        }
      }

      if (parsedClasses.length === 0) {
        alert('No se pudieron extraer clases válidas del archivo Excel. Asegúrate de que las columnas tengan nombres estándar (NRC, DOCENTE, AULA, DIA, INICIO).');
        setImporting(false);
        setSyncMessage('');
        return;
      }

      const confirmImport = window.confirm(
        `Se encontraron en "${file.name}":\n• ${parsedClasses.length} clases programadas\n• ${parsedTickets.length} atenciones\n• ${parsedManualSheets.length} hojas de asistencia\n• ${parsedReservas.length} reservas${parsedAmbientes.length > 0 ? `\n• ${parsedAmbientes.length} ambientes` : ''}\n\n¿Deseas jalar toda esta data de tu Excel hacia la aplicación?`
      );

      if (!confirmImport) {
        setImporting(false);
        setSyncMessage('');
        return;
      }

      setSyncMessage(`Sincronizando toda la data de "${file.name}"...`);

      const res = await fetch('/api/import-excel-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asistencia: parsedClasses,
          tickets: parsedTickets,
          manualSheets: parsedManualSheets,
          reservas: parsedReservas,
          ambientes: parsedAmbientes,
          clearExisting: true
        })
      });

      const json = await res.json();
      if (json.success) {
        setSyncMessage(`✅ ¡Data jalada con éxito! (${parsedClasses.length} clases, ${parsedTickets.length} atenciones, ${parsedManualSheets.length} hojas manuales)`);
        silentRefreshStats();
        setTimeout(() => setSyncMessage(''), 6000);
      } else {
        alert('Error al importar datos: ' + (json.error || json.message || 'error desconocido'));
        setSyncMessage('');
      }
    } catch (err) {
      console.error('Error importando Excel:', err);
      alert('Error al leer el archivo Excel: ' + err.message);
      setSyncMessage('');
    } finally {
      setImporting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setSyncMessage('Generando CONTROL DOCENTE.xlsx con formato, colores y fórmulas originales...');
      const [tplRes, asistRes, ticketRes, manualRes, resRes] = await Promise.all([
        fetch('/CONTROL_DOCENTE.xlsx'),
        fetch('/api/attendance'),
        fetch('/api/tickets'),
        fetch('/api/manual-sheets'),
        fetch('/api/reservations')
      ]);

      if (!tplRes.ok) {
        throw new Error('No se pudo cargar la plantilla maestra CONTROL_DOCENTE.xlsx');
      }

      const [tplBuffer, asistJson, ticketJson, manualJson, resJson] = await Promise.all([
        tplRes.arrayBuffer(),
        asistRes.json(),
        ticketRes.json(),
        manualRes.json(),
        resRes.json()
      ]);

      const outputUint8 = buildMasterExcelFromTemplate(new Uint8Array(tplBuffer), {
        asistencia: asistJson.data || [],
        tickets: ticketJson.data || [],
        manualSheets: manualJson.data || [],
        reservas: resJson.data || []
      });

      const blob = new Blob([outputUint8], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'CONTROL DOCENTE.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSyncMessage('✅ CONTROL DOCENTE.xlsx exportado con colores, estilos y fórmulas originales.');
      setTimeout(() => setSyncMessage(''), 4500);
    } catch (err) {
      console.error('Error exportando Excel con plantilla:', err);
      window.open('/api/export-excel', '_blank');
      setSyncMessage('');
    }
  };

  if (loading && !stats) {
    return (
      <div className="text-center py-20 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Calculando indicadores clave desde SQLite...</p>
      </div>
    );
  }

  if (!stats) return null;

  const {
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
  } = stats;

  const totalAsistieron = puntual + tarde + reemplazo;

  const sortedCategories = Object.entries(categoryCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);

  return (
    <div className="space-y-4 pb-36 md:pb-12">
      {/* Top Banner - Light Minimalist */}
      <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Analítica & Cumplimiento</span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Dashboard de Rendimiento</h1>
          </div>

          <div className="grid grid-cols-7 gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl w-full sm:w-auto">
            {['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'].map((d) => {
              const isSelected = selectedDia === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDia(d)}
                  className={`px-2 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 text-center flex items-center justify-center active:scale-95 ${isSelected
                      ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs font-black'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  {d === 'MIERCOLES' ? 'MIÉ' : d === 'SABADO' ? 'SÁB' : d === 'DOMINGO' ? 'DOM' : d.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* % Asistencia */}
        <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
          <span className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-tight mb-1">
            % ASISTENCIA DOCENTE
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {pctAsistencia}%
          </div>
          <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 block font-medium">
            {totalAsistieron} de {totalClasses} sesiones
          </span>
        </div>

        {/* Puntuales */}
        <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-4 shadow-xs">
          <span className="block text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-tight mb-1">
            PUNTUALES
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-900 dark:text-emerald-300">
            {puntual}
          </div>
          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 block font-medium">
            A tiempo al inicio de clase
          </span>
        </div>

        {/* Incidencias */}
        <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-4 shadow-xs">
          <span className="block text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-tight mb-1">
            TARDE / FALTA
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-baseline gap-1.5">
            <span className="text-amber-700 dark:text-amber-400">{tarde}</span>
            <span className="text-slate-300 dark:text-zinc-600 font-normal">/</span>
            <span className="text-rose-600 dark:text-rose-400">{falta}</span>
          </div>
          <span className="text-[11px] text-amber-800/80 dark:text-amber-400/80 mt-0.5 block font-medium">
            {reemplazo} con docente suplente
          </span>
        </div>

        {/* Préstamos de Material */}
        <div className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-4 shadow-xs">
          <span className="block text-[10px] font-bold text-amber-900 dark:text-amber-400 uppercase tracking-tight mb-1">
            PRÉSTAMOS DE MATERIAL
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-950 dark:text-amber-300">
            {ticketsPendientes + ticketsEnProceso} <span className="text-xs font-semibold text-amber-800/80 dark:text-amber-400/80">activos</span>
          </div>
          <span className="text-[11px] text-amber-800/80 dark:text-amber-400/80 mt-0.5 block font-medium">
            {ticketsAtendidos} devueltos y archivados
          </span>
        </div>
      </div>

      {/* Progress Breakdown Bar */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">
          Distribución de Estados del Día ({selectedDia})
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3.5">
          Composición de los {totalClasses} bloques de clase programados en la sede.
        </p>

        {totalClasses > 0 ? (
          <div>
            <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800">
              <div style={{ width: `${(puntual / totalClasses) * 100}%` }} className="bg-emerald-500" title={`Puntual: ${puntual}`} />
              <div style={{ width: `${(tarde / totalClasses) * 100}%` }} className="bg-amber-500" title={`Tarde: ${tarde}`} />
              <div style={{ width: `${(reemplazo / totalClasses) * 100}%` }} className="bg-purple-500" title={`Suplente: ${reemplazo}`} />
              <div style={{ width: `${(falta / totalClasses) * 100}%` }} className="bg-rose-500" title={`Falta: ${falta}`} />
              <div style={{ width: `${(pendientes / totalClasses) * 100}%` }} className="bg-slate-300 dark:bg-zinc-700" title={`Pendientes: ${pendientes}`} />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold mt-3.5">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Puntual ({puntual})
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Tarde ({tarde})
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Falta ({falta})
              </span>
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Suplente ({reemplazo})
              </span>
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-zinc-700"></span> Pendientes ({pendientes})
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 dark:text-zinc-500">No hay clases registradas para este día.</p>
        )}
      </div>

      {/* Top Requerimientos y Materiales */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">
          Top Requerimientos y Préstamos en Aula
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
          Frecuencia de materiales (plumones, motas), cables HDMI, periféricos y asistencia en Sede Comas.
        </p>

        <div className="space-y-3">
          {sortedCategories.map(([catName, count], idx) => {
            const maxVal = sortedCategories[0][1] || 1;
            const pct = Math.round((count / maxVal) * 100);
            return (
              <div key={catName}>
                <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  <span className="pr-2 font-semibold text-slate-800 dark:text-zinc-200 break-words leading-tight">{catName}</span>
                  <span className="text-slate-500 dark:text-zinc-400 font-mono text-[11px] shrink-0 font-semibold">{count} préstamos</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-slate-200 dark:border-zinc-800">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${idx === 0 ? 'bg-amber-500' :
                        idx === 1 ? 'bg-blue-500' :
                          idx === 2 ? 'bg-emerald-500' :
                            'bg-slate-400 dark:bg-zinc-600'
                      }`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sincronización & Respaldo de Datos (Desplazado al final del Dashboard) */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Base de Datos SQLite & Excel Maestro
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Sincronización y Exportación
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Sincroniza cambios desde CONTROL DOCENTE.xlsx preservando asistencias o descarga una copia actualizada.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Botón de Sincronización con OneDrive (ubicado al final de Métricas) */}
            <button
              type="button"
              onClick={() => setShowOneDriveModal(true)}
              className={`h-11 px-4 rounded-2xl flex items-center gap-2 text-xs font-black transition-all active:scale-95 border shadow-xs shrink-0 ${
                liveExcel.status === 'syncing'
                  ? 'bg-sky-50 dark:bg-sky-950/70 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
                  : liveExcel.linked
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border-slate-200/80 dark:border-zinc-800 text-slate-800 dark:text-zinc-200'
              }`}
              title="Configurar sincronización en tiempo real con tu Excel de OneDrive"
            >
              <Cloud className="w-4 h-4 stroke-[2.4] text-sky-500 dark:text-sky-400 shrink-0" />
              <span>
                {liveExcel.status === 'syncing'
                  ? 'Guardando Excel...'
                  : liveExcel.linked
                    ? `OneDrive: ${liveExcel.fileName}`
                    : 'Vincular OneDrive'}
              </span>
            </button>

            <div className="relative" ref={dropdownRef}>
              {/* Botón Único Desplegable */}
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="h-11 px-4 rounded-2xl text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition-all active:scale-95 inline-flex items-center justify-center gap-2"
              >
                <Database className="w-4 h-4 stroke-[2.4]" />
                <span>Base de Datos Excel</span>
                <ChevronDown className={`w-4 h-4 stroke-[2.4] transition-transform duration-200 ${isMenuOpen ? '' : 'rotate-180'}`} />
              </button>

            {/* Input archivo oculto para nuevo Excel */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".xlsx, .xls"
              className="hidden"
            />

            {/* Menú Flotante Desplegable Hacia Arriba con las 4 Acciones */}
            {isMenuOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-72 sm:w-80 bg-white dark:bg-[#121216] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-zinc-800 p-2 z-50 animate-spring-up space-y-1">
                {/* 0. Vincular Excel de OneDrive en Tiempo Real */}
                <button
                  type="button"
                  disabled={syncing || importing}
                  onClick={() => {
                    setIsMenuOpen(false);
                    setShowOneDriveModal(true);
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-950/40 text-left transition flex items-start gap-3 group active:scale-98 disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Cloud className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-sky-900 dark:text-sky-300 flex items-center justify-between gap-1">
                      <span className="truncate">
                        {liveExcel.linked
                          ? `OneDrive Activo (${liveExcel.fileName})`
                          : 'OneDrive: CONTROL DOCENTE - Copia.xlsx'}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-black shrink-0 whitespace-nowrap">
                        CONECTADO
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">
                      Abrir o sincronizar en tiempo real con tu archivo CONTROL DOCENTE - Copia.xlsx en OneDrive UPN.
                    </p>
                  </div>
                </button>

                {/* 1. Sincronización */}
                <button
                  type="button"
                  disabled={syncing || importing}
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleManualSync();
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-left transition flex items-start gap-3 group active:scale-98 disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <RotateCw className={`w-4 h-4 stroke-[2.2] ${syncing ? 'animate-spin' : ''}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>Auto-Sync con Excel</span>
                      {syncing && <span className="text-[10px] text-amber-600 font-mono animate-pulse">Sincronizando...</span>}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">
                      Sincroniza con el archivo maestro actual preservando asistencias tomadas.
                    </p>
                  </div>
                </button>

                {/* 2. Importación de nuevo Excel */}
                <button
                  type="button"
                  disabled={syncing || importing}
                  onClick={() => {
                    setIsMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left transition flex items-start gap-3 group active:scale-98 disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Upload className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
                      <span>Importar Nuevo Excel (.xlsx)</span>
                      {importing && <span className="text-[10px] text-emerald-600 font-mono animate-pulse">Cargando...</span>}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">
                      Suministrar nuevo archivo Excel como base de datos para trabajar con nueva data.
                    </p>
                  </div>
                </button>

                {/* 3. Exportar Excel */}
                <button
                  type="button"
                  disabled={syncing || importing}
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleExportExcel();
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-left transition flex items-start gap-3 group active:scale-98 disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Download className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Exportar a Excel (.xlsx)
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">
                      Descargar archivo Excel con la información actualizada de asistencias y atenciones.
                    </p>
                  </div>
                </button>
              </div>
            )}
            </div>
          </div>
        </div>

        {syncMessage && (
          <div className="mt-3 text-xs bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 px-3.5 py-2 rounded-xl font-medium animate-in fade-in">
            {syncMessage}
          </div>
        )}
      </div>

      <OneDriveSyncModal
        isOpen={showOneDriveModal}
        onClose={() => setShowOneDriveModal(false)}
        liveExcel={liveExcel}
        onStatusMessage={(msg) => {
          setSyncMessage(msg);
          setTimeout(() => setSyncMessage(''), 6000);
        }}
      />
    </div>
  );
}
