import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  LayoutGrid,
  Filter,
  ChevronDown
} from 'lucide-react';

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
import ToastBanner from './ToastBanner';
import CustomDatePicker from './CustomDatePicker';
import CustomSelect from './CustomSelect';
import { useAssistants } from '../utils/assistants';
import { getLoggedAssistantName, isAdmin } from '../utils/auth';
import { useFadeModal } from '../utils/useFadeModal';
import { FadeCollapse } from './FadeCollapse';
import { useSlidingIndicator } from '../utils/useSlidingIndicator';
import { triggerAutoSyncLinkedExcel } from '../utils/liveExcelSync';
import { toBlob } from 'html-to-image';
import html2canvas from 'html2canvas';

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
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const timeToMins = (t) => {
    if (!t || typeof t !== 'string') return 0;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeFiltersCount = (selectedPabellon ? 1 : 0) + (selectedPisos.length > 0 ? 1 : 0) + (selectedCarrera ? 1 : 0);

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

  // Sliding pill indicators across all filter & view strips
  const daySlide = useSlidingIndicator(selectedDia);
  const pabDesktopSlide = useSlidingIndicator(selectedPabellon || 'ALL');
  const pabMobileSlide = useSlidingIndicator(selectedPabellon || 'ALL', [mobileFiltersOpen]);
  const pisoSlideKey = selectedPisos.length === 0 ? 'ALL' : (selectedPisos.length === 1 ? selectedPisos[0] : '');
  const pisoSlide = useSlidingIndicator(pisoSlideKey, [selectedPisos.length]);
  const viewModeSlide = useSlidingIndicator(viewMode);
  const statusSlide = useSlidingIndicator(statusFilter === 'ALL' ? '' : statusFilter, [viewMode]);
  const timeSlideKey = blockMode === 'CURRENT' ? 'CURRENT' : (blockMode === 'CUSTOM' && selectedHora ? selectedHora : 'ALL');
  const timeSlide = useSlidingIndicator(timeSlideKey);

  // Directional slide direction when switching day or viewMode
  const DAY_ORDER = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
  const [contentTransition, setContentTransition] = useState(() => ({
    dia: selectedDia,
    viewMode,
    dir: 'initial'
  }));
  if (contentTransition.dia !== selectedDia || contentTransition.viewMode !== viewMode) {
    let nextDir = 'next';
    if (contentTransition.viewMode !== viewMode) {
      nextDir = viewMode === 'FREE_ROOMS' ? 'next' : 'prev';
    } else {
      const prevIdx = DAY_ORDER.indexOf(contentTransition.dia);
      const nextIdx = DAY_ORDER.indexOf(selectedDia);
      nextDir = prevIdx !== -1 && nextIdx !== -1 && nextIdx < prevIdx ? 'prev' : 'next';
    }
    setContentTransition({ dia: selectedDia, viewMode, dir: nextDir });
  }
  const gridSlideClass =
    contentTransition.dir === 'prev'
      ? 'animate-slide-prev'
      : contentTransition.dir === 'next'
        ? 'animate-slide-next'
        : 'animate-fade-in';

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

  const [isCarreraModalOpen, setIsCarreraModalOpen] = useState(false);
  const [carreraSearch, setCarreraSearch] = useState('');
  const carreraModalFade = useFadeModal(isCarreraModalOpen, () => setIsCarreraModalOpen(false), 200);

  const carrerasFiltradas = useMemo(() => {
    if (!carreraSearch.trim()) return carrerasUnicas;
    const q = carreraSearch.toLowerCase();
    return carrerasUnicas.filter(c => c.toLowerCase().includes(q));
  }, [carrerasUnicas, carreraSearch]);

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
  const [quickAttentionItem, setQuickAttentionItem] = useState(null);
  const [quickAttentionResponsable, setQuickAttentionResponsable] = useState(() => getLoggedAssistantName());

  useEffect(() => {
    if (!isAdmin()) {
      setQuickAttentionResponsable(getLoggedAssistantName());
    }
  }, [quickAttentionItem]);
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
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);

  const handleSendWhatsApp = async (item) => {
    if (!item) return;
    setIsSharingWhatsApp(true);

    try {
      const cardEl = document.getElementById(`attendance-card-${item.id || item.nrc}`);
      let blob = null;

      if (cardEl) {
        const isDark = document.documentElement.classList.contains('dark');
        const bg = isDark ? '#0c0c0f' : '#ffffff';

        // Ocultar botones de acción (Puntual/Tarde/Falta, menú 3 puntos y Copiar) para capturar solo la información de la tarjeta
        const hiddenEls = Array.from(cardEl.querySelectorAll('[data-wa-hide]'));
        const prevDisplays = hiddenEls.map((el) => el.style.display);
        hiddenEls.forEach((el) => { el.style.display = 'none'; });

        try {
          blob = await toBlob(cardEl, {
            pixelRatio: 2,
            backgroundColor: bg,
            cacheBust: true,
            style: {
              transform: 'none',
              transition: 'none',
            }
          });
        } catch (imgErr) {
          console.warn('toBlob fallback to html2canvas:', imgErr);
          try {
            const canvas = await html2canvas(cardEl, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: bg,
              scrollX: 0,
              scrollY: 0,
            });
            blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
          } catch (h2cErr) {
            console.warn('html2canvas failed:', h2cErr);
          }
        } finally {
          hiddenEls.forEach((el, idx) => { el.style.display = prevDisplays[idx]; });
        }
      }

      const defaultText = "Buenas, informacion sobre este docente aun no llega, su apoyo porfavor.";
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(defaultText)}`;

      if (blob) {
        const cleanDocente = (item.docente || 'docente').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25);
        const fileName = `docente_${cleanDocente}_${item.aula || 'aula'}.png`;
        const imageFile = new File([blob], fileName, { type: 'image/png' });

        // 1. Mobile Share (Direct share to WhatsApp with attached image & text)
        if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
          classOptionsFade.requestClose(() => setSelectedClassOptions(null));
          await navigator.share({
            files: [imageFile],
            text: defaultText,
            title: `Docente: ${item.docente || item.aula}`
          });
          return;
        }

        // 2. Desktop fallback (Clipboard copy + download + open WhatsApp)
        let copied = false;
        try {
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            copied = true;
          }
        } catch (clipErr) {
          console.warn('Clipboard write error:', clipErr);
        }

        if (!copied) {
          const dlUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = dlUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(dlUrl), 5000);
        }

        setToastMessage(copied ? '📸 ¡Captura copiada! En WhatsApp presiona Ctrl + V para adjuntarla.' : '📥 Captura descargada para adjuntar en WhatsApp.');
        setTimeout(() => setToastMessage(''), 4000);
      }

      classOptionsFade.requestClose(() => setSelectedClassOptions(null));
      window.open(waUrl, '_blank');
    } catch (err) {
      console.error('Error sharing to WhatsApp:', err);
      classOptionsFade.requestClose(() => setSelectedClassOptions(null));
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent("Buenas, informacion sobre este docente aun no llega, su apoyo porfavor.")}`, '_blank');
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

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

  const classOptionsFade = useFadeModal(selectedClassOptions, () => setSelectedClassOptions(null), 200);
  const quickAttentionFade = useFadeModal(quickAttentionItem, () => setQuickAttentionItem(null), 200);
  const activeModalFade = useFadeModal(activeModalItem, () => setActiveModalItem(null), 200);
  const reserveRoomFade = useFadeModal(reservingRoom, () => setReservingRoom(null), 200);

  // Modales de Acción al Mantener Presionado
  const [manualTardeItem, setManualTardeItem] = useState(null);
  const [manualTardeTime, setManualTardeTime] = useState('');
  const [showTimePickerMenu, setShowTimePickerMenu] = useState(false);
  const manualTardeFade = useFadeModal(manualTardeItem, () => {
    setManualTardeItem(null);
    setShowTimePickerMenu(false);
  }, 200);

  const [faltaOptionsItem, setFaltaOptionsItem] = useState(null);
  const faltaOptionsFade = useFadeModal(faltaOptionsItem, () => setFaltaOptionsItem(null), 200);

  // Manejador Central de Pulsación Larga (Long Press) para Tarde y Falta
  const longPressRef = useRef({
    timer: null,
    didLongPress: false,
    item: null,
    startX: 0,
    startY: 0
  });

  const handlePressStart = (e, item, onLongPress) => {
    const point = e.touches ? e.touches[0] : e;
    longPressRef.current.didLongPress = false;
    longPressRef.current.item = item;
    longPressRef.current.startX = point.clientX;
    longPressRef.current.startY = point.clientY;

    if (longPressRef.current.timer) clearTimeout(longPressRef.current.timer);

    longPressRef.current.timer = setTimeout(() => {
      longPressRef.current.didLongPress = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(40); } catch (_) {}
      }
      onLongPress(item);
    }, 450);
  };

  const handlePressEnd = () => {
    if (longPressRef.current.timer) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current.timer = null;
    }
  };

  const handlePressMove = (e) => {
    if (!longPressRef.current.timer) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = Math.abs(point.clientX - longPressRef.current.startX);
    const dy = Math.abs(point.clientY - longPressRef.current.startY);
    if (dx > 10 || dy > 10) {
      handlePressEnd();
    }
  };

  const handlePressClick = (e, item, onClick) => {
    if (longPressRef.current.didLongPress) {
      e.preventDefault();
      e.stopPropagation();
      longPressRef.current.didLongPress = false;
      return;
    }
    onClick(item);
  };

  const handleOpenManualTarde = (item) => {
    setManualTardeItem(item);
    const initialTime = (item.horaInicioReal && item.horaInicioReal !== '-') ? item.horaInicioReal : getCurrentTimeStr();
    setManualTardeTime(initialTime);
    setShowTimePickerMenu(false);
  };

  const handleTimeChange = (raw) => {
    if (!raw) {
      setManualTardeTime('');
      return;
    }
    // Permitir dígitos y dos puntos
    const sanitized = raw.replace(/[^\d:]/g, '').slice(0, 5);
    const digitsOnly = sanitized.replace(/\D/g, '');
    // Si escribe 3 dígitos seguidos sin dos puntos (ej: 171), insertar ':' automáticamente
    if (!sanitized.includes(':') && digitsOnly.length >= 3) {
      setManualTardeTime(`${digitsOnly.slice(0, 2)}:${digitsOnly.slice(2, 4)}`);
      return;
    }
    setManualTardeTime(sanitized);
  };

  const handleTimeBlur = () => {
    if (!manualTardeTime) return;
    let t = manualTardeTime.trim();
    if (/^\d{3,4}$/.test(t)) {
      const padded = t.padStart(4, '0');
      t = `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
    } else if (/^\d{1,2}:\d{1,2}$/.test(t)) {
      const [h, m] = t.split(':');
      t = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    } else if (/^\d{1,2}$/.test(t)) {
      t = `${t.padStart(2, '0')}:00`;
    }
    const parts = t.split(':');
    if (parts.length === 2) {
      let h = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0));
      let m = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0));
      setManualTardeTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  };

  const handleOpenFaltaOptions = (item) => {
    setFaltaOptionsItem(item);
  };

  const handleSaveManualTarde = async (e) => {
    if (e) e.preventDefault();
    const item = manualTardeFade.cachedData || manualTardeItem;
    if (!item) return;

    let timeVal = (manualTardeTime || getCurrentTimeStr()).trim();
    if (/^\d{3,4}$/.test(timeVal)) {
      const padded = timeVal.padStart(4, '0');
      timeVal = `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
    } else if (/^\d{1,2}:\d{1,2}$/.test(timeVal)) {
      const [h, m] = timeVal.split(':');
      timeVal = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    } else if (!timeVal.includes(':')) {
      timeVal = getCurrentTimeStr();
    }
    const updates = {
      asistencia: 'SI',
      puntualidad: 'TARDE',
      horaInicioReal: timeVal,
      horaFinalReal: item.horaFinalProg || item.horaFinalReal || ''
    };

    setData(prev => prev.map(c => (c.id === item.id ? { ...c, ...updates } : c)));
    setToastMessage(`✓ Tardanza fijada a las ${timeVal} (${item.aula})`);
    setTimeout(() => setToastMessage(''), 2500);

    manualTardeFade.requestClose(() => setManualTardeItem(null));

    try {
      await fetch(`/api/attendance/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      triggerAutoSyncLinkedExcel();
    } catch (err) {
      console.error('Error saving manual tarde time:', err);
    }
  };

  const handleSelectFaltaOption = async (obsType) => {
    const item = faltaOptionsFade.cachedData || faltaOptionsItem;
    if (!item) return;

    const upperObs = obsType.toUpperCase().trim();
    const updates = {
      asistencia: 'NO',
      puntualidad: '-',
      horaInicioReal: '-',
      horaFinalReal: '-',
      observacion: upperObs
    };

    setData(prev => prev.map(c => (c.id === item.id ? { ...c, ...updates } : c)));
    setToastMessage(`✓ Falta registrada: "${upperObs}" (${item.aula})`);
    setTimeout(() => setToastMessage(''), 3000);

    faltaOptionsFade.requestClose(() => setFaltaOptionsItem(null));

    try {
      await fetch(`/api/attendance/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      triggerAutoSyncLinkedExcel();
    } catch (err) {
      console.error('Error saving falta with observation:', err);
    }
  };

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

    // Validar si el aula ya tiene una reserva que solape este mismo día/horario
    const aulaCode = reservingRoom.abrv.toUpperCase().trim();
    const reqStartM = timeToMins(reservationForm.horaInicio);
    const reqEndM = timeToMins(reservationForm.horaFin);

    const conflictingRes = reservations.find(r => {
      if ((r.aula || '').toUpperCase().trim() !== aulaCode) return false;
      const sameDate = (r.fecha === reservationForm.fecha);
      const sameDay = (r.dia && selectedDia && r.dia.toUpperCase() === selectedDia.toUpperCase());
      if (!sameDate && !sameDay) return false;
      const rStartM = timeToMins(r.inicio);
      const rEndM = timeToMins(r.final);
      return (reqStartM < rEndM && reqEndM > rStartM);
    });

    if (conflictingRes) {
      alert(`⚠️ El aula ${reservingRoom.abrv} ya cuenta con una reserva activa para ${conflictingRes.docente} (${conflictingRes.inicio} - ${conflictingRes.final}).\nNo se puede volver a reservar.`);
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
        await loadReservations();
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
        loadReservations();
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
        loadReservations();
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

  const loadReservations = async () => {
    try {
      const res = await fetch('/api/reservations');
      const json = await res.json();
      if (json.success) {
        setReservations(json.data || []);
      }
    } catch (err) {
      console.warn('Error fetching reservations:', err);
    }
  };

  useEffect(() => {
    loadRooms();
    loadReservations();
    const handlePulled = () => {
      loadAttendanceSilent();
      loadReservations();
    };
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
      triggerAutoSyncLinkedExcel();
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
      responsable: (isAdmin() ? quickAttentionResponsable : getLoggedAssistantName()) || getLoggedAssistantName()
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
            asistente: getLoggedAssistantName()
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

  // Compute Free Classrooms (Aulas Libres en este momento o bloque seleccionado)
  // Excluye automáticamente tanto clases regulares como aulas con reserva activa en Excel/BD
  const freeRooms = useMemo(() => {
    const targetHour = (blockMode === 'CUSTOM' && selectedHora)
      ? selectedHora
      : getCurrentHourBlock();

    // 1. Clases regulares ocupadas en el bloque targetHour
    const classesInTarget = (blockMode === 'ALL')
      ? data.filter(c => (c.horaInicioProg || '').trim() === targetHour)
      : data;

    const busyRoomCodes = new Set(classesInTarget.map(c => (c.aula || '').toUpperCase().trim()));

    // 2. Aulas con reserva activa en la hoja RESERVAS para este día/fecha y horario
    const currentBlockDef = REAL_BLOCKS.find(b => b.start === targetHour) || {
      startM: timeToMins(targetHour),
      endM: timeToMins(targetHour) + 100
    };

    const targetDateStr = selectedDayInfo?.dateStr; // ej "10/11/2026"
    const targetIsoDate = selectedDayInfo?.date ? selectedDayInfo.date.toISOString().split('T')[0] : '';

    for (const res of reservations) {
      const resAula = (res.aula || '').toUpperCase().trim();
      if (!resAula) continue;

      const matchesDay = (res.dia && selectedDia && res.dia.toUpperCase() === selectedDia.toUpperCase());
      const matchesDate = (res.fecha && (res.fecha === targetIsoDate || res.fecha === targetDateStr));

      if (matchesDay || matchesDate) {
        const resStartM = timeToMins(res.inicio);
        const resEndM = timeToMins(res.final);

        // Comprobar solapamiento de horario (inicio < fin_bloque && fin > inicio_bloque)
        if (resStartM < currentBlockDef.endM && resEndM > currentBlockDef.startM) {
          busyRoomCodes.add(resAula);
        }
      }
    }

    return rooms.filter(r => {
      if (selectedPabellon && r.pabellon !== selectedPabellon) return false;
      if (selectedPisos.length > 0) {
        const matchesAnyPiso = selectedPisos.some(p => matchesPiso(r.piso, p));
        if (!matchesAnyPiso) return false;
      }
      return !busyRoomCodes.has((r.abrv || '').toUpperCase().trim());
    });
  }, [data, rooms, reservations, selectedPabellon, selectedPisos, blockMode, selectedHora, selectedDia, selectedDayInfo]);

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
        <div
          ref={daySlide.containerRef}
          className="relative grid grid-cols-7 gap-1 w-full bg-slate-100/80 dark:bg-zinc-900/80 p-1 rounded-2xl border border-slate-200/70 dark:border-zinc-800"
        >
          <span
            aria-hidden="true"
            style={daySlide.pillStyle}
            className="pointer-events-none absolute top-0 left-0 z-0 rounded-xl bg-[#FDBA30] shadow-xs ring-2 ring-[#FDBA30]/40"
          />
          {weekDaysWithDates.map((item) => {
            const isSelected = selectedDia === item.name;
            return (
              <button
                key={item.name}
                type="button"
                data-slide-active={isSelected ? 'true' : undefined}
                onClick={() => setSelectedDia(item.name)}
                className={`relative z-10 h-9 sm:h-10 text-[10px] sm:text-xs font-bold rounded-xl transition-colors duration-200 flex flex-col items-center justify-center active:scale-95 leading-tight ${
                  isSelected
                    ? 'text-slate-950 font-black'
                    : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-zinc-800/70'
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

        {/* Fila 2: Buscador + Pabellón + Carrera (Selector limpio) + Botón Filtros Móvil */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 stroke-[2.2]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar aula (A201), docente, curso, NRC..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FDBA30] transition font-bold"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Pabellón Pills (En desktop directo, en móvil compacto) */}
          <div
            ref={pabDesktopSlide.containerRef}
            className="relative hidden sm:inline-flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-slate-200/60 dark:border-zinc-800 shrink-0"
          >
            <span
              aria-hidden="true"
              style={pabDesktopSlide.pillStyle}
              className="pointer-events-none absolute top-0 left-0 z-0 rounded-lg bg-[#FDBA30] shadow-2xs"
            />
            {['', 'A', 'B'].map((pab) => (
              <button
                key={pab || 'ALL'}
                type="button"
                data-slide-active={selectedPabellon === pab ? 'true' : undefined}
                onClick={() => setSelectedPabellon(pab)}
                className={`relative z-10 h-7 px-2.5 rounded-lg text-xs font-bold transition-colors duration-200 active:scale-95 ${selectedPabellon === pab
                    ? 'text-slate-950 font-black'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                {pab ? `Pab. ${pab}` : 'Ambos'}
              </button>
            ))}
          </div>

          {/* Selector de Carrera (Botón que abre ventana personalizada acorde a la app) */}
          {carrerasUnicas.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setCarreraSearch('');
                setIsCarreraModalOpen(true);
              }}
              className={`hidden sm:inline-flex h-7 px-2.5 rounded-xl border text-xs font-bold transition items-center gap-1.5 active:scale-95 shrink-0 max-w-[210px] ${
                selectedCarrera
                  ? 'bg-[#FDBA30] text-slate-950 border-amber-400 font-black shadow-2xs'
                  : 'bg-slate-100 dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800'
              }`}
              title="Filtrar por carrera"
            >
              <GraduationCap className={`w-3.5 h-3.5 shrink-0 ${selectedCarrera ? 'text-slate-950' : 'text-amber-500'}`} />
              <span className="truncate">
                {selectedCarrera || `Carreras (${carrerasUnicas.length})`}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-0.5" />
            </button>
          )}

          {/* Boton Toggle Filtros Avanzados (Solo en móvil para no saturar) */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className={`sm:hidden h-8 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 transition active:scale-95 ${
              activeFiltersCount > 0 || mobileFiltersOpen
                ? 'bg-[#FDBA30] text-slate-950 border-amber-400 font-black shadow-xs'
                : 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
            }`}
          >
            <Filter className="w-3.5 h-3.5 stroke-[2.4]" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-slate-950 text-white text-[10px] flex items-center justify-center font-black">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Fila Pisos (Horizontal con scroll suave y selección múltiple) + Pabellón/Carrera en móvil */}
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] sm:grid-rows-[1fr] sm:opacity-100 ${
            mobileFiltersOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none sm:pointer-events-auto'
          }`}
        >
          <div className="overflow-hidden sm:overflow-visible min-w-0">
            <div className="flex flex-col gap-2 pt-1 sm:pt-0 border-t border-slate-100 dark:border-zinc-800 sm:border-t-0 sm:flex-row sm:items-center sm:gap-1.5">
          {/* Pabellón Pills (En móvil dentro del menú filtros) */}
          <div
            ref={pabMobileSlide.containerRef}
            className="relative flex sm:hidden items-center gap-0.5 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-slate-200/60 dark:border-zinc-800 shrink-0 w-full"
          >
            <span
              aria-hidden="true"
              style={pabMobileSlide.pillStyle}
              className="pointer-events-none absolute top-0 left-0 z-0 rounded-lg bg-[#FDBA30] shadow-2xs"
            />
            {['', 'A', 'B'].map((pab) => (
              <button
                key={pab || 'ALL'}
                type="button"
                data-slide-active={selectedPabellon === pab ? 'true' : undefined}
                onClick={() => setSelectedPabellon(pab)}
                className={`relative z-10 flex-1 h-7 px-2.5 rounded-lg text-xs font-bold transition-colors duration-200 active:scale-95 ${selectedPabellon === pab
                    ? 'text-slate-950 font-black'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                {pab ? `Pab. ${pab}` : 'Ambos'}
              </button>
            ))}
          </div>

          {/* Carrera Button (En móvil dentro del menú filtros, abre ventana acorde a la app) */}
          {carrerasUnicas.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setCarreraSearch('');
                setIsCarreraModalOpen(true);
              }}
              className={`flex sm:hidden h-8 px-3 rounded-xl border text-xs font-bold transition items-center justify-between w-full active:scale-98 ${
                selectedCarrera
                  ? 'bg-[#FDBA30] text-slate-950 border-amber-400 font-black'
                  : 'bg-slate-100 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <GraduationCap className={`w-4 h-4 shrink-0 ${selectedCarrera ? 'text-slate-950' : 'text-amber-500'}`} />
                <span className="truncate">{selectedCarrera || `Todas las carreras (${carrerasUnicas.length})`}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          )}

          {/* Pisos Pills (Con selección múltiple táctil y pill deslizante en selección única) */}
          <div className="flex items-center gap-1.5 w-full overflow-x-auto scrollbar-none py-0.5">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 shrink-0 hidden sm:inline">Pisos:</span>
            <div
              ref={pisoSlide.containerRef}
              className="relative inline-flex items-center gap-0.5 bg-slate-100/80 dark:bg-zinc-900/80 p-0.5 rounded-xl border border-slate-200/60 dark:border-zinc-800 shrink-0"
            >
              <span
                aria-hidden="true"
                style={pisoSlide.pillStyle}
                className="pointer-events-none absolute top-0 left-0 z-0 rounded-lg bg-[#FDBA30] shadow-2xs"
              />
              {pisosDisponibles.map((p) => {
                const isTodos = p.val === '';
                const isSelected = isTodos
                  ? selectedPisos.length === 0
                  : selectedPisos.includes(p.val);
                const isSlideOwner = isTodos
                  ? selectedPisos.length === 0
                  : selectedPisos.length === 1 && selectedPisos[0] === p.val;

                return (
                  <button
                    key={p.label}
                    type="button"
                    data-slide-active={isSlideOwner ? 'true' : undefined}
                    onClick={() => handleTogglePiso(p.val)}
                    className={`relative z-10 h-6.5 px-2.5 rounded-lg text-[11px] font-bold transition-colors duration-200 active:scale-95 shrink-0 inline-flex items-center gap-1 ${
                      isSelected
                        ? `${selectedPisos.length > 1 ? 'bg-[#FDBA30] shadow-2xs ' : ''}text-slate-950 font-black`
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title={isTodos ? 'Mostrar todos los pisos' : `Filtrar ${p.label}`}
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
            </div>
          </div>
        </div>

        {/* Fila 3: Vistas (Clases vs Aulas Libres) + Pastillas de Estado Rápidas */}
        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100 dark:border-zinc-800 flex-wrap pb-0.5">
          {/* Segmentado de Vista: Clases o Aulas Libres */}
          <div
            ref={viewModeSlide.containerRef}
            className="relative inline-flex items-center p-0.5 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 shrink-0"
          >
            <span
              aria-hidden="true"
              style={viewModeSlide.pillStyle}
              className={`pointer-events-none absolute top-0 left-0 z-0 rounded-lg shadow-xs transition-[transform,width,height,background-color] duration-300 ${
                viewMode === 'FREE_ROOMS' ? 'bg-emerald-600' : 'bg-white dark:bg-zinc-800'
              }`}
            />
            <button
              type="button"
              data-slide-active={viewMode === 'CLASSES' ? 'true' : undefined}
              onClick={() => {
                setViewMode('CLASSES');
                window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
              }}
              className={`relative z-10 h-7 px-2.5 rounded-lg text-xs font-bold transition-colors duration-200 active:scale-95 flex items-center gap-1.5 ${
                viewMode === 'CLASSES'
                  ? 'text-slate-900 dark:text-white font-black'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Clases</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${viewMode === 'CLASSES' ? 'bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200' : 'bg-slate-200/60 dark:bg-zinc-800 text-slate-500'}`}>
                {countTotal}
              </span>
            </button>

            <button
              type="button"
              data-slide-active={viewMode === 'FREE_ROOMS' ? 'true' : undefined}
              onClick={() => {
                setViewMode('FREE_ROOMS');
                window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
              }}
              className={`relative z-10 h-7 px-2.5 rounded-lg text-xs font-bold transition-colors duration-200 active:scale-95 flex items-center gap-1.5 ${
                viewMode === 'FREE_ROOMS'
                  ? 'text-white font-black'
                  : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200'
              }`}
            >
              <DoorOpen className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Libres</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${viewMode === 'FREE_ROOMS' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'}`}>
                {freeRooms.length}
              </span>
            </button>
          </div>

          {/* Pastillas KPI para filtrar por estado (Solo en modo Clases) */}
          {viewMode === 'CLASSES' && (
            <div
              ref={statusSlide.containerRef}
              className="relative flex items-center gap-1 text-[11px] shrink-0"
            >
              <span
                aria-hidden="true"
                style={statusSlide.pillStyle}
                className={`pointer-events-none absolute top-0 left-0 z-0 rounded-lg shadow-xs ${
                  statusFilter === 'PUNTUAL'
                    ? 'bg-emerald-600'
                    : statusFilter === 'TARDE'
                      ? 'bg-amber-500'
                      : statusFilter === 'FALTA'
                        ? 'bg-rose-600'
                        : 'bg-slate-800 dark:bg-zinc-700'
                }`}
              />
              <button
                type="button"
                data-slide-active={statusFilter === 'PUNTUAL' ? 'true' : undefined}
                onClick={() => setStatusFilter(statusFilter === 'PUNTUAL' ? 'ALL' : 'PUNTUAL')}
                className={`relative z-10 h-7 px-2 rounded-lg font-bold transition-colors duration-200 active:scale-95 whitespace-nowrap cursor-pointer ${
                  statusFilter === 'PUNTUAL'
                    ? 'text-white font-black'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-200'
                }`}
                title="Filtrar puntuales"
              >
                ✓ {countPuntual}
              </button>

              <button
                type="button"
                data-slide-active={statusFilter === 'TARDE' ? 'true' : undefined}
                onClick={() => setStatusFilter(statusFilter === 'TARDE' ? 'ALL' : 'TARDE')}
                className={`relative z-10 h-7 px-2 rounded-lg font-bold transition-colors duration-200 active:scale-95 whitespace-nowrap cursor-pointer ${
                  statusFilter === 'TARDE'
                    ? 'text-slate-950 font-black'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-amber-200'
                }`}
                title="Filtrar tardanzas"
              >
                🕒 {countTarde}
              </button>

              <button
                type="button"
                data-slide-active={statusFilter === 'FALTA' ? 'true' : undefined}
                onClick={() => setStatusFilter(statusFilter === 'FALTA' ? 'ALL' : 'FALTA')}
                className={`relative z-10 h-7 px-2 rounded-lg font-bold transition-colors duration-200 active:scale-95 whitespace-nowrap cursor-pointer ${
                  statusFilter === 'FALTA'
                    ? 'text-white font-black'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 dark:hover:text-rose-200'
                }`}
                title="Filtrar faltas"
              >
                ✕ {countFalta}
              </button>

              <button
                type="button"
                data-slide-active={statusFilter === 'PENDIENTE' ? 'true' : undefined}
                onClick={() => setStatusFilter(statusFilter === 'PENDIENTE' ? 'ALL' : 'PENDIENTE')}
                className={`relative z-10 h-7 px-2 rounded-lg font-bold transition-colors duration-200 active:scale-95 whitespace-nowrap cursor-pointer ${
                  statusFilter === 'PENDIENTE'
                    ? 'text-white font-black'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 dark:hover:text-white'
                }`}
                title="Filtrar pendientes"
              >
                Pend: {countPendiente}
              </button>
            </div>
          )}
        </div>

        {/* Fila 4: Selector de Horario Unificado (Limpio, horizontal y sin duplicados) */}
        <div
          ref={timeSlide.containerRef}
          className="relative flex items-center gap-1 overflow-x-auto bg-slate-100/80 dark:bg-zinc-900/80 p-1 rounded-xl border border-slate-200/60 dark:border-zinc-800 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-[11px]"
        >
          <span
            aria-hidden="true"
            style={timeSlide.pillStyle}
            className="pointer-events-none absolute top-0 left-0 z-0 rounded-lg bg-[#FDBA30] shadow-xs"
          />
          {/* Botón Ahora (Bloque actual en vivo) */}
          <button
            type="button"
            data-slide-active={blockMode === 'CURRENT' ? 'true' : undefined}
            onClick={() => {
              setBlockMode(blockMode === 'CURRENT' ? 'ALL' : 'CURRENT');
              setSelectedHora('');
            }}
            className={`relative z-10 h-6.5 px-2.5 rounded-lg text-xs font-bold transition-colors duration-200 flex items-center gap-1 active:scale-95 whitespace-nowrap shrink-0 ${
              blockMode === 'CURRENT'
                ? 'text-slate-950 font-black'
                : 'text-slate-700 dark:text-zinc-300 hover:bg-white/60 dark:hover:bg-zinc-800/70'
            }`}
            title={`Filtrar al bloque en curso (${getCurrentHourBlock()})`}
          >
            <Clock className={`w-3 h-3 stroke-[2.4] ${blockMode === 'CURRENT' ? 'text-slate-950' : 'text-amber-500'}`} />
            <span>Ahora ({getCurrentHourBlock()})</span>
          </button>

          {/* Botón Todo el Día */}
          <button
            type="button"
            data-slide-active={blockMode === 'ALL' && !selectedHora ? 'true' : undefined}
            onClick={() => {
              setBlockMode('ALL');
              setSelectedHora('');
            }}
            className={`relative z-10 h-6.5 px-2.5 rounded-lg text-xs font-bold transition-colors duration-200 whitespace-nowrap active:scale-95 shrink-0 ${
              blockMode === 'ALL' && !selectedHora
                ? 'text-slate-950 font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800/70'
            }`}
          >
            Todo el día
          </button>

          <span className="h-4 w-px bg-slate-300 dark:bg-zinc-700 shrink-0 mx-0.5 relative z-10"></span>

          {/* Bloques de Hora de Clase */}
          {REAL_BLOCKS.map(b => {
            const isSelected = blockMode === 'CUSTOM' && selectedHora === b.start;
            const isCurrent = b.start === getCurrentHourBlock();
            return (
              <button
                key={b.start}
                type="button"
                data-slide-active={isSelected ? 'true' : undefined}
                onClick={() => {
                  if (isSelected) {
                    setBlockMode('ALL');
                    setSelectedHora('');
                  } else {
                    setBlockMode('CUSTOM');
                    setSelectedHora(b.start);
                  }
                }}
                className={`relative z-10 h-6.5 px-2 rounded-lg font-mono text-[11px] font-bold transition-colors duration-200 whitespace-nowrap active:scale-95 shrink-0 ${
                  isSelected
                    ? 'text-slate-950 font-black'
                    : isCurrent && blockMode === 'CURRENT'
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 font-black'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-zinc-800/70'
                }`}
                title={`Bloque ${b.start} a ${b.end}`}
              >
                {b.start}
              </button>
            );
          })}
        </div>
      </div>

      {/* Barra compacta de filtros activos (Ahorra más de 120px de espacio vertical en pantallas pequeñas) */}
      <FadeCollapse show={(statusFilter !== 'ALL' || blockMode !== 'ALL' || selectedPisos.length > 0 || selectedCarrera) && viewMode !== 'FREE_ROOMS'}>
        <div className="flex items-center gap-1.5 flex-wrap px-1 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Filtrando:</span>
          {statusFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[11px] font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition"
              title="Quitar filtro de estado"
            >
              <span>{statusFilter}</span>
              <X className="w-3 h-3 stroke-[2.2]" />
            </button>
          )}
          {blockMode !== 'ALL' && (
            <button
              type="button"
              onClick={() => {
                setBlockMode('ALL');
                setSelectedHora('');
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-[11px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-amber-200 transition"
              title="Volver a todo el día"
            >
              <Clock className="w-3 h-3 text-amber-500" />
              <span>{blockMode === 'CURRENT' ? `Ahora (${getCurrentHourBlock()})` : `Bloque ${selectedHora}`}</span>
              <X className="w-3 h-3 stroke-[2.2]" />
            </button>
          )}
          {selectedPisos.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedPisos([])}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-[11px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-amber-200 transition"
              title="Ver todos los pisos"
            >
              <span>Pisos: {pisosDisponibles.filter(p => selectedPisos.includes(p.val)).map(p => p.short).join('+')}</span>
              <X className="w-3 h-3 stroke-[2.2]" />
            </button>
          )}
          {selectedCarrera && (
            <button
              type="button"
              onClick={() => setSelectedCarrera('')}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-[11px] font-bold text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 dark:hover:text-amber-200 transition"
              title="Ver todas las carreras"
            >
              <span className="truncate max-w-[120px]">{selectedCarrera}</span>
              <X className="w-3 h-3 stroke-[2.2]" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ALL');
              setBlockMode('ALL');
              setSelectedHora('');
              setSelectedPisos([]);
              setSelectedCarrera('');
            }}
            className="text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 underline ml-auto py-0.5"
          >
            Limpiar todo
          </button>
        </div>
      </FadeCollapse>

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

        <div key={`${selectedDia}-${selectedHora}`} className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-3.5 ${gridSlideClass}`}>
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
            className="mt-3 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 font-bold text-xs rounded-xl transition"
          >
            Restablecer Filtro
          </button>
        )}
      </div>
    ) : (
      <div key={`${selectedDia}-${selectedPabellon}-${selectedHora}-${statusFilter}`} className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-3 sm:gap-3.5 ${gridSlideClass}`}>
        {displayedItems.map(item => {
          const isPuntual = item.puntualidad === 'PUNTUAL';
          const isTarde = item.puntualidad === 'TARDE';
          const isFalta = item.asistencia === 'NO';
          const isReemplazo = item.asistencia && item.asistencia.includes('REEMPLAZO');
          const isPendiente = !isPuntual && !isTarde && !isFalta && !isReemplazo;

          return (
            <div
              key={item.id}
              id={`attendance-card-${item.id || item.nrc}`}
              className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-3.5 pb-4 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
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
                        data-wa-hide="true"
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
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-[#FDBA30] text-slate-950 rounded-full shadow-xs shrink-0" title="Tarde">
                        <Clock className="w-3.5 h-3.5 text-slate-950 stroke-[2.4] shrink-0" />
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
                      data-wa-hide="true"
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
              <div data-wa-hide="true" className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  onClick={() => handleQuickStatus(item, 'PUNTUAL')}
                  className={`min-h-[44px] h-11 py-1 px-1 rounded-2xl font-bold text-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95 ${isPuntual
                      ? 'bg-[#00875A] text-white border border-[#00875A] shadow-md font-black'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 dark:bg-[#061d15] dark:text-[#10b981] dark:border-[#059669]/60 dark:hover:bg-[#059669]/20'
                    }`}
                  title={isPuntual ? 'Toca para desmarcar' : 'Marcar puntual'}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 stroke-[2.4] shrink-0 ${isPuntual ? 'text-white' : 'text-emerald-700 dark:text-[#10b981]'}`} />
                  <span>Puntual</span>
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => handlePressStart(e, item, handleOpenManualTarde)}
                  onTouchStart={(e) => handlePressStart(e, item, handleOpenManualTarde)}
                  onMouseUp={handlePressEnd}
                  onTouchEnd={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchMove={handlePressMove}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={(e) => handlePressClick(e, item, () => handleQuickStatus(item, 'TARDE'))}
                  className={`min-h-[44px] h-11 py-1 px-1 rounded-2xl font-bold text-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95 select-none ${isTarde
                      ? 'bg-[#FDBA30] text-slate-950 border border-[#FDBA30] font-black shadow-md'
                      : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 dark:bg-[#1c1204] dark:text-[#f59e0b] dark:border-[#d97706] dark:hover:bg-[#d97706]/20'
                    }`}
                  title={isTarde ? 'Toca para desmarcar · Mantén presionado para cambiar hora' : 'Marcar tarde · Mantén presionado para cambiar hora'}
                >
                  <Clock className={`w-3.5 h-3.5 stroke-[2.4] shrink-0 ${isTarde ? 'text-slate-950' : 'text-amber-800 dark:text-[#f59e0b]'}`} />
                  {isTarde && item.horaInicioReal ? (
                    <div className="flex flex-col items-center justify-center leading-none text-center">
                      <span className="text-[11px] font-bold leading-tight">Tarde</span>
                      <span className="text-[10px] font-mono font-black leading-none mt-0.5 opacity-90">
                        {item.horaInicioReal}
                      </span>
                    </div>
                  ) : (
                    <span>Tarde</span>
                  )}
                </button>

                <button
                  type="button"
                  onMouseDown={(e) => handlePressStart(e, item, handleOpenFaltaOptions)}
                  onTouchStart={(e) => handlePressStart(e, item, handleOpenFaltaOptions)}
                  onMouseUp={handlePressEnd}
                  onTouchEnd={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchMove={handlePressMove}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={(e) => handlePressClick(e, item, () => handleQuickStatus(item, 'FALTA'))}
                  className={`min-h-[44px] h-11 py-1 px-1 rounded-2xl font-bold text-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95 select-none ${isFalta
                      ? 'bg-rose-600 text-white border border-rose-600 font-black shadow-md'
                      : 'bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100 dark:bg-[#1e0810] dark:text-[#fda4af] dark:border-[#9f1239] dark:hover:bg-[#9f1239]/20'
                    }`}
                  title={isFalta ? 'Toca para desmarcar · Mantén presionado para Clase Remota/Adelantada' : 'Marcar falta · Mantén presionado para Clase Remota/Adelantada'}
                >
                  {isFalta ? (
                    <span className="text-white font-mono font-black text-base leading-none">-</span>
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

  {/* SECONDARY CLASSROOM ACTIONS SHEET (3-Dots Menu) con Fade In y Fade Out */ }
  {
    classOptionsFade.shouldRender && typeof document !== 'undefined' && (() => {
      const activeOptions = classOptionsFade.cachedData || selectedClassOptions;
      if (!activeOptions) return null;

      return createPortal(
        <div
          className={`fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 ${classOptionsFade.backdropClass}`}
          onClick={() => classOptionsFade.requestClose()}
        >
          <div
            className={`bg-white dark:bg-[#0c0c10] rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-zinc-800 ${classOptionsFade.modalClass} space-y-4 overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="font-mono font-black text-xs bg-amber-100 dark:bg-amber-950/70 text-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 px-2.5 py-1 rounded-xl shadow-xs shrink-0">
                  {activeOptions.aula || 'S/A'}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-900 dark:text-white break-words leading-tight">{activeOptions.docente}</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono break-words mt-0.5">NRC {activeOptions.nrc} · {activeOptions.curso}{activeOptions.carrera ? ' · ' + activeOptions.carrera : ''}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => classOptionsFade.requestClose()}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition flex items-center justify-center active:scale-90 shrink-0"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="space-y-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  const item = activeOptions;
                  classOptionsFade.requestClose(() => {
                    setSelectedClassOptions(null);
                    setActiveModalItem(item);
                    setObservationText(item.observacion || '');
                    setReplaceTeacherName('');
                  });
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
                  const item = activeOptions;
                  classOptionsFade.requestClose(() => {
                    setSelectedClassOptions(null);
                    if (onEmitManualSheet) {
                      onEmitManualSheet(item);
                    }
                  });
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
                disabled={isSharingWhatsApp}
                onClick={() => handleSendWhatsApp(activeOptions)}
                className="w-full p-3 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 border border-emerald-200/90 dark:border-emerald-800/80 text-left flex items-center gap-3 transition active:scale-98 disabled:opacity-60"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-[#25D366] flex items-center justify-center shrink-0">
                  {isSharingWhatsApp ? (
                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.34C9.36 7.34 9.09 7.4 8.87 7.65C8.64 7.9 8 8.5 8 9.71C8 10.92 8.89 12.09 9.01 12.25C9.14 12.42 10.74 14.89 13.2 15.95C13.78 16.2 14.24 16.36 14.6 16.47C15.17 16.65 15.69 16.63 16.1 16.57C16.57 16.5 17.53 15.99 17.73 15.42C17.93 14.85 17.93 14.37 17.87 14.26C17.81 14.16 17.65 14.1 17.41 13.98C17.17 13.86 15.98 13.28 15.76 13.2C15.54 13.11 15.38 13.07 15.22 13.32C15.06 13.56 14.6 14.1 14.46 14.26C14.32 14.43 14.18 14.45 13.94 14.33C13.7 14.21 12.93 13.96 12.02 13.15C11.3 12.51 10.82 11.72 10.7 11.52C10.58 11.31 10.69 11.2 10.81 11.08C10.92 10.97 11.06 10.79 11.18 10.65C11.3 10.51 11.34 10.41 11.42 10.25C11.5 10.08 11.46 9.94 11.4 9.82C11.34 9.7 10.86 8.54 10.67 8.07C10.47 7.61 10.27 7.67 10.13 7.67C10 7.66 9.84 7.66 9.68 7.66L9.53 7.34Z"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                    {isSharingWhatsApp ? 'Generando captura...' : 'Enviar por WhatsApp'}
                  </div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-300 break-words leading-tight mt-0.5">
                    Compartir captura de tarjeta e información del docente
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>,
        document.body
      );
    })()
  }

  {/* IN-SITU QUICK ATTENTION MODAL WINDOW con Fade In y Fade Out */}
  {
    quickAttentionFade.shouldRender && typeof document !== 'undefined' && (() => {
      const activeItem = quickAttentionFade.cachedData || quickAttentionItem;
      if (!activeItem) return null;

      return createPortal(
        <div
          className={`fixed inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[9999] p-4 ${quickAttentionFade.backdropClass}`}
          onClick={() => quickAttentionFade.requestClose()}
        >
          <div
            className={`apple-liquid-modal rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl overflow-hidden m-auto ${quickAttentionFade.modalClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-zinc-800 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 inline-flex items-center justify-center shadow-2xs">
                  <HandHelping className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Atención Rápida en Aula
                  </h3>
                  <p className="text-xs text-slate-500">
                    Aula <strong className="text-slate-800 font-mono">{activeItem.aula}</strong> · {activeItem.docente}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => quickAttentionFade.requestClose()}
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

            <FadeCollapse show={quickSelectedMaterials.includes('MANUAL')}>
              <div className="mt-2">
                <input
                  type="text"
                  value={quickManualText}
                  onChange={(e) => setQuickManualText(e.target.value)}
                  placeholder="Escribe el material solicitado manualmente (ej. PARLANTE, EXTENSIÓN)..."
                  className="w-full text-xs font-bold px-3 py-2 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FDBA30]"
                />
              </div>
            </FadeCollapse>
          </div>

          {/* Detail notes & Assistant selector */}
          <div className="space-y-2.5 mb-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-tight mb-1">
                Responsable / Asistente
              </label>
              {isAdmin() ? (
                <CustomSelect
                  value={quickAttentionResponsable}
                  onChange={setQuickAttentionResponsable}
                  options={asistentes}
                  placeholder="Seleccionar asistente"
                />
              ) : (
                <div className="h-10 px-3.5 flex items-center bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400 select-none">
                  <span className="truncate">{getLoggedAssistantName()}</span>
                </div>
              )}
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
              onClick={() => quickAttentionFade.requestClose()}
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
    );
  })()
  }

  {/* Observation / Suplente Modal - 100% Symmetrical con Fade In y Fade Out */ }
  {
    activeModalFade.shouldRender && typeof document !== 'undefined' && (() => {
      const currentActiveItem = activeModalFade.cachedData || activeModalItem;
      if (!currentActiveItem) return null;

      return createPortal(
        <div
          className={`fixed inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 ${activeModalFade.backdropClass}`}
          onClick={() => activeModalFade.requestClose()}
        >
          <div
            className={`bg-white dark:bg-[#0c0c10] rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-zinc-800 ${activeModalFade.modalClass} overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 mb-4">
              <div className="min-w-0 pr-2">
                <h3 className="text-base font-black text-slate-950 dark:text-white tracking-tight leading-tight">
                  Observación o Suplente
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 break-words mt-0.5">
                  Aula <strong className="text-slate-900 dark:text-amber-400 font-mono">{currentActiveItem.aula || 'S/A'}</strong> · {currentActiveItem.docente}
                </p>
              </div>
              <button
                type="button"
                onClick={() => activeModalFade.requestClose()}
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
              onClick={() => activeModalFade.requestClose()}
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
    );
  })()
  }

  {/* MODAL PARA REGISTRAR RESERVA DE AULA LIBRE CON FADE IN Y FADE OUT */}
  {
    reserveRoomFade.shouldRender && typeof document !== 'undefined' && (() => {
      const activeReserveRoom = reserveRoomFade.cachedData || reservingRoom;
      if (!activeReserveRoom) return null;

      return createPortal(
        <div
          className={`fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 ${reserveRoomFade.backdropClass}`}
          onClick={() => !savingReservation && reserveRoomFade.requestClose()}
        >
          <div
            className={`bg-white dark:bg-[#0c0c10] rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-zinc-800 ${reserveRoomFade.modalClass} space-y-4 overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5 min-w-0 pr-1">
                <span className="font-mono font-black text-sm bg-amber-400 text-slate-950 px-2.5 py-1 rounded-xl shadow-xs shrink-0">
                  {activeReserveRoom.abrv}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight break-words">
                    Reservar {activeReserveRoom.nombre}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-semibold mt-0.5 break-words leading-tight">
                    {activeReserveRoom.tipo} · Pab. {activeReserveRoom.pabellon} ({activeReserveRoom.piso}) · Cap. {activeReserveRoom.aforo} pers.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={savingReservation}
                onClick={() => reserveRoomFade.requestClose()}
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
                onClick={() => reserveRoomFade.requestClose()}
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
    );
  })()
  }

  {/* VENTANA MODAL PARA CAMBIAR HORA MANUALMENTE AL MANTENER PRESIONADO 'TARDE' (100% VENTANA CENTRADA) */}
  {
    manualTardeFade.shouldRender && typeof document !== 'undefined' && (() => {
      const item = manualTardeFade.cachedData || manualTardeItem;
      if (!item) return null;

      return createPortal(
        <div
          className={`fixed inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[9999] p-4 ${manualTardeFade.backdropClass}`}
          onClick={() => manualTardeFade.requestClose()}
        >
          <div
            className={`apple-liquid-modal rounded-2xl sm:rounded-3xl max-w-sm w-full p-4 sm:p-5 shadow-2xl overflow-hidden ${manualTardeFade.modalClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-zinc-800 mb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 flex items-center justify-center shadow-xs">
                  <Clock className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    Cambiar Hora de Tardanza
                  </h3>
                  <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold mt-0.5">
                    Aula {item.aula} · {item.docente}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => manualTardeFade.requestClose()}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center active:scale-95 transition"
              >
                <X className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </div>

            <form onSubmit={handleSaveManualTarde} className="space-y-3">
              <div>
                <label className="block text-center text-[10px] font-black text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Hora de Llegada Real (24 hrs)
                </label>
                
                {/* Caja Principal con Reloj Dorado Visible y Selector In-App */}
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 py-1.5 px-3 rounded-2xl border-2 border-amber-400 dark:border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 shadow-inner transition-colors">
                    <button
                      type="button"
                      onClick={() => setShowTimePickerMenu(prev => !prev)}
                      className="p-1 rounded-lg hover:bg-amber-200/60 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-400 transition"
                      title="Abrir selector de hora acorde a la app"
                    >
                      <Clock className="w-5 h-5 text-amber-500 dark:text-amber-400 stroke-[2.4]" />
                    </button>
                    
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9:]*"
                      maxLength={5}
                      value={manualTardeTime}
                      onChange={(e) => handleTimeChange(e.target.value)}
                      onBlur={handleTimeBlur}
                      placeholder="17:16"
                      required
                      autoFocus
                      className="w-24 text-center font-mono font-black text-2xl bg-transparent text-amber-950 dark:text-amber-200 placeholder:text-amber-400/40 focus:outline-none tracking-wider select-all"
                    />

                    <button
                      type="button"
                      onClick={() => setShowTimePickerMenu(prev => !prev)}
                      className="p-1 rounded-lg hover:bg-amber-200/60 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-400 transition"
                      title="Desplegar horas y minutos"
                    >
                      <ChevronDown className={`w-4 h-4 text-amber-500 dark:text-amber-400 stroke-[2.2] transition-transform duration-200 ${showTimePickerMenu ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                <p className="text-center text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  Escribe con el teclado (Ej: 17:16) o toca el reloj
                </p>

                {/* MENÚ DE SELECCIÓN DE HORA 100% INTEGRADO A LA APP (SIN MENÚS BLANCOS DEL NAVEGADOR) */}
                <FadeCollapse show={showTimePickerMenu}>
                  {(() => {
                    const parts = (manualTardeTime || '17:00').split(':');
                    const selH = parts[0] || '17';
                    const selM = parts[1] || '00';

                    return (
                      <div className="mt-2.5 p-2.5 bg-white dark:bg-[#121218] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl">
                        <div className="grid grid-cols-2 gap-2 text-center pb-1.5 mb-1.5 border-b border-slate-100 dark:border-zinc-800/80">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                            Hora ({selH})
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                            Minuto ({selM})
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 h-36">
                          {/* Columna Horas (00 a 23) sin scrollbars blancos */}
                          <div className="overflow-y-auto space-y-1 pr-0.5 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {HOURS_24.map(h => {
                              const isSelected = selH === h;
                              return (
                                <button
                                  key={h}
                                  type="button"
                                  onClick={() => {
                                    const m = selM || '00';
                                    setManualTardeTime(`${h}:${m}`);
                                  }}
                                  className={`w-full py-1.5 rounded-xl font-mono text-xs font-bold transition text-center ${
                                    isSelected
                                      ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                                      : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                                  }`}
                                >
                                  {h}:00
                                </button>
                              );
                            })}
                          </div>

                          {/* Columna Minutos (00 a 59) sin scrollbars blancos */}
                          <div className="overflow-y-auto space-y-1 pr-0.5 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {MINUTES_60.map(m => {
                              const isSelected = selM === m;
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => {
                                    const h = selH || '17';
                                    setManualTardeTime(`${h}:${m}`);
                                  }}
                                  className={`w-full py-1 rounded-lg font-mono text-xs font-bold transition text-center ${
                                    isSelected
                                      ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                                      : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                                  }`}
                                >
                                  :{m}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </FadeCollapse>
              </div>

              {/* Botones de Acción 50% - 50% Perfectamente Simétricos y más chicos */}
              <div className="grid grid-cols-2 gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => manualTardeFade.requestClose()}
                  className="h-9 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition active:scale-95 flex items-center justify-center text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 rounded-xl bg-[#FDBA30] hover:bg-amber-400 text-slate-950 text-xs font-black transition active:scale-95 shadow-sm flex items-center justify-center text-center"
                >
                  Guardar Tardanza
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      );
    })()
  }

  {/* VENTANA MODAL DE OPCIONES AL MANTENER PRESIONADO 'FALTA' (100% VENTANA CENTRADA) */}
  {
    faltaOptionsFade.shouldRender && typeof document !== 'undefined' && (() => {
      const item = faltaOptionsFade.cachedData || faltaOptionsItem;
      if (!item) return null;

      return createPortal(
        <div
          className={`fixed inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-[9999] p-4 ${faltaOptionsFade.backdropClass}`}
          onClick={() => faltaOptionsFade.requestClose()}
        >
          <div
            className={`apple-liquid-modal rounded-2xl sm:rounded-3xl max-w-sm w-full p-4 sm:p-5 shadow-2xl overflow-hidden ${faltaOptionsFade.modalClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-zinc-800 mb-3.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 flex items-center justify-center shadow-xs">
                  <XCircle className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    Opciones Especiales de Falta
                  </h3>
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                    Aula {item.aula} · {item.docente}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => faltaOptionsFade.requestClose()}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center active:scale-95 transition"
              >
                <X className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </div>

            <div className="space-y-2 my-2.5">
              {/* 1. CLASE REMOTA */}
              <button
                type="button"
                onClick={() => handleSelectFaltaOption('CLASE REMOTA')}
                className="w-full p-3 rounded-xl bg-sky-50/80 hover:bg-sky-100/90 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800 text-left flex items-center gap-3 transition active:scale-98 group"
              >
                <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-900/70 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
                  <Monitor className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-sky-950 dark:text-sky-200 uppercase tracking-wide">
                    Clase Remota
                  </div>
                  <div className="text-[11px] text-sky-700/80 dark:text-sky-300/70 mt-0.5">
                    Sesión en modalidad virtual
                  </div>
                </div>
              </button>

              {/* 2. CLASE ADELANTADA */}
              <button
                type="button"
                onClick={() => handleSelectFaltaOption('CLASE ADELANTADA')}
                className="w-full p-3 rounded-xl bg-amber-50/80 hover:bg-amber-100/90 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 text-left flex items-center gap-3 transition active:scale-98 group"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/70 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0">
                  <CalendarClock className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-amber-950 dark:text-amber-200 uppercase tracking-wide">
                    Clase Adelantada
                  </div>
                  <div className="text-[11px] text-amber-700/80 dark:text-amber-300/70 mt-0.5">
                    Sesión adelantada o recuperada
                  </div>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => faltaOptionsFade.requestClose()}
              className="w-full h-9 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition active:scale-95 flex items-center justify-center text-center mt-2"
            >
              Cancelar
            </button>
          </div>
        </div>,
        document.body
      );
    })()
  }
  {/* VENTANA MODAL PARA SELECCIONAR CARRERA (100% PERSONALIZADA ACORDE A LA APP) */}
  {
    carreraModalFade.shouldRender && typeof document !== 'undefined' && createPortal(
      <div
        className={`fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 ${carreraModalFade.backdropClass}`}
        onClick={() => carreraModalFade.requestClose()}
      >
        <div
          className={`bg-white dark:bg-[#0c0c10] rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-zinc-800 ${carreraModalFade.modalClass} flex flex-col max-h-[85vh] overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Encabezado */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 mb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700/80 flex items-center justify-center text-amber-900 dark:text-amber-300 shrink-0">
                <GraduationCap className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-950 dark:text-white tracking-tight leading-tight">
                  Filtrar por Carrera
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-tight">
                  {carrerasUnicas.length} carreras disponibles
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => carreraModalFade.requestClose()}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition flex items-center justify-center active:scale-90 shrink-0"
              title="Cerrar ventana"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Buscador de carreras */}
          <div className="relative mb-3 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 stroke-[2.2]" />
            <input
              type="text"
              value={carreraSearch}
              onChange={(e) => setCarreraSearch(e.target.value)}
              placeholder="Buscar carrera (ej: Derecho, Marketing...)"
              className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#FDBA30] transition font-bold"
              autoFocus
            />
            {carreraSearch && (
              <button
                type="button"
                onClick={() => setCarreraSearch('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Lista de carreras con scroll temático oscuro */}
          <div className="overflow-y-auto space-y-1.5 pr-1 flex-1 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Opción: Todas las Carreras */}
            <button
              type="button"
              onClick={() => {
                setSelectedCarrera('');
                carreraModalFade.requestClose();
              }}
              className={`w-full p-2.5 rounded-xl text-left text-xs font-bold transition flex items-center justify-between active:scale-98 ${
                selectedCarrera === ''
                  ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                  : 'bg-slate-50 dark:bg-zinc-900/70 hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-800 dark:text-zinc-200 border border-slate-200/60 dark:border-zinc-800/80'
              }`}
            >
              <div className="flex items-center gap-2">
                <GraduationCap className={`w-4 h-4 shrink-0 ${selectedCarrera === '' ? 'text-slate-950' : 'text-amber-500'}`} />
                <span>Todas las carreras</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
                selectedCarrera === '' ? 'bg-slate-950 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
              }`}>
                {countTotal} clases
              </span>
            </button>

            {/* Carreras filtradas */}
            {carrerasFiltradas.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-zinc-500 font-medium">
                No se encontraron carreras que coincidan
              </div>
            ) : (
              carrerasFiltradas.map((car) => {
                const isSel = selectedCarrera === car;
                const carClassCount = data.filter(c => String(c.carrera || '').trim() === car).length;
                return (
                  <button
                    key={car}
                    type="button"
                    onClick={() => {
                      setSelectedCarrera(car);
                      carreraModalFade.requestClose();
                    }}
                    className={`w-full p-2.5 rounded-xl text-left text-xs font-bold transition flex items-center justify-between active:scale-98 ${
                      isSel
                        ? 'bg-[#FDBA30] text-slate-950 font-black shadow-xs'
                        : 'bg-slate-50 dark:bg-zinc-900/70 hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-800 dark:text-zinc-200 border border-slate-200/60 dark:border-zinc-800/80'
                    }`}
                  >
                    <span className="break-words pr-2">{car}</span>
                    {carClassCount > 0 && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md shrink-0 font-bold ${
                        isSel ? 'bg-slate-950 text-white' : 'bg-slate-200/80 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                      }`}>
                        {carClassCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Pie de modal */}
          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 mt-2 shrink-0">
            <button
              type="button"
              onClick={() => carreraModalFade.requestClose()}
              className="w-full h-9 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition active:scale-95 flex items-center justify-center text-center"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
  }
    </div>
  );
}
