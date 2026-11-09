import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { buildMasterExcelFromTemplate } from '../utils/excelTemplateExporter';
import { createDbChangeGate } from '../utils/webSignGate';
import { formatCargoNumber } from '../utils/cargoPdfGenerator';
import OneDriveSyncModal from './OneDriveSyncModal';
import { useFadeModal } from '../utils/useFadeModal';
import {
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
  Cloud,
  GraduationCap,
  Package,
  FileText,
  Building2,
  Search,
  Filter,
  Users,
  Check,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  PieChart,
  BarChart3,
  RefreshCw,
  ExternalLink
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
  if (typeof val === 'number' && val > 20000) {
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }
  const s = String(val).trim();
  const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return s;
}

function findHeaderRow(rows, musts) {
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const cells = (rows[r] || []).map(c => 
      String(c ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );
    if (musts.every(m => cells.some(c => c.includes(m)))) {
      return { rowIndex: r, cells };
    }
  }
  return null;
}

function colOf(cells, names) {
  for (const n of names) {
    const normN = n.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let i = cells.findIndex(c => c === normN);
    if (i < 0) i = cells.findIndex(c => c.startsWith(normN));
    if (i < 0) i = cells.findIndex(c => c.includes(normN));
    if (i >= 0) return i;
  }
  return -1;
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

  // Pestañas y Colecciones de Métricas por Apartado
  const [activeSectionTab, setActiveSectionTab] = useState('resumen');
  const [attendanceData, setAttendanceData] = useState([]);
  const [ticketsData, setTicketsData] = useState([]);
  const [manualSheetsData, setManualSheetsData] = useState([]);
  const [reservationsData, setReservationsData] = useState([]);

  // Filtros interactivos para Control Docente
  const [docenteDiaFilter, setDocenteDiaFilter] = useState('TODOS');
  const [docenteStatusFilter, setDocenteStatusFilter] = useState('TODOS');
  const [docentePabellonFilter, setDocentePabellonFilter] = useState('TODOS');
  const [docenteSearch, setDocenteSearch] = useState('');

  // Filtros interactivos para Préstamos de Material
  const [ticketStatusFilter, setTicketStatusFilter] = useState('TODOS');
  const [ticketMaterialFilter, setTicketMaterialFilter] = useState('TODOS');
  const [ticketSearch, setTicketSearch] = useState('');

  // Filtros interactivos para Hojas Manuales
  const [manualFirmaFilter, setManualFirmaFilter] = useState('TODOS');
  const [manualSearch, setManualSearch] = useState('');

  // Filtros interactivos para Reserva de Espacios
  const [reservaPabellonFilter, setReservaPabellonFilter] = useState('TODOS');
  const [reservaSearch, setReservaSearch] = useState('');

  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const excelMenuFade = useFadeModal(isMenuOpen, () => setIsMenuOpen(false), 180);

  useEffect(() => {
    return subscribeLiveExcelStatus((nextState) => {
      setLiveExcel((prev) => ({ ...prev, ...nextState }));
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        excelMenuFade.requestClose(() => setIsMenuOpen(false));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [excelMenuFade]);

  const loadModuleCollections = async () => {
    try {
      const [asistRes, tickRes, manRes, resRes] = await Promise.all([
        fetch('/api/attendance').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/tickets').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/manual-sheets').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/reservations').then(r => r.json()).catch(() => ({ data: [] }))
      ]);

      if (asistRes?.data) setAttendanceData(asistRes.data);
      if (tickRes?.data) setTicketsData(tickRes.data);
      if (manRes?.data) setManualSheetsData(manRes.data);
      if (resRes?.data) setReservationsData(resRes.data);
    } catch (e) {
      console.warn('Error loading module collections:', e);
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const [dashRes] = await Promise.all([
        fetch(`/api/dashboard?dia=${selectedDia}`).then(r => r.json()).catch(() => null),
        loadModuleCollections()
      ]);
      if (dashRes?.success) {
        setStats(dashRes.data);
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
      loadModuleCollections();
    } catch (err) {
      // silent
    }
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(silentRefreshStats, 60000);
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
      const colInicioReal = findCol(['HORA INICIO REAL']);
      const colFinalReal = findCol(['HORA FINAL REAL']);
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
        const horaIniRealVal = colInicioReal >= 0 ? formatExcelTime(row[colInicioReal]) : (row[13] ? formatExcelTime(row[13]) : '');
        const horaFinRealVal = colFinalReal >= 0 ? formatExcelTime(row[colFinalReal]) : (row[14] ? formatExcelTime(row[14]) : '');

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
          horaInicioReal: horaIniRealVal,
          horaFinalReal: horaFinRealVal,
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
        if (!atenRows || atenRows.length === 0) continue;

        const headerInfo = findHeaderRow(atenRows, ['FECHA', 'AMBIENTE']) || {
          rowIndex: 1,
          cells: (atenRows[1] || []).map(c => String(c ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
        };
        const c = headerInfo.cells;
        const iFecha = colOf(c, ['FECHA']);
        const iDia = colOf(c, ['DIA']);
        const iHora = colOf(c, ['HORA DE REPORTE', 'HORA']);
        const iRango = colOf(c, ['RANGO']);
        const iAmbiente = colOf(c, ['AMBIENTE', 'AULA']);
        const iPiso = colOf(c, ['PISO']);
        const iPabellon = colOf(c, ['PABELLON']);
        const iTipo = colOf(c, ['TIPO DE SOLICITUD', 'TIPO']);
        const iEstado = colOf(c, ['ESTADO']);
        const iUsuario = colOf(c, ['USUARIO']);
        const iDesc = colOf(c, ['DESCRIPCION / SOLUCION', 'DESCRIPCION', 'SOLUCION']);
        const iResp = colOf(c, ['RESPONSABLE']);

        for (let r = headerInfo.rowIndex + 1; r < atenRows.length; r++) {
          const row = atenRows[r];
          if (!row) continue;
          const ambVal = iAmbiente >= 0 && row[iAmbiente] ? String(row[iAmbiente]).trim().toUpperCase() : '';
          const tipVal = iTipo >= 0 && row[iTipo] ? String(row[iTipo]).trim().toUpperCase() : '';
          const fecVal = iFecha >= 0 ? formatExcelDate(row[iFecha]) : '';
          if (!ambVal && !tipVal && !fecVal) continue;

          const descVal = iDesc >= 0 && row[iDesc] !== undefined ? String(row[iDesc] || '').trim() : '';
          let usuVal = iUsuario >= 0 && row[iUsuario] ? String(row[iUsuario]).trim().toUpperCase() : '';
          if (!usuVal) {
            usuVal = descVal.toUpperCase().includes('ALUMNO') ? 'ALUMNO' : 'DOCENTE';
          }

          parsedTickets.push({
            id: `ticket_${is20261 ? '1' : '2'}_${r}`,
            periodo: defaultPeriodo,
            fecha: fecVal,
            dia: iDia >= 0 && row[iDia] ? String(row[iDia]).trim().toUpperCase() : '',
            horaReporte: iHora >= 0 ? formatExcelTime(row[iHora]) : '',
            rango: iRango >= 0 && row[iRango] ? String(row[iRango]).trim() : '',
            ambiente: ambVal,
            piso: iPiso >= 0 && row[iPiso] !== undefined ? String(row[iPiso]).trim() : '',
            pabellon: iPabellon >= 0 && row[iPabellon] ? String(row[iPabellon]).trim().toUpperCase() : '',
            tipoSolicitud: tipVal || 'ASISTENCIA TÉCNICA',
            estado: iEstado >= 0 && row[iEstado] ? String(row[iEstado]).trim().toUpperCase() : 'ATENDIDO',
            usuario: usuVal,
            descripcionSolucion: descVal,
            responsable: iResp >= 0 && row[iResp] !== undefined ? String(row[iResp] || '').trim() : ''
          });
        }
      }

      // Sheet de Hojas Manuales (HOJA DE ASISTENCIA 2026-2)
      const parsedManualSheets = [];
      const manualSheetName = sheetNames.find(n => n.toUpperCase().includes('HOJA DE ASISTENCIA 2026-2')) ||
                              sheetNames.find(n => n.toUpperCase().includes('HOJA DE ASISTENCIA'));
      if (manualSheetName && wb.Sheets[manualSheetName]) {
        const manRows = XLSX.utils.sheet_to_json(wb.Sheets[manualSheetName], { header: 1 });
        const headerInfo = findHeaderRow(manRows, ['CODIGO', 'NRC']) || {
          rowIndex: 1,
          cells: (manRows[1] || []).map(c => String(c ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
        };
        const c = headerInfo.cells;
        const iCod = colOf(c, ['CODIGO']);
        const iFec = colOf(c, ['FECHA']);
        const iAula = colOf(c, ['AULA']);
        const iNrc = colOf(c, ['NRC']);
        const iCodDoc = colOf(c, ['CODIGO DE DOCENTE', 'CODIGO']);
        const iDoc = colOf(c, ['DOCENTE']);
        const iCur = colOf(c, ['CURSO']);
        const iCar = colOf(c, ['CARRERA']);
        const iMot = colOf(c, ['MOTIVO']);
        const iAsis = colOf(c, ['ASISTENTE']);
        const iReemp = colOf(c, ['DOCENTE REEMPLAZANTE', 'REEMPLAZANTE']);

        for (let r = headerInfo.rowIndex + 1; r < manRows.length; r++) {
          const row = manRows[r];
          if (!row) continue;
          const nHoja = iCod >= 0 && row[iCod] ? String(row[iCod]).trim().toUpperCase() : '';
          if (!nHoja || nHoja.includes('HOJA') || String(row[iDoc] || '').toUpperCase().includes('NOMBRE')) continue;
          const docente = iDoc >= 0 && row[iDoc] ? String(row[iDoc]).trim().toUpperCase() : '';
          const nrc = iNrc >= 0 && row[iNrc] ? String(row[iNrc]).trim() : '';
          const curso = iCur >= 0 && row[iCur] ? String(row[iCur]).trim().toUpperCase() : '';
          const docReemp = iReemp >= 0 && row[iReemp] ? String(row[iReemp]).trim().toUpperCase() : '';
          if (!docente && !nrc && !curso && !docReemp) continue;
          parsedManualSheets.push({
            id: `manual_2_${r}`,
            n_hoja: nHoja.replace(/^LNI-/i, 'LN1-'),
            fecha: iFec >= 0 ? formatExcelDate(row[iFec]) : '',
            aula: iAula >= 0 && row[iAula] ? String(row[iAula]).trim().toUpperCase() : '',
            nrc,
            codigo_docente: iCodDoc >= 0 && row[iCodDoc] ? String(row[iCodDoc]).trim() : '',
            docente,
            curso,
            carrera: iCar >= 0 && row[iCar] ? String(row[iCar]).trim() : '',
            observacion: iAsis >= 0 && row[iAsis] ? String(row[iAsis]).trim() : '',
            docente_reemplazo: docReemp,
            motivo: iMot >= 0 && row[iMot] ? String(row[iMot]).trim() : (docReemp ? 'REEMPLAZO DOCENTE' : 'CLASE REGULAR'),
            estado_hoja: 'REGISTRADO'
          });
        }
      }

      // Sheet de Reservas (RESERVAS)
      const parsedReservas = [];
      const resSheetName = sheetNames.find(n => n.toUpperCase().includes('RESERVA'));
      if (resSheetName && wb.Sheets[resSheetName]) {
        const resRows = XLSX.utils.sheet_to_json(wb.Sheets[resSheetName], { header: 1 });
        const headerInfo = findHeaderRow(resRows, ['FECHA', 'AULA']) || {
          rowIndex: 3,
          cells: (resRows[3] || []).map(c => String(c ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
        };
        const c = headerInfo.cells;
        const iFecha = colOf(c, ['FECHA']);
        const iMes = colOf(c, ['MES']);
        const iDia = colOf(c, ['DIA']);
        const iIni = colOf(c, ['INICIO']);
        const iFin = colOf(c, ['FINAL']);
        const iAula = colOf(c, ['AULA']);
        const iUbic = colOf(c, ['UBICACION']);
        const iDoc = colOf(c, ['DOCENTE']);
        const iDet = colOf(c, ['DETALLE']);
        const iUsu = colOf(c, ['USUARIO']);
        const iPrio = colOf(c, ['PRIORIDAD']);

        for (let r = headerInfo.rowIndex + 1; r < resRows.length; r++) {
          const row = resRows[r];
          if (!row) continue;
          const fecVal = iFecha >= 0 ? formatExcelDate(row[iFecha]) : '';
          const aulaVal = iAula >= 0 && row[iAula] ? String(row[iAula]).trim().toUpperCase() : '';
          if (!fecVal && !aulaVal) continue;
          parsedReservas.push({
            id: `res_imp_${r}`,
            fecha: fecVal,
            mes: iMes >= 0 && row[iMes] ? String(row[iMes]).trim().toUpperCase() : '',
            dia: iDia >= 0 && row[iDia] ? String(row[iDia]).trim().toUpperCase() : '',
            inicio: iIni >= 0 ? formatExcelTime(row[iIni]) : '',
            final: iFin >= 0 ? formatExcelTime(row[iFin]) : '',
            aula: aulaVal,
            ubicacion: iUbic >= 0 && row[iUbic] ? String(row[iUbic]).trim() : '',
            docente: iDoc >= 0 && row[iDoc] ? String(row[iDoc]).trim().toUpperCase() : '',
            detalle: iDet >= 0 && row[iDet] ? String(row[iDet]).trim() : '',
            usuario: iUsu >= 0 && row[iUsu] ? String(row[iUsu]).trim().toUpperCase() : 'OPERACIONES',
            prioridad: iPrio >= 0 && row[iPrio] ? String(row[iPrio]).trim().toUpperCase() : 'NORMAL'
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
        for (let r = 2; r < ambRows.length; r++) {
          const row = ambRows[r];
          if (!row || !row[2]) continue;
          parsedAmbientes.push({
            abrv: String(row[2]).trim().toUpperCase(),
            nombre: row[1] ? String(row[1]).trim() : '',
            tipo: row[7] ? String(row[7]).trim().toUpperCase() : 'AULA',
            aforo: row[3] ? Number(row[3]) : 30,
            pabellon: row[4] ? String(row[4]).trim().toUpperCase() : '',
            piso: row[5] ? String(row[5]).trim().toUpperCase() : '',
            ubicacion: row[6] ? String(row[6]).trim() : ''
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

  const cleanMaterialName = (mat) => {
    const raw = String(mat || '').toUpperCase().trim();
    if (raw.includes('PROYECTOR')) return 'PROYECTOR';
    if (raw.includes('HDMI')) return 'CABLE HDMI';
    if (raw.includes('PUNTERO')) return 'PUNTERO';
    if (raw.includes('MOUSE')) return 'MOUSE';
    if (raw.includes('CAMARA WEB') || raw.includes('CÁMARA WEB') || raw.includes('WEBCAM')) return 'CAMARA WEB';
    if (raw.includes('ADAPTADOR')) return 'ADAPTADOR';
    if (raw.includes('AUDIFONOS') || raw.includes('AUDÍFONOS')) return 'AUDIFONOS';
    if (raw.includes('CUTTING')) return 'CUTTING';
    if (raw.includes('RED') || raw.includes('ETHERNET')) return 'CABLE DE RED';
    return raw || 'OTROS';
  };

  // 1. Control Docente Analytics
  const filteredAttendance = useMemo(() => {
    return attendanceData.filter(item => {
      if (docenteDiaFilter !== 'TODOS' && item.dia !== docenteDiaFilter) return false;
      if (docentePabellonFilter === 'A') {
        const text = `${item.pisoPabellon || ''} ${item.aula || ''}`.toUpperCase();
        if (!text.includes('PABELLON A') && !text.includes('PABELLÓN A') && !item.aula?.startsWith('A')) return false;
      }
      if (docentePabellonFilter === 'B') {
        const text = `${item.pisoPabellon || ''} ${item.aula || ''}`.toUpperCase();
        if (!text.includes('PABELLON B') && !text.includes('PABELLÓN B') && !item.aula?.startsWith('B')) return false;
      }
      if (docenteStatusFilter === 'PUNTUAL' && (item.puntualidad || '').toUpperCase() !== 'PUNTUAL') return false;
      if (docenteStatusFilter === 'TARDE' && (item.puntualidad || '').toUpperCase() !== 'TARDE') return false;
      if (docenteStatusFilter === 'FALTA' && (item.asistencia || '').toUpperCase() !== 'NO') return false;
      if (docenteStatusFilter === 'SUPLENTE' && !(item.asistencia || '').toUpperCase().includes('REEMPLAZO')) return false;
      if (docenteStatusFilter === 'PENDIENTE') {
        const p = (item.puntualidad || '').toUpperCase();
        const a = (item.asistencia || '').toUpperCase();
        if (p === 'PUNTUAL' || p === 'TARDE' || a === 'NO' || a.includes('REEMPLAZO')) return false;
      }
      if (docenteSearch.trim()) {
        const q = docenteSearch.toLowerCase();
        const doc = (item.docente || '').toLowerCase();
        const aul = (item.aula || '').toLowerCase();
        const cur = (item.curso || '').toLowerCase();
        const nrc = (item.nrc || '').toLowerCase();
        const car = (item.carrera || '').toLowerCase();
        if (!doc.includes(q) && !aul.includes(q) && !cur.includes(q) && !nrc.includes(q) && !car.includes(q)) return false;
      }
      return true;
    });
  }, [attendanceData, docenteDiaFilter, docentePabellonFilter, docenteStatusFilter, docenteSearch]);

  const attendanceStats = useMemo(() => {
    const base = docenteDiaFilter === 'TODOS'
      ? attendanceData
      : attendanceData.filter(item => item.dia === docenteDiaFilter);

    const total = base.length;
    let puntual = 0, tarde = 0, falta = 0, suplente = 0, pendientes = 0;
    const carreraMap = {};

    for (const item of base) {
      const p = (item.puntualidad || '').toUpperCase();
      const a = (item.asistencia || '').toUpperCase();
      if (p === 'PUNTUAL') puntual++;
      else if (p === 'TARDE') tarde++;
      else if (a === 'NO') falta++;
      else if (a.includes('REEMPLAZO')) suplente++;
      else pendientes++;

      const c = (item.carrera || 'Otras').trim();
      if (!carreraMap[c]) carreraMap[c] = { total: 0, puntual: 0 };
      carreraMap[c].total++;
      if (p === 'PUNTUAL') carreraMap[c].puntual++;
    }

    const totalAsist = puntual + tarde + suplente;
    const pctAsist = total > 0 ? Math.round((totalAsist / total) * 100) : 0;
    const pctPuntual = total > 0 ? Math.round((puntual / total) * 100) : 0;

    const topCarreras = Object.entries(carreraMap)
      .map(([name, data]) => ({
        name,
        total: data.total,
        puntual: data.puntual,
        pct: Math.round((data.puntual / data.total) * 100)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return { total, puntual, tarde, falta, suplente, pendientes, pctAsist, pctPuntual, topCarreras };
  }, [attendanceData, docenteDiaFilter]);

  // 2. Préstamos Analytics
  const filteredTickets = useMemo(() => {
    return ticketsData.filter(t => {
      const isDevuelto = t.estado === 'ATENDIDO' || t.estado === 'DEVUELTO';
      if (ticketStatusFilter === 'ACTIVOS' && isDevuelto) return false;
      if (ticketStatusFilter === 'DEVUELTOS' && !isDevuelto) return false;

      if (ticketMaterialFilter !== 'TODOS') {
        const mat = cleanMaterialName(t.tipoSolicitud || t.descripcionSolucion);
        if (mat !== ticketMaterialFilter) return false;
      }

      if (ticketSearch.trim()) {
        const q = ticketSearch.toLowerCase();
        const desc = (t.descripcionSolucion || '').toLowerCase();
        const tipo = (t.tipoSolicitud || '').toLowerCase();
        const amb = (t.ambiente || '').toLowerCase();
        const rec = (t.recibidoPor || '').toLowerCase();
        const resp = (t.responsable || '').toLowerCase();
        if (!desc.includes(q) && !tipo.includes(q) && !amb.includes(q) && !rec.includes(q) && !resp.includes(q)) return false;
      }
      return true;
    });
  }, [ticketsData, ticketStatusFilter, ticketMaterialFilter, ticketSearch]);

  const ticketsStats = useMemo(() => {
    const total = ticketsData.length;
    let activos = 0, devueltos = 0;
    const materialMap = {};
    const assistantMap = {};

    for (const t of ticketsData) {
      const isDevuelto = t.estado === 'ATENDIDO' || t.estado === 'DEVUELTO';
      if (isDevuelto) devueltos++;
      else activos++;

      const mat = cleanMaterialName(t.tipoSolicitud || t.descripcionSolucion);
      materialMap[mat] = (materialMap[mat] || 0) + 1;

      const asis = (t.responsable || 'OPERACIONES SEDE').trim().toUpperCase();
      assistantMap[asis] = (assistantMap[asis] || 0) + 1;
    }

    const sortedMaterials = Object.entries(materialMap).sort((a, b) => b[1] - a[1]);
    const sortedAssistants = Object.entries(assistantMap).sort((a, b) => b[1] - a[1]);

    return { total, activos, devueltos, sortedMaterials, sortedAssistants };
  }, [ticketsData]);

  // 3. Hojas Manuales Analytics
  const filteredManualSheets = useMemo(() => {
    return manualSheetsData.filter(m => {
      const hasSign = Boolean(m.firma_docente || m.firmaDocente);
      if (manualFirmaFilter === 'FIRMADO' && !hasSign) return false;
      if (manualFirmaFilter === 'PENDIENTE' && hasSign) return false;

      if (manualSearch.trim()) {
        const q = manualSearch.toLowerCase();
        const doc = (m.docente || '').toLowerCase();
        const aula = (m.aula || '').toLowerCase();
        const mot = (m.motivo || m.tipoClase || '').toLowerCase();
        const cur = (m.curso || '').toLowerCase();
        const nrc = (m.nrc || '').toLowerCase();
        if (!doc.includes(q) && !aula.includes(q) && !mot.includes(q) && !cur.includes(q) && !nrc.includes(q)) return false;
      }
      return true;
    });
  }, [manualSheetsData, manualFirmaFilter, manualSearch]);

  const manualSheetsStats = useMemo(() => {
    const total = manualSheetsData.length;
    let firmadas = 0, pendientes = 0;
    const motivoMap = {};

    for (const m of manualSheetsData) {
      if (m.firma_docente || m.firmaDocente) firmadas++;
      else pendientes++;

      const mot = (m.motivo || m.tipoClase || 'Recuperación de Clase').trim();
      motivoMap[mot] = (motivoMap[mot] || 0) + 1;
    }

    const sortedMotivos = Object.entries(motivoMap).sort((a, b) => b[1] - a[1]);
    return { total, firmadas, pendientes, sortedMotivos };
  }, [manualSheetsData]);

  // 4. Reservas Analytics
  const filteredReservations = useMemo(() => {
    return reservationsData.filter(r => {
      if (reservaPabellonFilter === 'A' && !r.ambiente?.toUpperCase().startsWith('A')) return false;
      if (reservaPabellonFilter === 'B' && !r.ambiente?.toUpperCase().startsWith('B')) return false;

      if (reservaSearch.trim()) {
        const q = reservaSearch.toLowerCase();
        const sol = (r.docente || r.solicitante || '').toLowerCase();
        const amb = (r.ambiente || r.aula || '').toLowerCase();
        const mot = (r.motivo || '').toLowerCase();
        const eq = (r.equipamiento || '').toLowerCase();
        if (!sol.includes(q) && !amb.includes(q) && !mot.includes(q) && !eq.includes(q)) return false;
      }
      return true;
    });
  }, [reservationsData, reservaPabellonFilter, reservaSearch]);

  const reservationsStats = useMemo(() => {
    const total = reservationsData.length;
    let activas = 0, finalizadas = 0;
    const roomMap = {};
    let pabA = 0, pabB = 0;

    for (const r of reservationsData) {
      const est = (r.estado || 'CONFIRMADA').toUpperCase();
      if (est === 'FINALIZADA' || est === 'ATENDIDO') finalizadas++;
      else activas++;

      const room = (r.ambiente || r.aula || 'Sede').trim().toUpperCase();
      roomMap[room] = (roomMap[room] || 0) + 1;

      if (room.startsWith('A')) pabA++;
      else if (room.startsWith('B')) pabB++;
    }

    const sortedRooms = Object.entries(roomMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { total, activas, finalizadas, sortedRooms, pabA, pabB };
  }, [reservationsData]);

  if (loading && !stats) {
    return (
      <div className="text-center py-20 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs animate-fade-in">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Calculando indicadores clave desde SQLite...</p>
      </div>
    );
  }

  if (!stats) return null;

  const {
    totalClasses = 0,
    puntual = 0,
    tarde = 0,
    falta = 0,
    reemplazo = 0,
    pendientes = 0,
    pctAsistencia = 0,
    ticketsPendientes = 0,
    ticketsEnProceso = 0,
    ticketsAtendidos = 0,
    categoryCounts = {}
  } = stats || {};

  const totalAsistieron = puntual + tarde + reemplazo;

  const sortedCategories = Object.entries(categoryCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);

  return (
    <div className="space-y-4 pb-36 md:pb-12">
      {/* Top Banner con Identidad Institucional */}
      <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-[#FDBA30]"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Analítica & Cumplimiento UPN</span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Dashboard de Métricas Interactivas</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Supervisión de cada apartado operativo de la sede en tiempo real.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 hidden sm:inline">Día actual:</span>
            <span className="px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 font-mono font-black text-xs text-amber-950 dark:text-amber-300">
              {todayDefault}
            </span>
          </div>
        </div>
      </div>

      {/* Selector de Pestañas Interactivas por Apartado de la App */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
        {[
          { id: 'resumen', label: 'Resumen Global', icon: LayoutDashboard, count: null },
          { id: 'attendance', label: 'Control Docente', icon: GraduationCap, count: attendanceData.length },
          { id: 'tickets', label: 'Préstamos de Material', icon: Package, count: ticketsData.length },
          { id: 'manual-sheets', label: 'Hojas Manuales', icon: FileText, count: manualSheetsData.length },
          { id: 'reservations', label: 'Reserva de Espacios', icon: Building2, count: reservationsData.length },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSectionTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSectionTab(tab.id)}
              className={`h-11 px-4 rounded-2xl flex items-center gap-2.5 text-xs font-black transition-all active:scale-95 shrink-0 whitespace-nowrap shadow-xs ${
                isActive
                  ? 'bg-[#FDBA30] text-slate-950 border border-amber-400 shadow-[0_2px_12px_rgba(253,186,48,0.35)]'
                  : 'bg-white hover:bg-slate-100 dark:bg-[#0c0c0f] dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/90 dark:border-zinc-800'
              }`}
            >
              <Icon className={`w-4 h-4 stroke-[2.4] ${isActive ? 'text-slate-950' : 'text-slate-500 dark:text-zinc-400'}`} />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-black/15 text-slate-950'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* PESTAÑA 1: RESUMEN GLOBAL                                */}
      {/* ======================================================== */}
      {activeSectionTab === 'resumen' && (
        <div key="resumen" className="space-y-4 animate-fade-in">
          {/* Selector de día para el resumen diario */}
          <div className="flex items-center justify-between flex-wrap gap-2 bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-3 shadow-xs">
            <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Ver estadísticas del día:
            </span>
            <div className="grid grid-cols-7 gap-1 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl w-full sm:w-auto">
              {['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'].map((d) => {
                const isSelected = selectedDia === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDia(d)}
                    className={`px-2 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 text-center flex items-center justify-center active:scale-95 ${
                      isSelected
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

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* % Asistencia */}
            <div 
              onClick={() => setActiveSectionTab('attendance')}
              className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs cursor-pointer hover:border-amber-400 transition group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-tight">
                  % ASISTENCIA DOCENTE
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 transition" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {pctAsistencia}%
              </div>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 block font-medium">
                {totalAsistieron} de {totalClasses} sesiones ({selectedDia})
              </span>
            </div>

            {/* Puntuales */}
            <div 
              onClick={() => { setActiveSectionTab('attendance'); setDocenteStatusFilter('PUNTUAL'); }}
              className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-4 shadow-xs cursor-pointer hover:border-emerald-500 transition group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="block text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">
                  PUNTUALES
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-900 dark:text-emerald-300">
                {puntual}
              </div>
              <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 block font-medium">
                A tiempo al inicio de clase
              </span>
            </div>

            {/* Incidencias */}
            <div 
              onClick={() => { setActiveSectionTab('attendance'); setDocenteStatusFilter('TARDE'); }}
              className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-4 shadow-xs cursor-pointer hover:border-amber-500 transition group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="block text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-tight">
                  TARDE / FALTA
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition" />
              </div>
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
            <div 
              onClick={() => setActiveSectionTab('tickets')}
              className="bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-4 shadow-xs cursor-pointer hover:border-amber-500 transition group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="block text-[10px] font-bold text-amber-900 dark:text-amber-400 uppercase tracking-tight">
                  PRÉSTAMOS DE MATERIAL
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition" />
              </div>
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
                        className={`h-full rounded-full transition-all duration-500 ${
                          idx === 0 ? 'bg-[#FDBA30]' :
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
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 2: CONTROL DOCENTE (ASISTENCIA)                   */}
      {/* ======================================================== */}
      {activeSectionTab === 'attendance' && (
        <div key="attendance" className="space-y-4 animate-fade-in">
          {/* Barra de Filtros Interactivos: Día & Pabellón */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                  Filtro por Día de la Semana
                </span>
              </div>

              {/* Botones de Días con TODOS */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {['TODOS', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'].map(d => {
                  const isSel = docenteDiaFilter === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDocenteDiaFilter(d)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition active:scale-95 whitespace-nowrap ${
                        isSel
                          ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                      }`}
                    >
                      {d === 'TODOS' ? 'Todos los días' : d === 'MIERCOLES' ? 'MIÉ' : d.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Buscador & Pabellón */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={docenteSearch}
                  onChange={e => setDocenteSearch(e.target.value)}
                  placeholder="Buscar por docente, aula (ej. A201), curso, NRC o carrera..."
                  className="w-full h-10 pl-9 pr-3 text-xs font-medium bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-[#FDBA30]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {['TODOS', 'A', 'B'].map(pab => {
                  const isPab = docentePabellonFilter === pab;
                  return (
                    <button
                      key={pab}
                      type="button"
                      onClick={() => setDocentePabellonFilter(pab)}
                      className={`h-10 px-3.5 text-xs font-bold rounded-xl border transition active:scale-95 ${
                        isPab
                          ? 'bg-[#FDBA30] text-slate-950 border-amber-400 font-black shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      {pab === 'TODOS' ? 'Todos Pabellones' : `Pabellón ${pab}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* KPI Cards Interactivos de Asistencia (Click to filter) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {[
              { id: 'TODOS', label: 'TOTAL SESIONES', count: attendanceStats.total, color: 'slate', sub: `${attendanceStats.pctAsist}% asistencia` },
              { id: 'PUNTUAL', label: 'PUNTUAL', count: attendanceStats.puntual, color: 'emerald', sub: `${attendanceStats.pctPuntual}% del total` },
              { id: 'TARDE', label: 'TARDANZAS', count: attendanceStats.tarde, color: 'amber', sub: 'Llegada con retraso' },
              { id: 'FALTA', label: 'FALTAS', count: attendanceStats.falta, color: 'rose', sub: 'Clase no impartida' },
              { id: 'SUPLENTE', label: 'SUPLENTES', count: attendanceStats.suplente, color: 'purple', sub: 'Docente de reemplazo' },
            ].map(card => {
              const isActive = docenteStatusFilter === card.id;
              return (
                <div
                  key={card.id}
                  onClick={() => setDocenteStatusFilter(docenteStatusFilter === card.id ? 'TODOS' : card.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs active:scale-98 ${
                    isActive
                      ? 'ring-2 ring-amber-500 bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700'
                      : card.color === 'emerald'
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/60'
                      : card.color === 'amber'
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/60'
                      : card.color === 'rose'
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-800/60'
                      : card.color === 'purple'
                      ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200/80 dark:border-purple-800/60'
                      : 'bg-white dark:bg-[#0c0c0f] border-slate-200/90 dark:border-zinc-800'
                  }`}
                >
                  <span className="block text-[10px] font-bold uppercase tracking-tight text-slate-500 dark:text-zinc-400 mb-0.5">
                    {card.label}
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {card.count}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-0.5 font-medium truncate">
                    {card.sub}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Ranking Top Carreras */}
          {attendanceStats.topCarreras.length > 0 && (
            <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200 mb-2.5">
                Top Carreras con Mayor Puntualidad
              </h3>
              <div className="space-y-2">
                {attendanceStats.topCarreras.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3 text-xs">
                    <span className="w-5 text-center font-bold text-slate-400">#{i + 1}</span>
                    <span className="flex-1 font-semibold text-slate-800 dark:text-zinc-200 truncate">{c.name}</span>
                    <div className="w-32 bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${c.pct}%` }} />
                    </div>
                    <span className="w-12 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista Interactiva de Clases Filtradas */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                Sesiones Filtradas ({filteredAttendance.length})
              </h3>
              {docenteStatusFilter !== 'TODOS' && (
                <button
                  type="button"
                  onClick={() => setDocenteStatusFilter('TODOS')}
                  className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Limpiar filtro de estado ({docenteStatusFilter})
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 max-h-[460px] overflow-y-auto">
              {filteredAttendance.slice(0, 30).map(item => {
                const p = (item.puntualidad || '').toUpperCase();
                const a = (item.asistencia || '').toUpperCase();
                const isPuntual = p === 'PUNTUAL';
                const isTarde = p === 'TARDE';
                const isFalta = a === 'NO';
                const isSuplente = a.includes('REEMPLAZO');

                return (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 font-mono font-black text-slate-900 dark:text-white shrink-0">
                        {item.aula}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {item.docente}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {item.curso} · {item.carrera}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[11px] text-slate-600 dark:text-zinc-400">
                        {item.horaInicioProg} {item.horaInicioReal ? `(Real: ${item.horaInicioReal})` : ''}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                        isPuntual
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : isTarde
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          : isFalta
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                          : isSuplente
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
                      }`}>
                        {isPuntual ? 'PUNTUAL' : isTarde ? 'TARDE' : isFalta ? 'FALTA' : isSuplente ? 'SUPLENTE' : 'PENDIENTE'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 3: PRÉSTAMOS DE MATERIAL                          */}
      {/* ======================================================== */}
      {activeSectionTab === 'tickets' && (
        <div key="tickets" className="space-y-4 animate-fade-in">
          {/* KPI Cards Interactivos de Préstamos */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'TODOS', label: 'TOTAL PRÉSTAMOS', count: ticketsStats.total, color: 'slate', sub: 'Histórico acumulado' },
              { id: 'ACTIVOS', label: 'ACTIVOS EN AULA', count: ticketsStats.activos, color: 'amber', sub: 'Pendientes de devolución' },
              { id: 'DEVUELTOS', label: 'DEVUELTOS CONFORMES', count: ticketsStats.devueltos, color: 'emerald', sub: 'Con firma de recepción' },
            ].map(c => {
              const isSel = ticketStatusFilter === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setTicketStatusFilter(ticketStatusFilter === c.id ? 'TODOS' : c.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs active:scale-98 ${
                    isSel
                      ? 'ring-2 ring-amber-500 bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700'
                      : c.color === 'emerald'
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/60'
                      : c.color === 'amber'
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/60'
                      : 'bg-white dark:bg-[#0c0c0f] border-slate-200/90 dark:border-zinc-800'
                  }`}
                >
                  <span className="block text-[10px] font-bold uppercase tracking-tight text-slate-500 dark:text-zinc-400 mb-0.5">
                    {c.label}
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                    {c.count}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5 font-medium">
                    {c.sub}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Filtro por Chips de Materiales */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                Filtrar por Material Específico
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {['TODOS', 'PROYECTOR', 'CABLE HDMI', 'PUNTERO', 'MOUSE', 'CAMARA WEB', 'ADAPTADOR', 'AUDIFONOS', 'CUTTING'].map(mat => {
                const isSel = ticketMaterialFilter === mat;
                return (
                  <button
                    key={mat}
                    type="button"
                    onClick={() => setTicketMaterialFilter(mat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                      isSel
                        ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    {mat}
                  </button>
                );
              })}
            </div>

            {/* Buscador de Préstamos */}
            <div className="relative pt-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 text-slate-400" />
              <input
                type="text"
                value={ticketSearch}
                onChange={e => setTicketSearch(e.target.value)}
                placeholder="Buscar por solicitante, aula, asistente o descripción..."
                className="w-full h-10 pl-9 pr-3 text-xs font-medium bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-[#FDBA30]"
              />
            </div>
          </div>

          {/* Top Materiales Demandados & Asistentes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200 mb-2.5">
                Demanda por Tipo de Equipo
              </h3>
              <div className="space-y-2">
                {ticketsStats.sortedMaterials.slice(0, 5).map(([name, count]) => {
                  const max = ticketsStats.sortedMaterials[0]?.[1] || 1;
                  const pct = Math.round((count / max) * 100);
                  return (
                    <div key={name} className="flex items-center gap-3 text-xs">
                      <span className="w-28 font-bold text-slate-800 dark:text-zinc-200 truncate">{name}</span>
                      <div className="flex-1 bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-[#FDBA30] h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-16 text-right font-mono font-bold text-slate-900 dark:text-white">{count} prést.</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200 mb-2.5">
                Atenciones por Asistente de Operaciones
              </h3>
              <div className="space-y-2">
                {ticketsStats.sortedAssistants.slice(0, 5).map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-zinc-800/60 last:border-0">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{name}</span>
                    <span className="font-mono font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">
                      {count} préstamos
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lista Interactiva de Préstamos Filtrados */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200 mb-3">
              Préstamos Filtrados ({filteredTickets.length})
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 max-h-[460px] overflow-y-auto">
              {filteredTickets.slice(0, 30).map(t => {
                const isDevuelto = t.estado === 'ATENDIDO' || t.estado === 'DEVUELTO';
                const cargoNum = formatCargoNumber(t);
                return (
                  <div key={t.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 font-mono font-black text-[11px] shrink-0">
                        {cargoNum}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          [{t.ambiente || 'DOCENCIA'}] {t.tipoSolicitud || 'MATERIAL'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {t.recibidoPor ? `Solicitante: ${t.recibidoPor}` : t.descripcionSolucion}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[11px] text-slate-500">
                        {t.horaReporte || '--:--'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                        isDevuelto
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                      }`}>
                        {isDevuelto ? 'DEVUELTO' : 'EN AULA'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 4: HOJAS MANUALES                                */}
      {/* ======================================================== */}
      {activeSectionTab === 'manual-sheets' && (
        <div key="manual-sheets" className="space-y-4 animate-fade-in">
          {/* KPI Cards Interactivos de Hojas Manuales */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'TODOS', label: 'TOTAL HOJAS EMITIDAS', count: manualSheetsStats.total, color: 'slate', sub: 'Clases extraordinarias' },
              { id: 'FIRMADO', label: 'CON FIRMA DIGITAL', count: manualSheetsStats.firmadas, color: 'emerald', sub: 'Comprobante conforme' },
              { id: 'PENDIENTE', label: 'PENDIENTES DE FIRMA', count: manualSheetsStats.pendientes, color: 'amber', sub: 'Por regularizar' },
            ].map(c => {
              const isSel = manualFirmaFilter === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setManualFirmaFilter(manualFirmaFilter === c.id ? 'TODOS' : c.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs active:scale-98 ${
                    isSel
                      ? 'ring-2 ring-amber-500 bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700'
                      : c.color === 'emerald'
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/60'
                      : c.color === 'amber'
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/60'
                      : 'bg-white dark:bg-[#0c0c0f] border-slate-200/90 dark:border-zinc-800'
                  }`}
                >
                  <span className="block text-[10px] font-bold uppercase tracking-tight text-slate-500 dark:text-zinc-400 mb-0.5">
                    {c.label}
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                    {c.count}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5 font-medium">
                    {c.sub}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Desglose por Motivo de Clase Extraordinaria */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200 mb-3">
              Distribución por Motivo de Emisión
            </h3>
            <div className="space-y-2.5">
              {manualSheetsStats.sortedMotivos.map(([mot, count]) => {
                const max = manualSheetsStats.sortedMotivos[0]?.[1] || 1;
                const pct = Math.round((count / max) * 100);
                return (
                  <div key={mot} className="flex items-center gap-3 text-xs">
                    <span className="w-48 font-bold text-slate-800 dark:text-zinc-200 truncate">{mot}</span>
                    <div className="flex-1 bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-purple-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-16 text-right font-mono font-bold text-purple-600 dark:text-purple-400">{count} hojas</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Buscador y Lista de Hojas Manuales */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={manualSearch}
                onChange={e => setManualSearch(e.target.value)}
                placeholder="Buscar hoja por docente, aula, NRC o motivo..."
                className="w-full h-10 pl-9 pr-3 text-xs font-medium bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-[#FDBA30]"
              />
            </div>

            <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 max-h-[460px] overflow-y-auto">
              {filteredManualSheets.slice(0, 30).map(m => {
                const hasSign = Boolean(m.firma_docente || m.firmaDocente);
                return (
                  <div key={m.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        [{m.aula}] {m.docente}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                        {m.motivo || 'Clase Extraordinaria'} · {m.fecha} ({m.turno || 'DIURNO'})
                      </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] shrink-0 ${
                      hasSign
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                    }`}>
                      {hasSign ? 'FIRMADO' : 'PENDIENTE'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 5: RESERVA DE ESPACIOS                           */}
      {/* ======================================================== */}
      {activeSectionTab === 'reservations' && (
        <div key="reservations" className="space-y-4 animate-fade-in">
          {/* KPI Cards Interactivos de Reservas */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'TOTAL', label: 'TOTAL RESERVAS', count: reservationsStats.total, color: 'slate', sub: 'Espacios programados' },
              { id: 'ACTIVAS', label: 'ACTIVAS / CONFIRMADAS', count: reservationsStats.activas, color: 'emerald', sub: 'Vigentes en cronograma' },
              { id: 'FINALIZADAS', label: 'FINALIZADAS', count: reservationsStats.finalizadas, color: 'amber', sub: 'Historial concluido' },
            ].map(c => (
              <div
                key={c.id}
                className={`p-4 rounded-2xl border transition-all shadow-xs ${
                  c.color === 'emerald'
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/60'
                    : c.color === 'amber'
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/60'
                    : 'bg-white dark:bg-[#0c0c0f] border-slate-200/90 dark:border-zinc-800'
                }`}
              >
                <span className="block text-[10px] font-bold uppercase tracking-tight text-slate-500 dark:text-zinc-400 mb-0.5">
                  {c.label}
                </span>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {c.count}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5 font-medium">
                  {c.sub}
                </span>
              </div>
            ))}
          </div>

          {/* Top Aulas Más Demandadas & Pabellón */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200 mb-2.5">
                Top Aulas y Laboratorios Más Solicitados
              </h3>
              <div className="space-y-2">
                {reservationsStats.sortedRooms.map(([room, count]) => {
                  const max = reservationsStats.sortedRooms[0]?.[1] || 1;
                  const pct = Math.round((count / max) * 100);
                  return (
                    <div key={room} className="flex items-center gap-3 text-xs">
                      <span className="w-20 font-bold text-slate-800 dark:text-zinc-200 truncate">{room}</span>
                      <div className="flex-1 bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-sky-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-16 text-right font-mono font-bold text-sky-600 dark:text-sky-400">{count} res.</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200 mb-2.5">
                Ocupación por Pabellón
              </h3>
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>Pabellón A</span>
                    <span className="font-mono">{reservationsStats.pabA} reservas</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full rounded-full" 
                      style={{ width: `${reservationsStats.total > 0 ? (reservationsStats.pabA / reservationsStats.total) * 100 : 0}%` }} 
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span>Pabellón B</span>
                    <span className="font-mono">{reservationsStats.pabB} reservas</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500 h-full rounded-full" 
                      style={{ width: `${reservationsStats.total > 0 ? (reservationsStats.pabB / reservationsStats.total) * 100 : 0}%` }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Buscador y Lista de Reservas */}
          <div className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={reservaSearch}
                  onChange={e => setReservaSearch(e.target.value)}
                  placeholder="Buscar reserva por solicitante, aula, motivo o equipo..."
                  className="w-full h-10 pl-9 pr-3 text-xs font-medium bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-[#FDBA30]"
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {['TODOS', 'A', 'B'].map(pab => (
                  <button
                    key={pab}
                    type="button"
                    onClick={() => setReservaPabellonFilter(pab)}
                    className={`h-10 px-3.5 text-xs font-bold rounded-xl border transition active:scale-95 ${
                      reservaPabellonFilter === pab
                        ? 'bg-[#FDBA30] text-slate-950 border-amber-400 font-black shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                    }`}
                  >
                    {pab === 'TODOS' ? 'Todos' : `Pab ${pab}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 max-h-[460px] overflow-y-auto">
              {filteredReservations.slice(0, 30).map(r => (
                <div key={r.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      [{r.ambiente}] {r.docente || r.solicitante || 'Reserva'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {r.motivo || 'Uso académico'} · {r.fecha} ({r.horaInicio || r.rango || '--:--'})
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full font-black text-[10px] bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 shrink-0">
                    {r.estado || 'CONFIRMADA'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

          <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto">
            <div className="relative ml-auto sm:ml-0" ref={dropdownRef}>
              {/* Boton Pequeño Solo con el Logo/Icono */}
              <button
                type="button"
                onClick={() => isMenuOpen ? excelMenuFade.requestClose(() => setIsMenuOpen(false)) : setIsMenuOpen(true)}
                title="Gestion de Excel & OneDrive"
                className="w-10 h-10 rounded-xl bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition-all active:scale-95 inline-flex items-center justify-center shrink-0"
              >
                <Database className="w-5 h-5 stroke-[2.4]" />
              </button>

              {/* Menu Flotante Desplegable Hacia Arriba - Con Fade In y Fade Out Suave */}
              {excelMenuFade.shouldRender && (
                <div className={`absolute right-0 bottom-full mb-2 w-72 sm:w-80 bg-white dark:bg-[#121216] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-zinc-800 p-2 z-50 ${excelMenuFade.dropdownClass} space-y-1`}>
                  {/* 1. Vincular / Abrir Excel de OneDrive en Tiempo Real */}
                  <button
                    type="button"
                    disabled={syncing || importing}
                    onClick={() => {
                      excelMenuFade.requestClose(() => {
                        setIsMenuOpen(false);
                        setShowOneDriveModal(true);
                      });
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
                            : 'OneDrive: CONTROL DOCENTE - TEST.xlsx'}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-black shrink-0 whitespace-nowrap">
                          CONECTADO
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-snug">
                        Abrir o sincronizar en tiempo real con tu archivo en OneDrive UPN.
                      </p>
                    </div>
                  </button>

                  {/* 2. Descargar Copia de Respaldo (.xlsx) */}
                  <button
                    type="button"
                    disabled={syncing || importing}
                    onClick={() => {
                      excelMenuFade.requestClose(() => {
                        setIsMenuOpen(false);
                        handleExportExcel();
                      });
                    }}
                    className="w-full p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-left transition flex items-start gap-3 group active:scale-98 disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Download className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Descargar Copia de Respaldo (.xlsx)
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
