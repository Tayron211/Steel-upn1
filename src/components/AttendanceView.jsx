import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { createDbChangeGate } from '../utils/webSignGate';
import {
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  UserCheck,
  AlertTriangle,
  HandHelping,
  CheckCheck,
  FileText,
  X,
  Calendar,
  CalendarClock,
  CalendarPlus,
  GraduationCap,
  User,
  Building,
  RotateCcw,
  Sparkles,
  Check,
  DoorOpen,
  Users,
  Monitor,
  PenTool,
  Cable,
  Package,
  Layers,
  MoreVertical,
  Copy,
  Table,
  LayoutGrid
} from 'lucide-react';
import ToastBanner from './ToastBanner';
import CustomDatePicker from './CustomDatePicker';
import CustomSelect from './CustomSelect';
import { useAssistants } from '../utils/assistants';

const TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:20', '09:00', '09:10', '10:00', '10:50',
  '11:00', '11:40', '12:00', '12:30', '13:00', '13:20', '14:00', '14:30',
  '15:00', '15:20', '16:00', '16:10', '17:00', '17:50', '18:00', '18:40',
  '19:00', '19:30', '20:00', '20:20', '21:00', '21:10', '22:00', '22:50'
];

// Generador oficial de Tabla de Asistencia en HTML y TSV (14 columnas según modelo oficial de Excel)
const generateAttendanceTableData = (items, selectedDia, explicitDateStr) => {
  const list = Array.isArray(items) ? items : [items];
  
  // Calcular la fecha exacta correspondiente al día de la semana seleccionado en la semana en curso
  let dateStr = explicitDateStr;
  if (!dateStr) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    const dayNames = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
    const idx = dayNames.indexOf(String(selectedDia || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const targetDate = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + (idx >= 0 ? idx : 0));
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const yyyy = targetDate.getFullYear();
    dateStr = `${dd}/${mm}/${yyyy}`;
  }

  const thStyle = 'background-color:#FFC000;color:#000000;font-weight:bold;border:1px solid #000000;padding:6px 10px;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:11pt;white-space:nowrap;';
  const thBlackStyle = 'background-color:#000000;color:#FFFFFF;font-weight:bold;border:1px solid #000000;padding:6px 10px;text-align:center;font-family:Calibri,Arial,sans-serif;font-size:11pt;white-space:nowrap;';
  const tdStyle = 'border:1px solid #000000;padding:6px 8px;font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#000000;background-color:#FFFFFF;white-space:nowrap;';
  const tdCenterStyle = 'border:1px solid #000000;padding:6px 8px;font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#000000;text-align:center;background-color:#FFFFFF;white-space:nowrap;';

  const rowsHtml = list.map(item => {
    const isPuntual = item.puntualidad === 'PUNTUAL';
    const isTarde = item.puntualidad === 'TARDE';
    const isFalta = item.asistencia === 'NO';

    const rawDia = String(item.dia || selectedDia || 'LUNES').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const diasVal = rawDia.includes('/') ? rawDia : `${rawDia} ${dateStr}`;

    const sede = item.sede || 'Comas';
    const periodo = item.periodo || '226434';
    const hIniProg = item.horaInicioProg || '';
    const hFinProg = item.horaFinalProg || '';
    const aula = item.aula || '';
    const nrc = item.nrc || '';
    const docente = item.docente || '';
    const curso = item.curso || '';
    const carrera = item.carrera || '';

    let hIniReal = '';
    let hFinReal = '';
    let asistencia = 'SI';
    let puntualidad = 'PUNTUAL';
    let puntColorBg = '#C6EFCE';
    let puntColorFg = '#006100';

    if (isFalta) {
      hIniReal = '-';
      hFinReal = '-';
      asistencia = 'NO';
      puntualidad = '-';
      puntColorBg = '#000000';
      puntColorFg = '#FFFFFF';
    } else if (isTarde) {
      hIniReal = item.horaInicioReal || hIniProg;
      hFinReal = item.horaFinalReal || hFinProg;
      asistencia = 'SI';
      puntualidad = 'TARDE';
      puntColorBg = '#FFEB9C';
      puntColorFg = '#9C5700';
    } else {
      hIniReal = item.horaInicioReal || hIniProg;
      hFinReal = item.horaFinalReal || hFinProg;
      asistencia = 'SI';
      puntualidad = 'PUNTUAL';
      puntColorBg = '#C6EFCE';
      puntColorFg = '#006100';
    }

    const tdPuntStyle = `border:1px solid #000000;padding:6px 8px;font-family:Calibri,Arial,sans-serif;font-size:10pt;font-weight:bold;text-align:center;background-color:${puntColorBg};color:${puntColorFg};white-space:nowrap;`;

    return `<tr>
      <td style="${tdCenterStyle}">${sede}</td>
      <td style="${tdCenterStyle}">${periodo}</td>
      <td style="${tdCenterStyle}">${diasVal}</td>
      <td style="${tdCenterStyle}">${hIniProg}</td>
      <td style="${tdCenterStyle}">${hFinProg}</td>
      <td style="${tdCenterStyle}">${aula}</td>
      <td style="${tdCenterStyle}">${nrc}</td>
      <td style="${tdStyle}">${docente}</td>
      <td style="${tdStyle}">${curso}</td>
      <td style="${tdStyle}">${carrera}</td>
      <td style="${tdCenterStyle}">${hIniReal}</td>
      <td style="${tdCenterStyle}">${hFinReal}</td>
      <td style="${tdCenterStyle}">${asistencia}</td>
      <td style="${tdPuntStyle}">${puntualidad}</td>
    </tr>`;
  }).join('');

  const html = `
<meta http-equiv="content-type" content="text/html; charset=utf-8">
<!--StartFragment-->
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;border:1px solid #000000;font-family:Calibri,Arial,sans-serif;font-size:10pt;">
  <thead>
    <tr>
      <th style="${thStyle}">SEDE</th>
      <th style="${thStyle}">PERIODO</th>
      <th style="${thStyle}">DÍAS</th>
      <th style="${thStyle}">HORA INICIO PROGRAMADA</th>
      <th style="${thStyle}">HORA FINAL PROGRAMADA</th>
      <th style="${thStyle}">AULA</th>
      <th style="${thStyle}">NRC.</th>
      <th style="${thStyle}">DOCENTE</th>
      <th style="${thStyle}">CURSO</th>
      <th style="${thStyle}">CARRERA</th>
      <th style="${thStyle}">HORA INICIO REAL</th>
      <th style="${thStyle}">HORA FINAL REAL</th>
      <th style="${thStyle}">ASISTENCIA</th>
      <th style="${thStyle}">PUNTUALIDAD</th>
    </tr>
  </thead>
  <tbody>
    ${rowsHtml}
  </tbody>
</table>
<!--EndFragment-->`.trim();

  const plainRows = list.map(item => {
    const isPuntual = item.puntualidad === 'PUNTUAL';
    const isTarde = item.puntualidad === 'TARDE';
    const isFalta = item.asistencia === 'NO';
    const rawDia = String(item.dia || selectedDia || 'LUNES').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const diasVal = rawDia.includes('/') ? rawDia : `${rawDia} ${dateStr}`;
    const hIniProg = item.horaInicioProg || '';
    const hFinProg = item.horaFinalProg || '';
    let hIniReal = isFalta ? '-' : (item.horaInicioReal || hIniProg);
    let hFinReal = isFalta ? '-' : (item.horaFinalReal || hFinProg);
    let asistencia = isFalta ? 'NO' : 'SI';
    let puntualidad = isFalta ? '-' : (isTarde ? 'TARDE' : 'PUNTUAL');

    return [
      item.sede || 'Comas',
      item.periodo || '226434',
      diasVal,
      hIniProg,
      hFinProg,
      item.aula || '',
      item.nrc || '',
      item.docente || '',
      item.curso || '',
      item.carrera || '',
      hIniReal,
      hFinReal,
      asistencia,
      puntualidad
    ].join('\t');
  });

  const plain = [
    ['SEDE', 'PERIODO', 'DÍAS', 'HORA INICIO PROGRAMADA', 'HORA FINAL PROGRAMADA', 'AULA', 'NRC.', 'DOCENTE', 'CURSO', 'CARRERA', 'HORA INICIO REAL', 'HORA FINAL REAL', 'ASISTENCIA', 'PUNTUALIDAD'].join('\t'),
    ...plainRows
  ].join('\n');

  return { html, plain };
};

// Helper robusto para copiar Tablas completas al portapapeles (HTML rico + texto plano TSV)
const copyRichTableToClipboard = async (plainText, htmlText) => {
  // 1. Prioridad: API Clipboard moderna con ClipboardItem (copia simultánea de HTML rico + TSV)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof window !== 'undefined' && window.ClipboardItem) {
    try {
      const blobHtml = new Blob([htmlText], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });
      const item = new window.ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch (e) {
      console.warn('ClipboardItem copy falló, usando fallback enriquecido:', e);
    }
  }

  // 2. Fallback enriquecido: listener de evento copy que escribe HTML rico para Excel/Word/Outlook
  if (typeof document !== 'undefined') {
    try {
      let copyOk = false;
      const listener = (e) => {
        e.preventDefault();
        e.clipboardData.setData('text/html', htmlText);
        e.clipboardData.setData('text/plain', plainText);
        copyOk = true;
      };
      document.addEventListener('copy', listener);
      const successful = document.execCommand('copy');
      document.removeEventListener('copy', listener);
      if (copyOk || successful) return true;
    } catch (err) {
      console.warn('Fallback copy listener falló:', err);
    }

    // 3. Fallback solo texto
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(plainText);
        return true;
      } catch (e) {
        console.warn('navigator.clipboard.writeText falló:', e);
      }
    }

    try {
      const textArea = document.createElement('textarea');
      textArea.value = plainText;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Error en fallback textarea copy:', err);
      return false;
    }
  }
  return false;
};

export default function AttendanceView({ onOpenNewTicket, onEmitManualSheet, initialSearch = '', onClearInitialSearch }) {
  const [data, setData] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Auto-detect current day in Spanish
  const daysOfWeek = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const todayDefault = daysOfWeek[new Date().getDay()];

  // Filter states
  const [selectedDia, setSelectedDia] = useState(todayDefault);
  const [selectedPabellon, setSelectedPabellon] = useState('');
  const [selectedPisos, setSelectedPisos] = useState([]); // Array para selección múltiple de pisos (ej: ['1ER PISO', '2DO PISO'])
  const [selectedHora, setSelectedHora] = useState('');
  const [blockMode, setBlockMode] = useState('ALL'); // 'ALL' | 'CURRENT' | 'NEXT'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'PUNTUAL' | 'TARDE' | 'FALTA'
  const [viewMode, setViewMode] = useState('CLASSES'); // 'CLASSES' | 'FREE_ROOMS'
  const [search, setSearch] = useState(initialSearch || '');
  const [selectedCarrera, setSelectedCarrera] = useState('');

  // Días de la semana con fechas exactas sincronizadas (Semana actual)
  const weekDaysWithDates = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);

    const names = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
    const shortNames = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

    return names.map((name, idx) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const dateStr = `${dd}/${mm}/${yyyy}`;
      const shortDate = `${dd}/${mm}`;
      const isToday = d.toDateString() === now.toDateString();
      const isFuture = d > new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return {
        name,
        short: shortNames[idx],
        date: d,
        dateStr,
        shortDate,
        isToday,
        isFuture,
        fullLabel: d.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      };
    });
  }, []);

  const selectedDayInfo = useMemo(() => {
    return weekDaysWithDates.find(w => w.name === selectedDia) || weekDaysWithDates[0];
  }, [weekDaysWithDates, selectedDia]);

  const handleResetDayToPending = async () => {
    if (!confirm(`¿Restablecer todas las clases de ${selectedDia} (${selectedDayInfo?.dateStr || ''}) a PENDIENTE?\nEsto limpiará las marcas ficticias o pasadas que no correspondan.`)) return;
    try {
      setLoading(true);
      const res = await fetch('/api/attendance/reset-future', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: [selectedDia] })
      });
      const json = await res.json();
      if (json.success) {
        setToastMessage(`✓ ${selectedDia} restablecido a PENDIENTE (${json.resetCount || 0} clases limpiadas)`);
        await loadAttendance();
      }
    } catch (err) {
      console.error(err);
      setToastMessage('❌ Error al restablecer día');
    } finally {
      setLoading(false);
    }
  };

  // Carreras únicas detectadas en la data cargada (para filtro rápido por carrera/facultad)
  const carrerasUnicas = useMemo(() => {
    const set = new Set();
    for (const c of data) {
      const car = String(c.carrera || '').trim();
      if (car) set.add(car);
    }
    return [...set].sort();
  }, [data]);

  // Función para alternar selección múltiple de pisos
  const handleTogglePiso = (val) => {
    if (!val) {
      // Si presiona 'Todos', desmarca todo para ver el campus completo
      setSelectedPisos([]);
      return;
    }
    setSelectedPisos(prev => {
      if (prev.includes(val)) {
        return prev.filter(p => p !== val);
      } else {
        return [...prev, val];
      }
    });
  };

  const matchesPiso = (pisoField, targetVal) => {
    if (!pisoField || !targetVal) return false;
    const f = String(pisoField).toUpperCase();
    const t = String(targetVal).toUpperCase();
    if (t === 'SOT' || t.includes('SOT')) return f.includes('SOT');
    if (t === '1ER PISO' || t.includes('1ER')) return f.includes('1ER') || f.includes('PRIMER');
    if (t === '2DO PISO' || t.includes('2DO')) return f.includes('2DO') || f.includes('SEGUNDO');
    if (t === '3ER PISO' || t.includes('3ER')) return f.includes('3ER') || f.includes('TERCER');
    if (t === '4TO PISO' || t.includes('4TO')) return f.includes('4TO') || f.includes('CUARTO');
    if (t === '5TO PISO' || t.includes('5TO')) return f.includes('5TO') || f.includes('QUINTO');
    return f.includes(t);
  };

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
      if (onClearInitialSearch) onClearInitialSearch();
    }
  }, [initialSearch]);

  // In-situ Quick Attention Bottom Sheet (Saves 80% time by recording loan right here!)
  const asistentes = useAssistants();
  const [quickAttentionResponsable, setQuickAttentionResponsable] = useState('TAYRON SALINAS');
  const [quickAttentionItem, setQuickAttentionItem] = useState(null);
  const [quickAttentionBeneficiary, setQuickAttentionBeneficiary] = useState('DOCENTE');
  const [quickAttentionTipo, setQuickAttentionTipo] = useState('PROYECTOR');
  const [quickSelectedMaterials, setQuickSelectedMaterials] = useState(['PROYECTOR']);
  const [quickManualText, setQuickManualText] = useState('');
  const [quickAttentionNotes, setQuickAttentionNotes] = useState('');
  const [quickAttentionStatus, setQuickAttentionStatus] = useState('EN PROCESO'); // 'PENDIENTE' | 'EN PROCESO' | 'ATENDIDO'
  const [toastMessage, setToastMessage] = useState('');

  const toggleQuickMaterial = (id) => {
    setQuickSelectedMaterials(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter(m => m !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Observation Modal
  const [activeModalItem, setActiveModalItem] = useState(null);
  const [observationText, setObservationText] = useState('');
  const [replaceTeacherName, setReplaceTeacherName] = useState('');

  // Secondary Classroom Action Sheet (Discreet 3-dots menu)
  const [selectedClassOptions, setSelectedClassOptions] = useState(null);

  // Reservation Modal for Free Classrooms
  const [reservingRoom, setReservingRoom] = useState(null);
  const [reservationForm, setReservationForm] = useState({
    tipo: 'DOCENTE',
    nombre: '',
    fecha: new Date().toISOString().split('T')[0],
    horaInicio: '08:00',
    horaFin: '10:00',
    actividades: ''
  });
  const [savingReservation, setSavingReservation] = useState(false);

  const handleOpenReserveModal = (room) => {
    setReservingRoom(room);
    setReservationForm({
      tipo: 'DOCENTE',
      nombre: '',
      fecha: new Date().toISOString().split('T')[0],
      horaInicio: '08:00',
      horaFin: '10:00',
      actividades: ''
    });
  };

  const handleSaveReservation = async (e) => {
    if (e) e.preventDefault();
    if (!reservingRoom) return;
    if (!reservationForm.nombre.trim()) {
      alert('Por favor, ingresa el nombre del docente o alumno solicitante.');
      return;
    }
    setSavingReservation(true);
    try {
      const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
      const resDate = new Date(reservationForm.fecha + 'T12:00:00');
      const diaName = days[resDate.getDay()];

      const payload = {
        fecha: reservationForm.fecha,
        dia: diaName,
        inicio: reservationForm.horaInicio,
        final: reservationForm.horaFin,
        hora_inicio: reservationForm.horaInicio,
        hora_fin: reservationForm.horaFin,
        aula: reservingRoom.abrv,
        ubicacion: `${reservingRoom.piso || ''} - ${reservingRoom.pabellon || ''}`.replace(/^ - | - $/g, ''),
        docente: reservationForm.tipo === 'ALUMNO' 
          ? `[ALUMNO] ${reservationForm.nombre.trim().toUpperCase()}` 
          : reservationForm.nombre.trim().toUpperCase(),
        detalle: reservationForm.actividades.trim() || 'RESERVA DE AULA',
        motivo: reservationForm.actividades.trim() || 'RESERVA DE AULA',
        usuario: 'OPERACIONES',
        prioridad: 'NORMAL'
      };

      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        setToastMessage(`✅ Aula ${reservingRoom.abrv} reservada con éxito (${reservationForm.horaInicio} - ${reservationForm.horaFin})`);
        setReservingRoom(null);
        setReservationForm({
          tipo: 'DOCENTE',
          nombre: '',
          fecha: new Date().toISOString().split('T')[0],
          horaInicio: '08:00',
          horaFin: '10:00',
          actividades: ''
        });
      } else {
        alert('Error al guardar reserva: ' + (json.error || 'intente nuevamente'));
      }
    } catch (err) {
      console.error('Error guardando reserva:', err);
      alert('Error de conexión al guardar reserva');
    } finally {
      setSavingReservation(false);
    }
  };

  const pisosDisponibles = [
    { label: 'Todos', short: 'Todos', val: '' },
    { label: 'Sótano', short: 'Sót', val: 'SOT' },
    { label: 'Piso 1', short: 'P1', val: '1ER PISO' },
    { label: 'Piso 2', short: 'P2', val: '2DO PISO' },
    { label: 'Piso 3', short: 'P3', val: '3ER PISO' },
    { label: 'Piso 4', short: 'P4', val: '4TO PISO' },
    { label: 'Piso 5', short: 'P5', val: '5TO PISO' }
  ];

  // Quick Loan Chips for Attention Drawer (11 Materiales exactos solicitados + MANUAL)
  const commonLoanChips = [
    { id: "PROYECTOR", label: "PROYECTOR", icon: "📽️" },
    { id: "PUNTERO", label: "PUNTERO", icon: "🎯" },
    { id: "CABLE HDMI", label: "CABLE HDMI", icon: "🔌" },
    { id: "ADAPTADOR", label: "ADAPTADOR", icon: "⚡" },
    { id: "CUTTING", label: "CUTTING", icon: "🔪" },
    { id: "MOUSE", label: "MOUSE", icon: "🖱️" },
    { id: "CAMARA WEB", label: "CÁMARA WEB", icon: "📷" },
    { id: "CABLE DE RED", label: "CABLE DE RED", icon: "🌐" },
    { id: "AUDIFONOS", label: "AUDÍFONOS", icon: "🎧" },
    { id: "ADAPTADOR VGA/HDMI", label: "ADAPTADOR VGA/HDMI", icon: "🔌" },
    { id: "CAMARA DIGITAL", label: "CÁMARA DIGITAL", icon: "📸" },
    { id: "MANUAL", label: "OTRO / MANUAL", icon: "✏️" }
  ];

  // Official UPN Class Blocks matching SQLite CONTROL DOCENTE
  const REAL_BLOCKS = [
    { start: '07:30', end: '09:10', startM: 7 * 60 + 30, endM: 9 * 60 + 10 },
    { start: '09:10', end: '10:50', startM: 9 * 60 + 10, endM: 10 * 60 + 50 },
    { start: '10:50', end: '12:30', startM: 10 * 60 + 50, endM: 12 * 60 + 30 },
    { start: '12:30', end: '14:30', startM: 12 * 60 + 30, endM: 14 * 60 + 30 },
    { start: '14:30', end: '16:10', startM: 14 * 60 + 30, endM: 16 * 60 + 10 },
    { start: '16:10', end: '17:50', startM: 16 * 60 + 10, endM: 17 * 60 + 50 },
    { start: '17:50', end: '19:30', startM: 17 * 60 + 50, endM: 19 * 60 + 30 },
    { start: '19:30', end: '21:10', startM: 19 * 60 + 30, endM: 21 * 60 + 10 },
    { start: '21:10', end: '22:50', startM: 21 * 60 + 10, endM: 22 * 60 + 50 }
  ];

  const getCurrentHourBlock = () => {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const matched = REAL_BLOCKS.find(b => currentMins >= b.startM && currentMins < b.endM);
    if (matched) return matched.start;
    if (currentMins < 7 * 60 + 30) return '07:30';
    if (currentMins >= 14 * 60 && currentMins < 14 * 60 + 30) return '14:30';
    if (currentMins >= 19 * 60 + 30 && currentMins < 21 * 60 + 10) return '19:30';
    if (currentMins >= 21 * 60 + 10) return '21:10';
    return '19:30';
  };

  const getNextHourBlock = () => {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const next = REAL_BLOCKS.find(b => b.startM > currentMins);
    return next ? next.start : REAL_BLOCKS[0].start;
  };

  const dbChanged = useMemo(() => createDbChangeGate(), []);

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDia) params.append('dia', selectedDia);
      if (selectedPabellon) params.append('pabellon', selectedPabellon);
      if (selectedPisos.length > 0) params.append('piso', selectedPisos.join(','));

      if (blockMode === 'CURRENT') {
        params.append('hora', getCurrentHourBlock());
      } else if (blockMode === 'NEXT') {
        params.append('hora', getNextHourBlock());
      } else if (blockMode === 'RESTO') {
        params.append('hora_desde', getCurrentHourBlock());
      } else if (blockMode === 'CUSTOM' && selectedHora) {
        params.append('hora', selectedHora);
      }
      if (search) params.append('search', search);

      const res = await fetch(`/api/attendance?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Error fetching attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  // Multi-user silent background polling (keeps records synced without interrupting user)
  const silentRefreshAttendance = async () => {
    try {
      if (!(await dbChanged())) return; // sin escrituras nuevas -> no gastar lecturas de D1
      const params = new URLSearchParams();
      if (selectedDia) params.append('dia', selectedDia);
      if (selectedPabellon) params.append('pabellon', selectedPabellon);
      if (selectedPisos.length > 0) params.append('piso', selectedPisos.join(','));

      if (blockMode === 'CURRENT') {
        params.append('hora', getCurrentHourBlock());
      } else if (blockMode === 'NEXT') {
        params.append('hora', getNextHourBlock());
      } else if (blockMode === 'RESTO') {
        params.append('hora_desde', getCurrentHourBlock());
      } else if (blockMode === 'CUSTOM' && selectedHora) {
        params.append('hora', selectedHora);
      }
      if (search) params.append('search', search);

      const res = await fetch(`/api/attendance?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      // silent
    }
  };

  const loadRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      const json = await res.json();
      if (json.success) {
        setRooms(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadRooms();
    const handlePulled = () => loadAttendanceSilent();
    window.addEventListener('upn:excel-pulled', handlePulled);
    return () => window.removeEventListener('upn:excel-pulled', handlePulled);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (quickAttentionItem) setQuickAttentionItem(null);
        if (activeModalItem) setActiveModalItem(null);
        if (selectedClassOptions) setSelectedClassOptions(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickAttentionItem, activeModalItem, selectedClassOptions]);

  useEffect(() => {
    loadAttendance();
    const interval = setInterval(silentRefreshAttendance, 20000);
    return () => clearInterval(interval);
  }, [selectedDia, selectedPabellon, selectedPisos, selectedHora, blockMode, search]);

  const getCurrentTimeStr = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // 1-Tap Toggle Status Handler (If already active, resets to PENDIENTE for instant undo!)
  const handleQuickStatus = async (item, targetStatus) => {
    const isCurrentlyActive =
      (targetStatus === 'PUNTUAL' && item.puntualidad === 'PUNTUAL') ||
      (targetStatus === 'TARDE' && item.puntualidad === 'TARDE') ||
      (targetStatus === 'FALTA' && item.asistencia === 'NO');

    let updates = {};

    if (isCurrentlyActive) {
      // Toggle off -> Reset back to PENDIENTE
      updates = {
        asistencia: 'PENDIENTE',
        puntualidad: '',
        horaInicioReal: '',
        horaFinalReal: ''
      };
    } else if (targetStatus === 'PUNTUAL') {
      updates = {
        asistencia: 'SI',
        puntualidad: 'PUNTUAL',
        horaInicioReal: item.horaInicioProg || getCurrentTimeStr(),
        horaFinalReal: item.horaFinalProg || item.horaFinalReal || ''
      };
    } else if (targetStatus === 'TARDE') {
      updates = {
        asistencia: 'SI',
        puntualidad: 'TARDE',
        horaInicioReal: getCurrentTimeStr(),
        horaFinalReal: item.horaFinalProg || item.horaFinalReal || ''
      };
    } else if (targetStatus === 'FALTA') {
      updates = {
        asistencia: 'NO',
        puntualidad: '-',
        horaInicioReal: '-',
        horaFinalReal: '-'
      };
    }

    setData(prev => prev.map(c => (c.id === item.id ? { ...c, ...updates } : c)));

    try {
      await fetch(`/api/attendance/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Copiar Fila de Control de Asistencia en Formato de TABLA (HTML rico con bordes y colores + TSV para Excel)
  const handleCopyAttendanceRow = async (item) => {
    try {
      const { html, plain } = generateAttendanceTableData(item, selectedDia, selectedDayInfo?.dateStr);
      const ok = await copyRichTableToClipboard(plain, html);
      if (ok) {
        setToastMessage(`📋 Tabla copiada (${item.aula} - ${item.docente})`);
      } else {
        setToastMessage('❌ No se pudo copiar la tabla al portapapeles');
      }
      setTimeout(() => setToastMessage(''), 2500);
    } catch (err) {
      console.error('Error al copiar tabla:', err);
      setToastMessage('❌ Error al copiar tabla');
      setTimeout(() => setToastMessage(''), 2500);
    }
  };

  // Copiar Toda la Tabla de Asistencia Filtrada en Formato Tabla HTML + Excel
  const handleCopyAllAttendanceTable = async () => {
    try {
      if (displayedItems.length === 0) {
        setToastMessage('⚠️ No hay clases filtradas para copiar');
        setTimeout(() => setToastMessage(''), 2000);
        return;
      }
      const { html, plain } = generateAttendanceTableData(displayedItems, selectedDia, selectedDayInfo?.dateStr);
      const ok = await copyRichTableToClipboard(plain, html);
      if (ok) {
        setToastMessage(`📋 Tabla completa copiada (${displayedItems.length} filas en tabla)`);
      } else {
        setToastMessage('❌ No se pudo copiar la tabla');
      }
      setTimeout(() => setToastMessage(''), 2500);
    } catch (err) {
      console.error('Error copiando tabla completa:', err);
      setToastMessage('❌ Error al copiar tabla');
      setTimeout(() => setToastMessage(''), 2500);
    }
  };

  // Fast In-Situ Attention Recording (2 Taps!)
  const handleSaveQuickAttention = async (e) => {
    if (e) e.preventDefault();
    if (!quickAttentionItem) return;

    const personTag = quickAttentionBeneficiary === 'ALUMNO'
      ? '[🎓 ALUMNO]'
      : `[👨‍🏫 DOCENTE: ${quickAttentionItem.docente}]`;

    const selectedList = Array.isArray(quickSelectedMaterials) ? [...quickSelectedMaterials] : [];
    const filteredList = selectedList.filter(m => m !== 'MANUAL');
    if (selectedList.includes('MANUAL') && quickManualText.trim()) {
      filteredList.push(quickManualText.trim().toUpperCase());
    }
    const finalTipo = filteredList.length > 0 ? filteredList.join(', ') : 'PROYECTOR';

    const payload = {
      ambiente: quickAttentionItem.aula,
      pabellon: quickAttentionItem.aula.startsWith('B') ? 'B' : 'A',
      piso: quickAttentionItem.pisoPabellon || 'SEDE',
      tipoSolicitud: finalTipo,
      estado: quickAttentionStatus,
      usuario: quickAttentionBeneficiary,
      descripcionSolucion: `${personTag} ${quickAttentionNotes || `Préstamo de ${finalTipo} en aula ${quickAttentionItem.aula}`}`,
      responsable: quickAttentionResponsable || 'TAYRON SALINAS'
    };

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        setToastMessage(`✅ Atención registrada en Aula ${quickAttentionItem.aula}`);
        setTimeout(() => setToastMessage(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }

    setQuickAttentionItem(null);
    setQuickAttentionNotes('');
    setQuickSelectedMaterials(['PROYECTOR']);
    setQuickManualText('');
  };

  const handleSaveObservation = async () => {
    if (!activeModalItem) return;

    let updates = {};
    const suplente = replaceTeacherName.trim().toUpperCase();

    if (suplente) {
      updates.asistencia = 'SI (DOCENTE REEMPLAZO)';
      updates.puntualidad = 'PUNTUAL';
      updates.observacion = observationText.trim()
        ? `Reemplazo: ${suplente} | Obs: ${observationText.trim()}`
        : `Reemplazo: ${suplente}`;
    } else {
      updates.observacion = observationText.trim();
    }

    setData(prev => prev.map(c => (c.id === activeModalItem.id ? { ...c, ...updates } : c)));

    try {
      await fetch(`/api/attendance/${activeModalItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      // Si se registró un Docente de Reemplazo desde Asistencia, sincronizarlo también en Hojas Manuales
      // para que figure automáticamente en la columna "DOCENTE REEMPLAZANTE" al exportar el Excel
      if (suplente) {
        await fetch('/api/manual-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fecha: new Date().toISOString().split('T')[0],
            nrc: activeModalItem.nrc || '',
            docente: activeModalItem.docente || '',
            curso: activeModalItem.curso || '',
            carrera: activeModalItem.carrera || '',
            aula: activeModalItem.aula || '',
            hora_inicio: activeModalItem.horaInicioProg || '',
            hora_fin: activeModalItem.horaFinalProg || '',
            periodo: activeModalItem.periodo || '2026-2',
            motivo: `DOCENTE DE REEMPLAZO (${suplente})`,
            docenteReemplazo: suplente,
            detalle: `Docente Titular: ${activeModalItem.docente || ''} | Reemplaza: ${suplente}`,
            asistente: 'TAYRON SALINAS'
          })
        });
        setToastMessage(`✅ Docente de reemplazo "${suplente}" registrado en hoja manual y Excel`);
        setTimeout(() => setToastMessage(''), 3500);
      }
    } catch (err) {
      console.error('Error saving observation:', err);
    }

    setActiveModalItem(null);
    setObservationText('');
    setReplaceTeacherName('');
  };

  // Metrics computation
  const countTotal = data.length;
  const countPuntual = data.filter(c => c.puntualidad === 'PUNTUAL').length;
  const countTarde = data.filter(c => c.puntualidad === 'TARDE').length;
  const countFalta = data.filter(c => c.asistencia === 'NO').length;
  const countReemplazo = data.filter(c => c.asistencia && c.asistencia.includes('REEMPLAZO')).length;
  const countPendientes = data.filter(c => c.asistencia === 'PENDIENTE' || (!c.asistencia && !c.puntualidad)).length;
  const countPendiente = countPendientes;

  // Filter items by statusFilter when user clicks on counter pills
  const displayedItems = useMemo(() => {
    return data.filter(c => {
      if (selectedCarrera && String(c.carrera || '').trim() !== selectedCarrera) return false;
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PENDING' || statusFilter === 'PENDIENTE') {
        return c.asistencia === 'PENDIENTE' || (!c.asistencia && !c.puntualidad);
      }
      if (statusFilter === 'PUNTUAL') return c.puntualidad === 'PUNTUAL';
      if (statusFilter === 'TARDE') return c.puntualidad === 'TARDE';
      if (statusFilter === 'FALTA') return c.asistencia === 'NO';
      return true;
    });
  }, [data, statusFilter, selectedCarrera]);

  // Compute Free Classrooms (Aulas Libres en este momento)
  const freeRooms = useMemo(() => {
    const busyRoomCodes = new Set(data.map(c => (c.aula || '').toUpperCase().trim()));
    return rooms.filter(r => {
      if (selectedPabellon && r.pabellon !== selectedPabellon) return false;
      if (selectedPisos.length > 0) {
        const matchesAnyPiso = selectedPisos.some(p => matchesPiso(r.piso, p));
        if (!matchesAnyPiso) return false;
      }
      return !busyRoomCodes.has((r.abrv || '').toUpperCase().trim());
    });
  }, [data, rooms, selectedPabellon, selectedPisos]);

  return (
    <div className="space-y-4 pb-36 md:pb-12">
      {/* Toast Notification Alert - Portaled to viewport body so it never scrolls out of view */}
      {toastMessage && (
        <ToastBanner
          message={toastMessage}
          onClose={() => setToastMessage('')}
        />
      )}

      {/* Controlador Compacto, Ágil y Rápido */}
      <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-2.5 sm:p-3.5 shadow-xs space-y-2 transition-colors">
        {/* Fila 1: Selector de Día con Fechas Exactas y Badge HOY */}
        <div className="grid grid-cols-7 gap-1 w-full">
          {weekDaysWithDates.map((item) => {
            const isSelected = selectedDia === item.name;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => setSelectedDia(item.name)}
                className={`h-9 sm:h-10 text-[10px] sm:text-xs font-bold rounded-xl transition-all flex flex-col items-center justify-center active:scale-95 leading-tight ${
                  isSelected
                    ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs ring-2 ring-[#FDBA30]/50'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/60 dark:border-zinc-800'
                }`}
                title={`${item.name} (${item.dateStr})`}
              >
                <div className="flex items-center gap-0.5">
                  <span className="font-extrabold">{item.short}</span>
                  {item.isToday && (
                    <span className="text-[7px] font-black px-1 rounded-sm bg-emerald-600 text-white leading-none py-0.5">
                      HOY
                    </span>
                  )}
                </div>
                <span className={`text-[9px] font-mono tracking-tight ${isSelected ? 'text-slate-950 font-black' : 'text-slate-500 dark:text-zinc-400'}`}>
                  {item.shortDate}
                </span>
              </button>
            );
          })}
        </div>

        {/* Banner Informativo de Fecha Exacta Seleccionada */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-900/60 rounded-xl border border-slate-200/60 dark:border-zinc-800/80 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 font-bold capitalize">
            <Calendar className="w-3.5 h-3.5 text-[#FDBA30] shrink-0" />
            <span>{selectedDayInfo?.fullLabel || selectedDia}</span>
            {selectedDayInfo?.isToday && (
              <span className="text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded-full border border-emerald-300 dark:border-emerald-700">
                Día Actual
              </span>
            )}
            {selectedDayInfo?.isFuture && (
              <span className="text-[9px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded-full border border-amber-300 dark:border-amber-700">
                Día Próximo
              </span>
            )}
          </div>
          {selectedDayInfo?.isFuture && countPuntual > 0 && (
            <button
              type="button"
              onClick={handleResetDayToPending}
              className="text-[10px] font-black bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 px-2 py-0.5 rounded-lg transition active:scale-95 flex items-center gap-1 shadow-2xs"
              title="Limpiar marcas pasadas que no correspondan a este día"
            >
              <RotateCcw className="w-3 h-3 stroke-[2.4]" />
              <span>Restablecer día a Pendiente ({countPuntual})</span>
            </button>
          )}
        </div>

        {/* Fila 2: Buscador + Pabellón + Pisos integrados */}
        <div className="flex flex-col sm:flex-row items-center gap-1.5">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 stroke-[2.2]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar aula (A201), docente..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FDBA30] transition font-bold"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Pabellón Pills */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-slate-200/60 dark:border-zinc-800 shrink-0 w-full sm:w-auto">
            {['', 'A', 'B'].map((pab) => (
              <button
                key={pab || 'ALL'}
                type="button"
                onClick={() => setSelectedPabellon(pab)}
                className={`flex-1 sm:flex-initial h-7 px-2.5 rounded-lg text-xs font-bold transition active:scale-95 ${selectedPabellon === pab
                    ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white font-black shadow-2xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
                  }`}
              >
                {pab ? `Pab. ${pab}` : 'Ambos'}
              </button>
            ))}
          </div>

          {/* Pisos Pills (Selección Múltiple: Permite filtrar varios pisos a la vez) */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none w-full sm:w-auto shrink-0 py-0.5">
            {pisosDisponibles.map((p) => {
              const isTodos = p.val === '';
              const isSelected = isTodos
                ? selectedPisos.length === 0
                : selectedPisos.includes(p.val);

              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleTogglePiso(p.val)}
                  className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition active:scale-95 shrink-0 inline-flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                      : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title={isTodos ? 'Mostrar todos los pisos' : `Filtrar ${p.label} (puedes activar varios)`}
                >
                  <span>{p.short}</span>
                  {!isTodos && isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Fila 2b: Filtro rápido por Carrera / Facultad */}
        {carrerasUnicas.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 shrink-0 whitespace-nowrap">Carrera:</span>
            <button
              type="button"
              onClick={() => setSelectedCarrera('')}
              className={`h-6 px-2.5 rounded-lg text-[10px] font-bold transition active:scale-95 shrink-0 whitespace-nowrap ${selectedCarrera === ''
                ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800'
              }`}
            >
              Todas
            </button>
            {carrerasUnicas.map((car) => {
              const isSel = selectedCarrera === car;
              return (
                <button
                  key={car}
                  type="button"
                  onClick={() => setSelectedCarrera(isSel ? '' : car)}
                  className={`h-6 px-2.5 rounded-lg text-[10px] font-bold transition active:scale-95 shrink-0 whitespace-nowrap ${isSel
                    ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                    : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800'
                  }`}
                  title={car}
                >
                  {car}
                </button>
              );
            })}
          </div>
        )}

        {/* Fila 3: Modos Rápidos + Contadores KPI de Estado en 1 Sola Línea */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setBlockMode(blockMode === 'CURRENT' ? 'ALL' : 'CURRENT');
                setSelectedHora('');
              }}
              className={`h-7 px-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95 ${blockMode === 'CURRENT'
                  ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                  : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
            >
              <Clock className="w-3 h-3 text-amber-500 stroke-[2.4]" />
              <span>Actual ({getCurrentHourBlock()})</span>
            </button>

            <button
              onClick={() => {
                setBlockMode(blockMode === 'NEXT' ? 'ALL' : 'NEXT');
                setSelectedHora('');
              }}
              className={`h-7 px-2 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95 ${blockMode === 'NEXT'
                  ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                  : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
            >
              <span>Sig.</span>
            </button>

            <button
              onClick={() => {
                setViewMode(viewMode === 'FREE_ROOMS' ? 'CLASSES' : 'FREE_ROOMS');
                window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
              }}
              className={`h-7 px-2 rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95 ${viewMode === 'FREE_ROOMS'
                  ? 'bg-emerald-600 text-white font-black shadow-2xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                }`}
            >
              <DoorOpen className="w-3 h-3" />
              <span>Libres ({freeRooms.length})</span>
            </button>
          </div>

          {/* Pastillas KPI para filtrar con 1 toque */}
          <div className="flex items-center gap-1 text-[11px]">
            <button
              onClick={() => {
                setViewMode('CLASSES');
                setStatusFilter(statusFilter === 'PUNTUAL' ? 'ALL' : 'PUNTUAL');
              }}
              className={`h-7 px-2 rounded-lg font-bold transition active:scale-95 ${statusFilter === 'PUNTUAL'
                  ? 'bg-emerald-600 text-white font-black'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                }`}
            >
              ✓ {countPuntual}
            </button>

            <button
              onClick={() => {
                setViewMode('CLASSES');
                setStatusFilter(statusFilter === 'TARDE' ? 'ALL' : 'TARDE');
              }}
              className={`h-7 px-2 rounded-lg font-bold transition active:scale-95 ${statusFilter === 'TARDE'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                }`}
            >
              🕒 {countTarde}
            </button>

            <button
              onClick={() => {
                setViewMode('CLASSES');
                setStatusFilter(statusFilter === 'FALTA' ? 'ALL' : 'FALTA');
              }}
              className={`h-7 px-2 rounded-lg font-bold transition active:scale-95 ${statusFilter === 'FALTA'
                  ? 'bg-rose-600 text-white font-black'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                }`}
            >
              ✕ {countFalta}
            </button>

            <button
              onClick={() => {
                setViewMode('CLASSES');
                setStatusFilter(statusFilter === 'PENDIENTE' ? 'ALL' : 'PENDIENTE');
              }}
              className={`h-7 px-2 rounded-lg font-bold transition active:scale-95 ${statusFilter === 'PENDIENTE'
                  ? 'bg-slate-800 text-white dark:bg-zinc-700 font-black shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400'
                }`}
            >
              Pend: {countPendiente}
            </button>
          </div>
        </div>

        {/* Fila 4: Bloques de hora horizontales (Discretos) */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none text-[11px]">
          <button
            onClick={() => {
              setBlockMode('ALL');
              setSelectedHora('');
            }}
            className={`h-6 px-2.5 rounded-md font-bold transition whitespace-nowrap active:scale-95 ${blockMode === 'ALL' && !selectedHora
                ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
          >
            Todo
          </button>
          {REAL_BLOCKS.map(b => {
            const isSelected = blockMode === 'CUSTOM' && selectedHora === b.start;
            const isCurrent = b.start === getCurrentHourBlock();
            return (
              <button
                key={b.start}
                onClick={() => {
                  if (isSelected) {
                    setBlockMode('ALL');
                    setSelectedHora('');
                  } else {
                    setBlockMode('CUSTOM');
                    setSelectedHora(b.start);
                  }
                }}
                className={`h-6 px-2 rounded-md font-mono font-bold transition whitespace-nowrap active:scale-95 ${isSelected
                    ? 'bg-[#FDBA30] text-slate-950 font-black'
                    : isCurrent
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300'
                      : 'bg-slate-100/70 dark:bg-zinc-900/80 text-slate-600 dark:text-zinc-400'
                  }`}
              >
                {b.start}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Filter Pill indicator if statusFilter != 'ALL' */}
      {statusFilter !== 'ALL' && viewMode !== 'FREE_ROOMS' && (
        <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-zinc-900/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800">
          <span className="text-slate-600 dark:text-zinc-300 font-medium">
            Filtrando por estado: <strong className="text-slate-900 dark:text-white font-bold uppercase">{statusFilter}</strong>
          </span>
          <button
            onClick={() => setStatusFilter('ALL')}
            className="text-amber-700 dark:text-amber-400 hover:text-amber-800 text-[11px] font-bold inline-flex items-center gap-1"
          >
            <span>Ver todas ({countTotal})</span>
            <X className="w-3 h-3 stroke-[2.2]" />
          </button>
        </div>
      )}

      {/* Active Schedule Mode Indicator if blockMode != 'ALL' */}
      {blockMode !== 'ALL' && viewMode !== 'FREE_ROOMS' && (
        <div className="flex items-center justify-between text-xs bg-amber-50/70 dark:bg-amber-950/30 px-3 py-1.5 rounded-xl border border-amber-200/80 dark:border-amber-800/60">
          <span className="text-amber-950 dark:text-amber-200 font-medium">
            Horario: <strong className="font-bold">
              {blockMode === 'RESTO'
                ? `Próximas horas / Resto del día (desde las ${getCurrentHourBlock()})`
                : blockMode === 'CURRENT'
                  ? `Bloque actual (${getCurrentHourBlock()})`
                  : blockMode === 'NEXT'
                    ? `Bloque siguiente (${getNextHourBlock()})`
                    : `Bloque ${selectedHora}`}
            </strong>
          </span>
          <button
            onClick={() => {
              setBlockMode('ALL');
              setSelectedHora('');
            }}
            className="text-amber-800 dark:text-amber-300 hover:underline text-[11px] font-bold inline-flex items-center gap-1"
          >
            <span>Ver todo el día</span>
            <X className="w-3 h-3 stroke-[2.2]" />
          </button>
        </div>
      )}

      {/* Active Floor Filter Pill indicator if selectedPisos.length > 0 */}
      {selectedPisos.length > 0 && viewMode !== 'FREE_ROOMS' && (
        <div className="flex items-center justify-between text-xs bg-amber-50/70 dark:bg-amber-950/30 px-3 py-1.5 rounded-xl border border-amber-200/80 dark:border-amber-800/60">
          <span className="text-amber-950 dark:text-amber-200 font-medium">
            Filtrando {selectedPisos.length === 1 ? 'piso' : 'pisos'}: <strong className="font-bold">
              {pisosDisponibles.filter(p => selectedPisos.includes(p.val)).map(p => p.short).join(' + ')}
            </strong>
          </span>
          <button
            onClick={() => setSelectedPisos([])}
            className="text-amber-800 dark:text-amber-300 hover:underline text-[11px] font-bold inline-flex items-center gap-1"
          >
            <span>Ver todos los pisos</span>
            <X className="w-3 h-3 stroke-[2.2]" />
          </button>
        </div>
      )}

      {/* VIEW MODE 1: FREE ROOMS (Aulas Disponibles / Libres Ahora) */}
  {
    viewMode === 'FREE_ROOMS' ? (
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/70 p-3 rounded-2xl">
          <div className="flex items-center gap-2 min-w-0">
            <DoorOpen className="w-5 h-5 text-emerald-700 dark:text-emerald-400 stroke-[2.2] shrink-0" />
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 leading-tight">Aulas Disponibles / Libres en este Horario</h3>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-tight mt-0.5">Espacios sin clase programada listos para préstamo o talleres</p>
            </div>
          </div>
          <button
            onClick={() => {
              setViewMode('CLASSES');
              window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
            }}
            className="text-xs font-bold bg-white dark:bg-zinc-800 text-emerald-900 dark:text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 shadow-2xs whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            Volver a Clases
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-3.5">
          {freeRooms.map(room => (
            <div
              key={room.abrv}
              onClick={() => handleOpenReserveModal(room)}
              className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between cursor-pointer transition-all duration-150 active:scale-98 group"
              title="Haz clic para registrar la reserva de esta aula"
            >
              <div>
                <div className="flex items-start justify-between gap-1.5 mb-2">
                  <span className="font-mono font-black text-sm bg-slate-900 dark:bg-zinc-800 group-hover:bg-[#FDBA30] group-hover:text-slate-950 text-white px-2.5 py-0.5 rounded-xl transition-colors">
                    {room.abrv}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    LIBRE
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-800 dark:text-white break-words mb-1 group-hover:text-amber-500 transition-colors">
                  {room.nombre}
                </h4>
                <span className="inline-block text-[10px] font-semibold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md mb-2.5 border border-blue-200/60 dark:border-blue-800/60">
                  {room.tipo} · Pab. {room.pabellon} ({room.piso})
                </span>

                <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-zinc-900/80 p-2 rounded-xl border border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Capacidad: <strong className="text-slate-900 dark:text-white">{room.aforo} pers.</strong></span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase font-mono">
                    {room.abrv}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenReserveModal(room);
                  }}
                  className="w-full mt-2.5 h-8 bg-amber-400 hover:bg-[#FDBA30] active:bg-amber-500 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <CalendarPlus className="w-3.5 h-3.5 stroke-[2.4]" />
                  <span>Reservar Aula</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : (
    /* VIEW MODE 2: CLASS ATTENDANCE CARDS */
    loading ? (
      <div className="text-center py-20 bg-white dark:bg-[#0c0c0f] rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Cargando programación de aulas...</p>
      </div>
    ) : displayedItems.length === 0 ? (
      <div className="text-center py-16 bg-white dark:bg-[#0c0c0f] rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-xs px-4">
        <Building className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2 stroke-[1.8]" />
        <p className="text-sm font-bold text-slate-800 dark:text-white">
          {(statusFilter === 'PENDING' || statusFilter === 'PENDIENTE') ? '¡Excelente trabajo! No hay aulas pendientes' : 'No se encontraron clases'}
        </p>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          {statusFilter !== 'ALL'
            ? 'Todas las clases de este bloque han sido verificadas con éxito.'
            : 'Prueba cambiando el piso, pabellón o filtro de búsqueda.'}
        </p>
        {statusFilter !== 'ALL' && (
          <button
            onClick={() => setStatusFilter('ALL')}
            className="mt-3 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition"
          >
            Restablecer Filtro
          </button>
        )}
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-3 sm:gap-3.5">
        {displayedItems.map(item => {
          const isPuntual = item.puntualidad === 'PUNTUAL';
          const isTarde = item.puntualidad === 'TARDE';
          const isFalta = item.asistencia === 'NO';
          const isReemplazo = item.asistencia && item.asistencia.includes('REEMPLAZO');
          const isPendiente = !isPuntual && !isTarde && !isFalta && !isReemplazo;

          return (
            <div
              key={item.id}
              className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-3 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Top Bar: Aula, Pabellón, Estado y Menú 3 puntos */}
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.aula && item.aula.trim() ? (
                      <span className="font-mono font-black text-xs sm:text-sm bg-slate-900 dark:bg-zinc-800 text-white px-2 py-0.5 rounded-lg shadow-xs tracking-tight">
                        {item.aula}
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-xs bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded-lg shadow-xs tracking-tight">
                        S/A
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-200 uppercase bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 px-1.5 py-0.5 rounded-md">
                      {item.pisoPabellon || 'Campus'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Botón Copiar Fila para Excel (solo las que ya están llenas: puntual, tarde, falta) */}
                    {(isPuntual || isTarde || isFalta || isReemplazo) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyAttendanceRow(item);
                        }}
                        className="h-6 px-2 rounded-lg text-[10px] font-black bg-amber-100 hover:bg-[#FDBA30] text-amber-950 hover:text-slate-950 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700/80 transition flex items-center gap-1 active:scale-95 shadow-2xs"
                        title="Copiar fila para Excel / correo"
                      >
                        <Copy className="w-3 h-3 stroke-[2.4]" />
                        <span>Copiar</span>
                      </button>
                    )}
                    {isTarde && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black bg-[#FDBA30] text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                        <Clock className="w-3 h-3 text-slate-950 stroke-[2.4] shrink-0" />
                        <span>TARDE{item.horaInicioReal ? ` (${item.horaInicioReal})` : ''}</span>
                      </span>
                    )}
                    {isFalta && (
                      <span className="inline-flex items-center justify-center font-mono font-black text-xs text-white bg-zinc-900 border border-zinc-600 px-3 py-0.5 rounded-full shadow-xs" title="Falta (-)">
                        -
                      </span>
                    )}
                    {isReemplazo && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800/70">
                        <UserCheck className="w-3 h-3 text-purple-600 dark:text-purple-400 stroke-[2.4] shrink-0" />
                        <span>REEMPLAZO</span>
                      </span>
                    )}
                    {isPendiente && (
                      <span className="text-[10px] font-bold bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 px-2 py-0.5 rounded-full border border-slate-200 dark:border-zinc-800">
                        PENDIENTE
                      </span>
                    )}

                    {/* Menú de Acciones Rápidas (Observación / Hoja / Préstamo) */}
                    <button
                      type="button"
                      onClick={() => setSelectedClassOptions(item)}
                      className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition inline-flex items-center justify-center active:scale-90"
                      title="Más opciones de aula"
                    >
                      <MoreVertical className="w-4 h-4 stroke-[2]" />
                    </button>
                  </div>
                </div>

                {/* Docente, Curso y Horario (Líneas legibles sin cortes) */}
                <div className="mb-2">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white break-words leading-snug" title={item.docente}>
                    {item.docente}
                  </h3>
                  <div className="flex items-start justify-between gap-2 text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                    <span className="break-words leading-tight" title={item.curso}>{item.curso}</span>
                    <span className="font-mono text-xs bg-slate-100 dark:bg-zinc-900 text-slate-800 dark:text-zinc-100 px-2.5 py-0.5 rounded-lg border border-slate-200/90 dark:border-zinc-700 shrink-0 font-black tracking-tight shadow-2xs">
                      NRC {item.nrc}
                    </span>
                  </div>

                  {item.carrera && (
                    <div className="flex items-center gap-2 text-[10px] font-bold mt-1">
                      <span className="bg-slate-50 dark:bg-zinc-900/80 text-slate-600 dark:text-zinc-300 px-2 py-0.5 rounded border border-slate-200/80 dark:border-zinc-700">
                        Carrera
                      </span>
                      <span className="text-slate-700 dark:text-zinc-200 break-words leading-tight" title={item.carrera}>
                        {item.carrera}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-zinc-400 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-zinc-800">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 shrink-0" />
                      <span className="text-slate-700 dark:text-zinc-300 font-bold">{item.horaInicioProg} - {item.horaFinalProg}</span>
                    </span>
                    {isTarde && item.horaInicioReal && (
                      <span className="text-amber-950 dark:text-amber-300 font-extrabold bg-[#FDBA30]/20 dark:bg-amber-950/80 px-2 py-0.5 rounded-md text-[10px] border border-amber-400/80 dark:border-amber-700 shadow-2xs">
                        Inicio Real: {item.horaInicioReal}
                      </span>
                    )}
                  </div>

                  {/* Observación Compacta (Clic para editar) */}
                  {item.observacion && (
                    <div
                      onClick={() => {
                        setActiveModalItem(item);
                        setObservationText(item.observacion || '');
                        setReplaceTeacherName('');
                      }}
                      className="mt-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100/80 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 rounded-lg text-[10px] font-semibold flex items-start gap-1 cursor-pointer transition active:scale-98"
                      title="Toca para editar observación"
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span className="break-words leading-snug">{item.observacion}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Fila Única y Simétrica de Toma de Asistencia (100% Adaptada a Modo Claro y Oscuro AMOLED) */}
              <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-100 dark:border-zinc-800">
                <button
                  onClick={() => handleQuickStatus(item, 'PUNTUAL')}
                  className={`h-10 rounded-2xl font-bold text-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95 ${isPuntual
                      ? 'bg-[#00875A] text-white border border-[#00875A] shadow-md font-black'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 dark:bg-[#061d15] dark:text-[#10b981] dark:border-[#059669]/60 dark:hover:bg-[#059669]/20'
                    }`}
                  title={isPuntual ? 'Toca para desmarcar' : 'Marcar puntual'}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 stroke-[2.4] shrink-0 ${isPuntual ? 'text-white' : 'text-emerald-700 dark:text-[#10b981]'}`} />
                  <span>Puntual</span>
                </button>

                <button
                  onClick={() => handleQuickStatus(item, 'TARDE')}
                  className={`h-10 rounded-2xl font-bold text-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95 ${isTarde
                      ? 'bg-[#FDBA30] text-slate-950 border border-[#FDBA30] font-black shadow-md'
                      : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 dark:bg-[#1c1204] dark:text-[#f59e0b] dark:border-[#d97706] dark:hover:bg-[#d97706]/20'
                    }`}
                  title={isTarde ? 'Toca para desmarcar' : 'Marcar tardanza'}
                >
                  <Clock className={`w-3.5 h-3.5 stroke-[2.4] shrink-0 ${isTarde ? 'text-slate-950' : 'text-amber-800 dark:text-[#f59e0b]'}`} />
                  <span>{isTarde && item.horaInicioReal ? `Tarde (${item.horaInicioReal})` : 'Tarde'}</span>
                </button>

                <button
                  onClick={() => handleQuickStatus(item, 'FALTA')}
                  className={`h-10 rounded-2xl font-bold text-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95 ${isFalta
                      ? 'bg-rose-600 text-white border border-rose-600 font-black shadow-md'
                      : 'bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100 dark:bg-[#1e0810] dark:text-[#fda4af] dark:border-[#9f1239] dark:hover:bg-[#9f1239]/20'
                    }`}
                  title={isFalta ? 'Toca para desmarcar' : 'Marcar falta'}
                >
                  {isFalta ? (
                    <span className="text-white font-mono font-black text-base">-</span>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 stroke-[2.4] shrink-0 text-rose-700 dark:text-[#fda4af]" />
                      <span>Falta</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )
  )
  }

  {/* SECONDARY CLASSROOM ACTIONS SHEET (3-Dots Menu) */ }
  {
    selectedClassOptions && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-backdrop-fade"
        onClick={() => setSelectedClassOptions(null)}
      >
        <div
          className="bg-white dark:bg-[#0c0c10] rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-zinc-800 animate-spring-up space-y-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <span className="font-mono font-black text-xs bg-slate-900 dark:bg-zinc-800 text-white px-2.5 py-1 rounded-xl shadow-xs shrink-0">
                {selectedClassOptions.aula || 'S/A'}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-900 dark:text-white break-words leading-tight">{selectedClassOptions.docente}</div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono break-words mt-0.5">NRC {selectedClassOptions.nrc} · {selectedClassOptions.curso}{selectedClassOptions.carrera ? ' · ' + selectedClassOptions.carrera : ''}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedClassOptions(null)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition flex items-center justify-center active:scale-90 shrink-0"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          <div className="space-y-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                const item = selectedClassOptions;
                setSelectedClassOptions(null);
                setActiveModalItem(item);
                setObservationText(item.observacion || '');
                setReplaceTeacherName('');
              }}
              className="w-full p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200/90 dark:border-zinc-800 text-left flex items-center gap-3 transition active:scale-98"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white">Añadir Observación o Suplente</div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-400 break-words leading-tight mt-0.5">Registrar motivo, licencia o docente de reemplazo</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                const item = selectedClassOptions;
                setSelectedClassOptions(null);
                if (onEmitManualSheet) {
                  onEmitManualSheet(item);
                }
              }}
              className="w-full p-3 rounded-2xl bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/70 border border-indigo-200/90 dark:border-indigo-800/80 text-left flex items-center gap-3 transition active:scale-98"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200">Ir a Hoja de Asistencia Manual</div>
                <div className="text-[10px] text-indigo-600 dark:text-indigo-300 break-words leading-tight mt-0.5">Generar boleta prellenada en su apartado</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                const item = selectedClassOptions;
                setSelectedClassOptions(null);
                if (onOpenNewTicket) {
                  onOpenNewTicket({
                    ambiente: item.aula,
                    pabellon: item.aula?.startsWith('B') ? 'B' : 'A',
                    tipo: 'PLUMONES / MATERIALES',
                    descripcion: `[👨‍🏫 DOCENTE: ${item.docente}] Préstamo en aula ${item.aula}`
                  });
                }
              }}
              className="w-full p-3 rounded-2xl bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 border border-amber-200/90 dark:border-amber-800/80 text-left flex items-center gap-3 transition active:scale-98"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-300 flex items-center justify-center shrink-0">
                <HandHelping className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-amber-950 dark:text-amber-200">Registrar Préstamo de Material</div>
                <div className="text-[10px] text-amber-700 dark:text-amber-300 break-words leading-tight mt-0.5">Entrega de plumones, cable HDMI, llave o accesorios para esta aula</div>
              </div>
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  {/* IN-SITU QUICK ATTENTION DRAWER (Apple-Style Liquid Glass Bottom Sheet) */ }
  {
    quickAttentionItem && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4 animate-backdrop-fade"
        onClick={() => setQuickAttentionItem(null)}
      >
        <div
          className="apple-liquid-modal rounded-t-[32px] sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl safe-bottom max-h-[90vh] overflow-y-auto animate-spring-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-slate-300/80 rounded-full mx-auto mb-3.5 sm:hidden"></div>

          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 inline-flex items-center justify-center shadow-2xs">
                <HandHelping className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Atención Rápida en Aula
                </h3>
                <p className="text-xs text-slate-500">
                  Aula <strong className="text-slate-800 font-mono">{quickAttentionItem.aula}</strong> · {quickAttentionItem.docente}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setQuickAttentionItem(null)}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition inline-flex items-center justify-center active:scale-90"
            >
              <X className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>

          {/* Beneficiario Toggle: Docente vs Alumno */}
          <div className="flex items-center justify-between bg-slate-100/90 p-1.5 rounded-2xl mb-3 border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-600 pl-1">Entregar a:</span>
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => setQuickAttentionBeneficiary('DOCENTE')}
                className={`h-7 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95 ${quickAttentionBeneficiary === 'DOCENTE'
                    ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <span>👨‍🏫 Docente</span>
              </button>
              <button
                type="button"
                onClick={() => setQuickAttentionBeneficiary('ALUMNO')}
                className={`h-7 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1 active:scale-95 ${quickAttentionBeneficiary === 'ALUMNO'
                    ? 'bg-[#FDBA30] text-slate-950 font-black shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <span>🎓 Alumno</span>
              </button>
            </div>
          </div>

          {/* Quick Preset Material Chips (11 Materiales exactos + MANUAL con multiselección) */}
          <div className="space-y-1.5 mb-3.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                Material a Prestar (Multiselección):
              </label>
              <span className="text-[10px] font-mono font-bold text-amber-500 truncate max-w-[200px]">
                {quickSelectedMaterials.join(', ')}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {commonLoanChips.map(chip => {
                const isSelected = quickSelectedMaterials.includes(chip.id);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => toggleQuickMaterial(chip.id)}
                    className={`text-left text-xs font-bold px-2.5 py-2 rounded-xl border transition-all duration-150 flex items-center justify-between active:scale-95 ${isSelected
                        ? 'bg-[#FDBA30] text-slate-950 border-amber-400 font-black shadow-xs ring-1 ring-amber-400'
                        : 'bg-white/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200/80 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700'
                      }`}
                  >
                    <span className="truncate">{chip.icon} {chip.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.8] shrink-0 text-slate-950" />}
                  </button>
                );
              })}
            </div>

            {quickSelectedMaterials.includes('MANUAL') && (
              <div className="mt-2">
                <input
                  type="text"
                  value={quickManualText}
                  onChange={(e) => setQuickManualText(e.target.value)}
                  placeholder="Escribe el material solicitado manualmente (ej. PARLANTE, EXTENSIÓN)..."
                  className="w-full text-xs font-bold px-3 py-2 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FDBA30]"
                />
              </div>
            )}
          </div>

          {/* Detail notes & Assistant selector */}
          <div className="space-y-2.5 mb-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight mb-1">
                Responsable / Asistente
              </label>
              <CustomSelect
                value={quickAttentionResponsable}
                onChange={setQuickAttentionResponsable}
                options={asistentes}
                placeholder="Seleccionar asistente"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight mb-1">
                Detalle / Observación
              </label>
              <input
                type="text"
                value={quickAttentionNotes}
                onChange={(e) => setQuickAttentionNotes(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FDBA30]/30 focus:border-[#FDBA30] transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-600">Estado:</span>
              <button
                type="button"
                onClick={() => setQuickAttentionStatus('EN PROCESO')}
                className={`px-3 py-1 text-xs font-bold rounded-full border transition-all active:scale-95 ${quickAttentionStatus === 'EN PROCESO' ? 'bg-blue-600 text-white border-blue-600 shadow-2xs' : 'bg-slate-50 text-slate-600'
                  }`}
              >
                En Préstamo
              </button>
              <button
                type="button"
                onClick={() => setQuickAttentionStatus('ATENDIDO')}
                className={`px-3 py-1 text-xs font-bold rounded-full border transition-all active:scale-95 ${quickAttentionStatus === 'ATENDIDO' ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs' : 'bg-slate-50 text-slate-600'
                  }`}
              >
                Concluido
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setQuickAttentionItem(null)}
              className="h-11 rounded-2xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition inline-flex items-center justify-center active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveQuickAttention}
              className="h-11 rounded-2xl text-xs font-bold bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-[0_4px_16px_rgba(253,186,48,0.35)] transition inline-flex items-center justify-center active:scale-95"
            >
              Registrar Atención
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  {/* Observation / Suplente Modal - 100% Symmetrical with Full AMOLED Dark Mode */ }
  {
    activeModalItem && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-backdrop-fade"
        onClick={() => setActiveModalItem(null)}
      >
        <div
          className="bg-white dark:bg-[#0c0c10] rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-zinc-800 animate-spring-up overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 mb-4">
            <div className="min-w-0 pr-2">
              <h3 className="text-base font-black text-slate-950 dark:text-white tracking-tight leading-tight">
                Observación o Suplente
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 break-words mt-0.5">
                Aula <strong className="text-slate-900 dark:text-amber-400 font-mono">{activeModalItem.aula || 'S/A'}</strong> · {activeModalItem.docente}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModalItem(null)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition flex items-center justify-center active:scale-90 shrink-0"
              title="Cerrar ventana"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          <div className="space-y-3.5 mb-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Docente de Reemplazo (Opcional)
              </label>
              <input
                type="text"
                value={replaceTeacherName}
                onChange={(e) => setReplaceTeacherName(e.target.value)}
                placeholder="Ej: JUAN PEREZ GOMEZ"
                className="w-full h-11 px-3.5 text-xs font-semibold bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-2xl text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:bg-white dark:focus:bg-[#15151a] focus:outline-none focus:border-[#FDBA30] focus:ring-2 focus:ring-[#FDBA30]/20 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Motivo o Detalle de Observación
              </label>
              <textarea
                rows="3"
                value={observationText}
                onChange={(e) => setObservationText(e.target.value)}
                placeholder="Ej: Licencia médica, tráfico, adelanto de clase..."
                className="w-full p-3.5 text-xs font-semibold bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-2xl text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:bg-white dark:focus:bg-[#15151a] focus:outline-none focus:border-[#FDBA30] focus:ring-2 focus:ring-[#FDBA30]/20 transition resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3.5 border-t border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveModalItem(null)}
              className="h-11 rounded-2xl text-xs font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-200/90 dark:border-zinc-700 transition flex items-center justify-center text-center active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveObservation}
              className="h-11 rounded-2xl text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition flex items-center justify-center text-center active:scale-95"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  {/* MODAL PARA REGISTRAR RESERVA DE AULA LIBRE */}
  {
    reservingRoom && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-backdrop-fade"
        onClick={() => !savingReservation && setReservingRoom(null)}
      >
        <div
          className="bg-white dark:bg-[#0c0c10] rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-zinc-800 animate-spring-up space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Encabezado */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5 min-w-0 pr-1">
              <span className="font-mono font-black text-sm bg-amber-400 text-slate-950 px-2.5 py-1 rounded-xl shadow-xs shrink-0">
                {reservingRoom.abrv}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight break-words">
                  Reservar {reservingRoom.nombre}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-semibold mt-0.5 break-words leading-tight">
                  {reservingRoom.tipo} · Pab. {reservingRoom.pabellon} ({reservingRoom.piso}) · Cap. {reservingRoom.aforo} pers.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={savingReservation}
              onClick={() => setReservingRoom(null)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition flex items-center justify-center active:scale-90 shrink-0"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          <form onSubmit={handleSaveReservation} className="space-y-3.5">
            {/* Tipo de Solicitante Toggle */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Tipo de Solicitante
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setReservationForm(f => ({ ...f, tipo: 'DOCENTE' }))}
                  className={`h-9 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    reservationForm.tipo === 'DOCENTE'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Docente</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReservationForm(f => ({ ...f, tipo: 'ALUMNO' }))}
                  className={`h-9 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    reservationForm.tipo === 'ALUMNO'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Alumno / Delegado</span>
                </button>
              </div>
            </div>

            {/* Nombre Solicitante */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Nombre del {reservationForm.tipo === 'DOCENTE' ? 'Docente' : 'Alumno'} *
              </label>
              <input
                type="text"
                required
                value={reservationForm.nombre}
                onChange={(e) => setReservationForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder={reservationForm.tipo === 'DOCENTE' ? 'Ej: ING. CARLOS MENDOZA' : 'Ej: JUAN PEREZ (Delegado)'}
                className="w-full h-11 px-3.5 text-xs font-semibold bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-2xl text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:bg-white dark:focus:bg-[#15151a] focus:outline-none focus:border-[#FDBA30] focus:ring-2 focus:ring-[#FDBA30]/20 transition"
              />
            </div>

            {/* Fecha y Horario */}
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Fecha *
                </label>
                <CustomDatePicker
                  value={reservationForm.fecha}
                  onChange={(val) => setReservationForm(f => ({ ...f, fecha: val }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Hora Inicio *
                  </label>
                  <CustomSelect
                    value={reservationForm.horaInicio}
                    onChange={(val) => setReservationForm(f => ({ ...f, horaInicio: val }))}
                    options={TIME_OPTIONS}
                    placeholder="Hora Inicio"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Hora Fin *
                  </label>
                  <CustomSelect
                    value={reservationForm.horaFin}
                    onChange={(val) => setReservationForm(f => ({ ...f, horaFin: val }))}
                    options={TIME_OPTIONS}
                    placeholder="Hora Fin"
                  />
                </div>
              </div>
            </div>

            {/* Actividades que se realizarán */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Actividades que se realizarán *
              </label>
              <textarea
                rows="3"
                required
                value={reservationForm.actividades}
                onChange={(e) => setReservationForm(f => ({ ...f, actividades: e.target.value }))}
                placeholder="Ej: Asesoría de tesis, recuperación de clase, sustentación de proyecto, reunión de grupo..."
                className="w-full p-3 text-xs font-semibold bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-2xl text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:bg-white dark:focus:bg-[#15151a] focus:outline-none focus:border-[#FDBA30] focus:ring-2 focus:ring-[#FDBA30]/20 transition resize-none"
              />
            </div>

            {/* Acciones */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={savingReservation}
                onClick={() => setReservingRoom(null)}
                className="h-11 rounded-2xl text-xs font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-slate-200/90 dark:border-zinc-700 transition flex items-center justify-center text-center active:scale-95 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingReservation}
                className="h-11 rounded-2xl text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition flex items-center justify-center text-center active:scale-95 disabled:opacity-50 gap-2"
              >
                {savingReservation ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <CalendarPlus className="w-4 h-4 stroke-[2.5]" />
                    <span>Confirmar Reserva</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )
  }
    </div >
  );
}
