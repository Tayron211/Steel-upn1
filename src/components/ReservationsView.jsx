import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Calendar, 
  Plus, 
  Search, 
  Clock, 
  Building, 
  User, 
  Trash2, 
  CalendarDays,
  CalendarPlus,
  DoorOpen,
  Users,
  Flame,
  X,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  RefreshCw,
  Filter,
  GraduationCap,
  UserCheck
} from 'lucide-react';
import ToastBanner from './ToastBanner';
import CustomDatePicker from './CustomDatePicker';
import CustomSelect from './CustomSelect';
import { useFadeModal } from '../utils/useFadeModal';
import { useSlidingIndicator } from '../utils/useSlidingIndicator';
import { useAssistants } from '../utils/assistants';
import { getLoggedAssistantName, isAdmin } from '../utils/auth';

import { CAMPUS_ROOMS } from '../utils/campusRooms';
const CAMPUS_ROOMS_CATALOG = CAMPUS_ROOMS;

const inferCategoria = (rm) => {
  if (rm.categoria) return rm.categoria;
  const text = `${rm.nombre || ''} ${rm.tipo || ''}`.toUpperCase();
  if (text.includes('LAB')) return 'LABORATORIO';
  if (text.includes('TALLER')) return 'TALLER';
  if (text.includes('CONFERENCIA') || text.includes('LITIGAC')) return 'ESPECIAL';
  return 'AULA';
};

const TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:20', '09:00', '09:10', '10:00', '10:50',
  '11:00', '11:40', '12:00', '12:30', '13:00', '13:20', '14:00', '14:30',
  '15:00', '15:20', '16:00', '16:10', '17:00', '17:50', '18:00', '18:40',
  '19:00', '19:30', '20:00', '20:20', '21:00', '21:10', '22:00', '22:50'
];

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

const PISOS_DISPONIBLES = [
  { label: 'Todos', short: 'Todos', val: '' },
  { label: 'Sótano', short: 'Sót', val: 'SOT' },
  { label: 'Piso 1', short: 'P1', val: '1ER PISO' },
  { label: 'Piso 2', short: 'P2', val: '2DO PISO' },
  { label: 'Piso 3', short: 'P3', val: '3ER PISO' },
  { label: 'Piso 4', short: 'P4', val: '4TO PISO' },
  { label: 'Piso 5', short: 'P5', val: '5TO PISO' }
];

const DAYS_OF_WEEK = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_UPPER = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const normalizeDay = (d) =>
  String(d || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const deducePisoFromAula = (aula) => {
  const code = String(aula || '').toUpperCase().trim();
  if (code.startsWith('AS')) return 'SÓTANO';
  const match = code.match(/^[AB](\d)/);
  if (!match) return '';
  const floor = match[1];
  if (floor === '1') return '1ER PISO';
  if (floor === '2') return '2DO PISO';
  if (floor === '3') return '3ER PISO';
  if (floor === '4') return '4TO PISO';
  if (floor === '5') return '5TO PISO';
  return '';
};

const matchesPiso = (pisoField, targetVal) => {
  if (!pisoField || !targetVal) return false;
  const f = String(pisoField).toUpperCase();
  const t = String(targetVal).toUpperCase();
  if (t === 'SOT' || t.includes('SOT')) return f.includes('SOT') || f.includes('SÓT');
  if (t === '1ER PISO' || t.includes('1ER')) return f.includes('1ER') || f.includes('PRIMER') || f.includes('PISO 1');
  if (t === '2DO PISO' || t.includes('2DO')) return f.includes('2DO') || f.includes('SEGUNDO') || f.includes('PISO 2');
  if (t === '3ER PISO' || t.includes('3ER')) return f.includes('3ER') || f.includes('TERCER') || f.includes('PISO 3');
  if (t === '4TO PISO' || t.includes('4TO')) return f.includes('4TO') || f.includes('CUARTO') || f.includes('PISO 4');
  if (t === '5TO PISO' || t.includes('5TO')) return f.includes('5TO') || f.includes('QUINTO') || f.includes('PISO 5');
  return f.includes(t);
};

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

const timeToMins = (tStr) => {
  if (!tStr) return 0;
  const [h, m] = String(tStr).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const normalizeDateStr = (d) => {
  if (!d) return '';
  const str = String(d).trim();
  if (/^\d{5}$/.test(str)) {
    const num = Number(str);
    const dt = new Date(Math.round((num - 25569) * 86400000));
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  const ymd = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  const dmy = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return str.slice(0, 10);
};

// Disparador de interacción para nombres en reservas (Exclusivo por Long-Press con vibración háptica)
const PressableNameTrigger = ({ name, type = 'docente', onOpen, className = '' }) => {
  const timerRef = useRef(null);
  const touchStartPos = useRef(null);
  const triggeredRef = useRef(false);

  const startPress = (e) => {
    triggeredRef.current = false;
    if (e.touches && e.touches[0]) {
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(45); } catch (_) { }
      }
      onOpen(name, type);
    }, 450);
  };

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchMove = (e) => {
    if (!touchStartPos.current || !e.touches || !e.touches[0]) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      cancelPress();
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    cancelPress();
  };

  const handleContextMenu = (e) => {
    if (triggeredRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <span
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchMove={handleTouchMove}
      onTouchEnd={cancelPress}
      onTouchCancel={cancelPress}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={`cursor-pointer inline-flex items-center gap-1 select-none active:scale-[0.98] transition-all group/pressable ${className}`}
      title={`Mantén presionado para ver todas las reservas de ${name} en el último año`}
    >
      <span className="underline decoration-dotted decoration-amber-500/80 hover:decoration-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors underline-offset-2 break-words font-semibold">
        {name}
      </span>
    </span>
  );
};

export default function ReservationsView({ initialOpenTrigger = null, onConsumeTrigger = null }) {
  const asistentes = useAssistants();
  const [reservas, setReservas] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [dayClasses, setDayClasses] = useState([]);
  const [modalDayClasses, setModalDayClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [docentesList, setDocentesList] = useState([]);
  const [docenteSuggestionsOpen, setDocenteSuggestionsOpen] = useState(false);
  const [selectedMes, setSelectedMes] = useState(''); // '' = Todos los meses

  // Vista: 'RESERVAS' (Reservas registradas) | 'FREE_ROOMS' (Aulas libres hoy y próximos días)
  const [viewMode, setViewMode] = useState('RESERVAS');

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedPabellon, setSelectedPabellon] = useState(''); // '' | 'A' | 'B'
  const [selectedPisos, setSelectedPisos] = useState([]); // Array selección múltiple
  const [selectedDayOffset, setSelectedDayOffset] = useState(null); // null = Todas las fechas, 0 = Hoy, 1 = Mañana, 2..13 = Próximos días
  const [selectedHoraBlock, setSelectedHoraBlock] = useState(() => getCurrentHourBlock()); // '' = Todo el día, o '07:30', etc.
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const activeFiltersCount = (selectedPabellon ? 1 : 0) + (selectedPisos.length > 0 ? 1 : 0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRoomPickerOpen, setIsRoomPickerOpen] = useState(false);
  const [selectedAulas, setSelectedAulas] = useState([]);
  const [isMultiRoomMode, setIsMultiRoomMode] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState('ALL'); // 'ALL' | 'AULA' | 'LABORATORIO' | 'TALLER' | 'ESPECIAL'
  const [pickerPabellon, setPickerPabellon] = useState(''); // '' | 'A' | 'B'
  const [pickerPiso, setPickerPiso] = useState(''); // '' | 'SOT' | '1ER PISO' | ...
  const [toastMessage, setToastMessage] = useState('');

  const reservationModalFade = useFadeModal(isModalOpen, () => {
    setIsModalOpen(false);
    resetForm();
    if (onConsumeTrigger) onConsumeTrigger();
  }, 200);

  const roomPickerModalFade = useFadeModal(isRoomPickerOpen, () => {
    setIsRoomPickerOpen(false);
  }, 200);

  // Modal: Historial anual de reservas del docente / usuario
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [historySearch, setHistorySearch] = useState('');
  const historyModalFade = useFadeModal(isHistoryModalOpen, () => {
    setIsHistoryModalOpen(false);
    setHistoryData(null);
  }, 200);

  const openHistoryModal = async (name, type = 'docente') => {
    if (!name || name === 'Docente') return;
    setIsHistoryModalOpen(true);
    setHistorySearch('');
    setHistoryData({
      name: name.trim().toUpperCase(),
      type,
      loading: true,
      items: []
    });

    try {
      // Consultar historial completo de reservas
      const res = await fetch('/api/reservations');
      const json = await res.json();
      const allRes = json.success && Array.isArray(json.data) ? json.data : reservas;

      // Filtro del último año (365 días atrás desde hoy)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoIso = oneYearAgo.toISOString().split('T')[0];

      const targetClean = cleanDocenteName(name);
      const matched = allRes.filter(r => {
        if (r.fecha && r.fecha < oneYearAgoIso) return false;
        if (type === 'usuario') {
          const userClean = cleanDocenteName(r.usuario);
          return userClean.includes(targetClean) || targetClean.includes(userClean);
        } else {
          const docClean = cleanDocenteName(r.docente);
          return docClean.includes(targetClean) || targetClean.includes(docClean);
        }
      });

      matched.sort((a, b) => {
        return String(b.fecha || '').localeCompare(String(a.fecha || '')) ||
          (timeToMins(b.inicio || b.hora_inicio) - timeToMins(a.inicio || a.hora_inicio));
      });

      setHistoryData({
        name: name.trim().toUpperCase(),
        type,
        loading: false,
        items: matched
      });
    } catch (e) {
      console.warn('Error al cargar historial anual de reservas:', e);
      setHistoryData(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  const calculateTotalHours = (items) => {
    if (!Array.isArray(items) || items.length === 0) return 0;
    let mins = 0;
    items.forEach(it => {
      const start = timeToMins(it.inicio || it.hora_inicio);
      const end = timeToMins(it.final || it.hora_fin);
      if (end > start) mins += (end - start);
    });
    return (mins / 60).toFixed(1).replace('.0', '');
  };

  const getUniqueRoomsCount = (items) => {
    if (!Array.isArray(items)) return 0;
    const set = new Set();
    items.forEach(it => {
      getReservationRooms(it).forEach(a => set.add(a));
    });
    return set.size;
  };

  const isDateUpcoming = (fecha) => {
    if (!fecha) return false;
    const today = new Date().toISOString().split('T')[0];
    return fecha > today;
  };

  const isDateToday = (fecha) => {
    if (!fecha) return false;
    const today = new Date().toISOString().split('T')[0];
    return fecha === today;
  };

  const filteredHistoryItems = useMemo(() => {
    if (!historyData || !Array.isArray(historyData.items)) return [];
    if (!historySearch.trim()) return historyData.items;
    const q = historySearch.trim().toLowerCase();
    return historyData.items.filter(item => {
      const rooms = getReservationRooms(item).join(' ').toLowerCase();
      const det = (item.detalle || item.motivo || '').toLowerCase();
      const mes = (item.mes || '').toLowerCase();
      const fecha = (item.fecha || '').toLowerCase();
      const dia = (item.dia || '').toLowerCase();
      const u = (item.usuario || '').toLowerCase();
      return (
        rooms.includes(q) ||
        det.includes(q) ||
        mes.includes(q) ||
        fecha.includes(q) ||
        dia.includes(q) ||
        u.includes(q)
      );
    });
  }, [historyData, historySearch]);

  // Sliding pill indicators across filter & view strips
  const viewModeSlide = useSlidingIndicator(viewMode);
  const activeDayKey = viewMode === 'FREE_ROOMS'
    ? String(selectedDayOffset ?? 0)
    : (selectedDayOffset === null ? 'ALL' : String(selectedDayOffset));
  const dateSlide = useSlidingIndicator(activeDayKey, [viewMode]);
  const pabSlide = useSlidingIndicator(selectedPabellon || 'ALL', [mobileFiltersOpen]);
  const pisoSlideKey = selectedPisos.length === 0 ? 'ALL' : (selectedPisos.length === 1 ? selectedPisos[0] : '');
  const pisoSlide = useSlidingIndicator(pisoSlideKey, [selectedPisos.length, mobileFiltersOpen]);
  const currentHoraRef = getCurrentHourBlock();
  const horaSlideKey = !selectedHoraBlock ? 'ANY' : (selectedHoraBlock === currentHoraRef ? 'CURRENT' : selectedHoraBlock);
  const horaSlide = useSlidingIndicator(horaSlideKey, [viewMode]);

  const pickerCatSlide = useSlidingIndicator(pickerCategory, [roomPickerModalFade.isMounted, roomPickerModalFade.isVisible]);
  const pickerPabSlide = useSlidingIndicator(pickerPabellon || 'ALL', [roomPickerModalFade.isMounted, roomPickerModalFade.isVisible]);
  const pickerPisoSlide = useSlidingIndicator(pickerPiso || 'ALL', [roomPickerModalFade.isMounted, roomPickerModalFade.isVisible]);

  // Directional slide animation for content grid
  const [contentTransition, setContentTransition] = useState(() => ({
    viewMode,
    day: selectedDayOffset,
    dir: 'initial'
  }));
  if (contentTransition.viewMode !== viewMode || contentTransition.day !== selectedDayOffset) {
    let nextDir = 'next';
    if (contentTransition.viewMode !== viewMode) {
      nextDir = viewMode === 'FREE_ROOMS' ? 'next' : 'prev';
    } else {
      const prevIdx = contentTransition.day === null ? -1 : contentTransition.day;
      const nextIdx = selectedDayOffset === null ? -1 : selectedDayOffset;
      nextDir = nextIdx < prevIdx ? 'prev' : 'next';
    }
    setContentTransition({ viewMode, day: selectedDayOffset, dir: nextDir });
  }
  const contentAnimClass =
    contentTransition.dir === 'prev'
      ? 'animate-slide-prev'
      : contentTransition.dir === 'next'
        ? 'animate-slide-next'
        : 'animate-fade-in';

  const closeModal = () => {
    reservationModalFade.requestClose();
  };

  // Helper universal para extraer todas las aulas reservadas de un registro (1 o varias en simultáneo)
  const getReservationRooms = (r) => {
    if (!r) return [];
    if (Array.isArray(r.aulas) && r.aulas.length > 0) {
      return r.aulas.map(a => String(a).trim().toUpperCase()).filter(Boolean);
    }
    if (!r.aula) return [];
    return String(r.aula)
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);
  };

  // Obtener horario específico para un aula dentro de una reserva múltiple
  const getRoomSchedule = (r, roomCode) => {
    if (!r) return { fecha: '', inicio: '', final: '' };
    let scheds = r.schedules;
    if (!scheds && r.obs) {
      try {
        if (typeof r.obs === 'string' && r.obs.startsWith('{') && r.obs.includes('"schedules"')) {
          const parsed = JSON.parse(r.obs);
          scheds = parsed.schedules;
        }
      } catch (e) {}
    }
    const cleanRoom = String(roomCode || '').trim().toUpperCase();
    if (scheds && scheds[cleanRoom]) {
      return {
        fecha: scheds[cleanRoom].fecha || r.fecha,
        inicio: scheds[cleanRoom].inicio || r.inicio || r.hora_inicio,
        final: scheds[cleanRoom].final || r.final || r.hora_fin
      };
    }
    return {
      fecha: r.fecha,
      inicio: r.inicio || r.hora_inicio,
      final: r.final || r.hora_fin
    };
  };

  const hasMultipleDifferentSchedules = (r) => {
    const rooms = getReservationRooms(r);
    if (rooms.length <= 1) return false;
    const base = getRoomSchedule(r, rooms[0]);
    return rooms.some(a => {
      const s = getRoomSchedule(r, a);
      return s.fecha !== base.fecha || s.inicio !== base.inicio || s.final !== base.final;
    });
  };

  const getCleanObsText = (obs) => {
    if (!obs) return '';
    if (typeof obs === 'string' && obs.startsWith('{') && obs.includes('"schedules"')) {
      try {
        const parsed = JSON.parse(obs);
        return parsed.note || '';
      } catch (e) {}
    }
    return obs;
  };

  const MONTHS_LIST = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SETIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
  ];

  useEffect(() => {
    if (initialOpenTrigger) {
      resetForm();
      setIsModalOpen(true);
      if (onConsumeTrigger) onConsumeTrigger();
    }
  }, [initialOpenTrigger]);

  // Opciones de meses formateadas para el selector estilizado Apple Liquid
  const monthOptions = useMemo(() => [
    { value: '', label: 'Todos los meses' },
    ...MONTHS_LIST.map((m) => ({
      value: m,
      label: m.charAt(0) + m.slice(1).toLowerCase()
    }))
  ], []);

  // Generar los próximos 14 días (Hoy + 13 días siguientes, garantizando Sábado y Domingo visibles)
  const upcomingDays = useMemo(() => {
    const list = [];
    const base = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const fechaStr = `${yyyy}-${mm}-${dd}`;
      const diaName = DAYS_OF_WEEK[d.getDay()];
      const diaShort = DAYS_SHORT[d.getDay()];
      const mesName = MONTHS_UPPER[d.getMonth()];
      list.push({
        offset: i,
        fecha: fechaStr,
        shortDate: `${dd}/${mm}`,
        diaName,
        diaShort,
        mesName,
        label: i === 0 ? `Hoy (${diaShort})` : i === 1 ? `Mañana (${diaShort})` : `${diaShort} ${dd}/${mm}`
      });
    }
    return list;
  }, []);

  // Día activo para consulta de disponibilidad (si está en null, usa Hoy por defecto para Aulas Libres)
  const activeDayInfo = useMemo(() => {
    const idx = selectedDayOffset !== null ? selectedDayOffset : 0;
    return upcomingDays[idx] || upcomingDays[0];
  }, [selectedDayOffset, upcomingDays]);

  const dateScrollRef = useRef(null);
  const scrollDates = (direction) => {
    if (dateScrollRef.current) {
      dateScrollRef.current.scrollBy({
        left: direction === 'left' ? -260 : 260,
        behavior: 'smooth'
      });
    }
  };

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    mes: MONTHS_UPPER[new Date().getMonth()],
    dia: DAYS_OF_WEEK[new Date().getDay()],
    inicio: '14:30',
    final: '16:10',
    aulas: [],
    aula: '',
    ubicacion: '',
    docente: '',
    motivo: '',
    detalle: '',
    usuario: getLoggedAssistantName(),
    obs: '',
    prioridad: 'NORMAL'
  });

  // Estado para horarios individuales por aula en reserva múltiple
  const [roomSchedules, setRoomSchedules] = useState({});

  const updateRoomSchedule = (room, field, val) => {
    setRoomSchedules(prev => ({
      ...prev,
      [room]: {
        ...(prev[room] || { fecha: formData.fecha, inicio: formData.inicio, final: formData.final }),
        [field]: val
      }
    }));
  };

  const applyBaseScheduleToAll = () => {
    const rooms = getReservationRooms(formData);
    setRoomSchedules(prev => {
      const next = { ...prev };
      rooms.forEach(a => {
        next[a] = {
          fecha: formData.fecha,
          inicio: formData.inicio,
          final: formData.final
        };
      });
      return next;
    });
    setToastMessage('✅ Horario base aplicado a todas las aulas');
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleRemoveSelectedRoom = (roomToRemove) => {
    const currentRooms = getReservationRooms(formData);
    const rooms = currentRooms.filter(a => a !== roomToRemove);
    setSelectedAulas(rooms);
    setFormData(prev => ({
      ...prev,
      aulas: rooms,
      aula: rooms.join(', '),
      ubicacion: rooms.map(a => {
        const rm = roomMap[a];
        return rm ? `${rm.piso} - ${rm.pabellon}` : (deducePisoFromAula(a) || 'SEDE');
      }).filter((v, i, arr) => arr.indexOf(v) === i).join(', ')
    }));
    setRoomSchedules(prev => {
      const next = { ...prev };
      delete next[roomToRemove];
      return next;
    });
  };

  // Mantener actualizado el asistente autenticado si cambia la sesión o se abre el modal
  useEffect(() => {
    const handleAuth = () => {
      setFormData(prev => ({ ...prev, usuario: getLoggedAssistantName() }));
    };
    window.addEventListener('steel:auth-changed', handleAuth);
    return () => window.removeEventListener('steel:auth-changed', handleAuth);
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      setFormData(prev => ({
        ...prev,
        usuario: isAdmin() ? (prev.usuario || getLoggedAssistantName()) : getLoggedAssistantName()
      }));
    }
  }, [isModalOpen]);

  const handleTogglePiso = (val) => {
    if (!val) {
      setSelectedPisos([]);
      return;
    }
    setSelectedPisos(prev =>
      prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]
    );
  };

  const loadReservasAndRooms = async () => {
    setLoading(true);
    try {
      const [resReservas, resRooms] = await Promise.all([
        fetch(selectedMes ? `/api/reservations?mes=${encodeURIComponent(selectedMes)}` : '/api/reservations'),
        fetch('/api/rooms')
      ]);
      const [jsonReservas, jsonRooms] = await Promise.all([
        resReservas.json(),
        resRooms.json()
      ]);
      if (jsonReservas.success) setReservas(jsonReservas.data || []);
      if (jsonRooms.success) setRooms(jsonRooms.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar clases programadas del día seleccionado para calcular qué aulas están libres hoy o en los próximos días
  const loadScheduleForDay = async (diaName) => {
    if (!diaName) return;
    setLoadingClasses(true);
    try {
      const res = await fetch(`/api/attendance?dia=${encodeURIComponent(diaName)}`);
      const json = await res.json();
      if (json.success) {
        setDayClasses(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingClasses(false);
    }
  };

  useEffect(() => {
    loadReservasAndRooms();
    const handlePulled = () => loadReservasAndRooms();
    window.addEventListener('upn:excel-pulled', handlePulled);
    return () => window.removeEventListener('upn:excel-pulled', handlePulled);
  }, []);

  // Cargar lista completa de docentes de la universidad desde el horario (Excel) para autocompletado inteligente
  useEffect(() => {
    fetch('/api/attendance')
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          const docs = Array.from(
            new Set(
              json.data
                .map(c => (c.docente || '').trim().toUpperCase())
                .filter(d => d && !d.includes('#N/D') && !d.includes('#N/A') && d.length > 3)
            )
          ).sort();
          setDocentesList(docs);
        }
      })
      .catch(() => {});
  }, []);

  // Limpieza y normalización de nombres de docentes (elimina slashes, puntuación, saltos y espacios duplicados)
  const cleanDocenteName = (name) => {
    if (!name) return '';
    return String(name)
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\u00a0/g, ' ')
      .replace(/[\/,.\-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  };

  const getDocenteSignature = (name) => {
    const clean = cleanDocenteName(name)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const words = clean.split(' ').filter(w => w.length > 1);
    words.sort();
    return words.join(' ');
  };

  const allKnownDocentes = useMemo(() => {
    const rawList = [];
    docentesList.forEach(d => { if (d) rawList.push(d); });
    reservas.forEach(r => { if (r.docente) rawList.push(r.docente); });

    // Agrupar por firma de palabras para que variaciones (con slash, sin slash, orden o comas) no se repitan
    const groups = new Map();
    for (const raw of rawList) {
      const cleaned = cleanDocenteName(raw);
      if (!cleaned || cleaned.includes('#N/D') || cleaned.includes('#N/A') || cleaned.length < 4) continue;
      if (cleaned.startsWith('PRUEBA') || cleaned.startsWith('DOCENTE PRUEBA') || cleaned === 'TEST') continue;

      const sig = getDocenteSignature(cleaned);
      if (!groups.has(sig)) {
        groups.set(sig, new Set());
      }
      groups.get(sig).add(cleaned);
    }

    const uniqueList = [];
    for (const [sig, variantsSet] of groups.entries()) {
      const variants = Array.from(variantsSet);
      // Seleccionar la variante más limpia y descriptiva
      variants.sort((a, b) => b.length - a.length);
      uniqueList.push(variants[0]);
    }

    return uniqueList.sort((a, b) => a.localeCompare(b, 'es'));
  }, [docentesList, reservas]);

  const docenteSuggestions = useMemo(() => {
    const rawQ = (formData.docente || '').trim();
    if (!rawQ || rawQ.length < 2) return [];

    const cleanQ = rawQ
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[\/,.\-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const queryWords = cleanQ.split(' ').filter(Boolean);
    if (queryWords.length === 0) return [];

    return allKnownDocentes
      .filter(doc => {
        const normDoc = doc
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toUpperCase()
          .replace(/[\/,.\-_]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Si ya escribió el nombre exacto completo, no hace falta sugerirlo
        if (normDoc === cleanQ) return false;

        // Cada término buscado por el usuario debe coincidir en cualquier parte del nombre
        return queryWords.every(word => normDoc.includes(word));
      })
      .slice(0, 8);
  }, [allKnownDocentes, formData.docente]);

  useEffect(() => {
    loadScheduleForDay(activeDayInfo.diaName);
  }, [activeDayInfo.diaName]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Catálogo unificado de todas las aulas, laboratorios y talleres
  const allRooms = useMemo(() => {
    const map = new Map();
    CAMPUS_ROOMS_CATALOG.forEach(rm => {
      map.set(rm.abrv.toUpperCase().trim(), {
        ...rm,
        categoria: inferCategoria(rm)
      });
    });
    rooms.forEach(rm => {
      if (!rm.abrv) return;
      const key = rm.abrv.toUpperCase().trim();
      const existing = map.get(key) || {};
      const merged = {
        ...existing,
        ...rm,
        abrv: key,
        nombre: existing.nombre || rm.nombre || `Ambiente ${key}`,
        tipo: existing.tipo || rm.tipo || 'Aula'
      };
      merged.categoria = inferCategoria(merged);
      map.set(key, merged);
    });
    return Array.from(map.values());
  }, [rooms]);

  // Mapa rápido de aulas para obtener piso y pabellón
  const roomMap = useMemo(() => {
    const map = {};
    allRooms.forEach(rm => {
      if (rm.abrv) map[rm.abrv.toUpperCase().trim()] = rm;
    });
    return map;
  }, [allRooms]);

  // Cargar clases del día elegido dentro del modal "Nueva Reserva"
  useEffect(() => {
    const dt = new Date((formData.fecha || new Date().toISOString().split('T')[0]) + 'T12:00:00');
    const diaModal = DAYS_OF_WEEK[dt.getDay()] || formData.dia;
    if (diaModal === activeDayInfo.diaName) {
      setModalDayClasses(dayClasses);
      return;
    }
    let cancelled = false;
    fetch(`/api/attendance?dia=${encodeURIComponent(diaModal)}`)
      .then(r => r.json())
      .then(j => {
        if (!cancelled && j.success) {
          setModalDayClasses(j.data || []);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [formData.fecha, activeDayInfo.diaName, dayClasses]);

  // Solo aulas que estén 100% LIBRES en la fecha y rango horario (inicio - final) de la Nueva Reserva
  const freeRoomsForModalTime = useMemo(() => {
    const bStart = timeToMins(formData.inicio);
    const bEnd = timeToMins(formData.final);
    const targetFecha = normalizeDateStr(formData.fecha);

    return allRooms.filter(rm => {
      const code = (rm.abrv || '').toUpperCase().trim();

      // Conflicto con clases programadas ese día
      const classConflict = modalDayClasses.some(c => {
        if ((c.aula || '').toUpperCase().trim() !== code) return false;
        const cStart = timeToMins(c.horaInicioProg);
        const cEnd = timeToMins(c.horaFinalProg);
        return cStart < bEnd && cEnd > bStart;
      });
      if (classConflict) return false;

      // Conflicto con otras reservas en esa misma fecha (evitar cualquier aula ocupada)
      const resConflict = reservas.some(r => {
        const rRooms = getReservationRooms(r);
        if (!rRooms.includes(code)) return false;
        const rFecha = normalizeDateStr(r.fecha);
        if (rFecha && targetFecha) {
          if (rFecha !== targetFecha) return false;
        } else if (normalizeDay(r.dia) !== normalizeDay(formData.dia)) {
          return false;
        }
        const rStart = timeToMins(r.inicio || r.hora_inicio);
        const rEnd = timeToMins(r.final || r.hora_fin);
        return rStart < bEnd && rEnd > bStart;
      });
      if (resConflict) return false;

      return true;
    });
  }, [allRooms, modalDayClasses, reservas, formData.fecha, formData.dia, formData.inicio, formData.final]);

  // Si las aulas previamente seleccionadas por el usuario pasan a estar ocupadas al cambiar horario/fecha, mantener solo las que sigan libres
  useEffect(() => {
    if (!isModalOpen) return;
    const currentRooms = getReservationRooms(formData);
    if (currentRooms.length === 0) return;
    const validRooms = currentRooms.filter(c => freeRoomsForModalTime.some(r => r.abrv === c));
    if (validRooms.length !== currentRooms.length) {
      setFormData(prev => ({
        ...prev,
        aulas: validRooms,
        aula: validRooms.join(', '),
        ubicacion: validRooms.map(a => {
          const rm = roomMap[a];
          return rm ? `${rm.piso} - ${rm.pabellon}` : (deducePisoFromAula(a) || 'SEDE');
        }).filter((v, i, arr) => arr.indexOf(v) === i).join(', ')
      }));
      setSelectedAulas(validRooms);
    }
  }, [isModalOpen, freeRoomsForModalTime]);

  // Lista filtrada para el menú selector de Aula / Laboratorio dentro del modal (SOLO AULAS LIBRES)
  const pickerFilteredRooms = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return freeRoomsForModalTime.filter(rm => {
      if (pickerCategory !== 'ALL' && rm.categoria !== pickerCategory) return false;
      if (pickerPabellon && rm.pabellon !== pickerPabellon) return false;
      if (pickerPiso && !matchesPiso(rm.piso, pickerPiso)) return false;
      if (q) {
        const hit =
          (rm.abrv && rm.abrv.toLowerCase().includes(q)) ||
          (rm.nombre && rm.nombre.toLowerCase().includes(q)) ||
          (rm.tipo && rm.tipo.toLowerCase().includes(q)) ||
          (rm.piso && rm.piso.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [freeRoomsForModalTime, pickerCategory, pickerPabellon, pickerPiso, pickerSearch]);

  const handleToggleRoomInPicker = (rmAbrv) => {
    const isFree = freeRoomsForModalTime.some(r => r.abrv === rmAbrv);
    if (!isFree) return;
    setSelectedAulas(prev => {
      if (isMultiRoomMode) {
        if (prev.includes(rmAbrv)) {
          return prev.filter(a => a !== rmAbrv);
        } else {
          return [...prev, rmAbrv];
        }
      } else {
        // En modo estándar de aula única: selecciona únicamente esta aula y deselecciona cualquier otra previa
        if (prev.length === 1 && prev[0] === rmAbrv) {
          return [];
        }
        return [rmAbrv];
      }
    });
  };

  const handleConfirmRoomPicker = () => {
    const cleanList = [...selectedAulas];
    if (cleanList.length === 0) {
      setFormData(prev => ({
        ...prev,
        aulas: [],
        aula: '',
        ubicacion: ''
      }));
      setRoomSchedules({});
      roomPickerModalFade.requestClose(() => setIsRoomPickerOpen(false));
      return;
    }
    const primaryRm = roomMap[cleanList[0]];
    const userUbicacion = cleanList.map(a => {
      const rm = roomMap[a];
      return rm ? `${rm.piso} - ${rm.pabellon}` : (deducePisoFromAula(a) || 'SEDE');
    }).filter((v, i, arr) => arr.indexOf(v) === i).join(', ');

    setFormData(prev => ({
      ...prev,
      aulas: cleanList,
      aula: cleanList.join(', '),
      ubicacion: userUbicacion || (primaryRm ? `${primaryRm.piso} - ${primaryRm.pabellon}` : prev.ubicacion)
    }));

    // Inicializar o sincronizar horarios individuales por aula
    setRoomSchedules(prev => {
      const next = { ...prev };
      cleanList.forEach(a => {
        if (!next[a]) {
          next[a] = {
            fecha: formData.fecha,
            inicio: formData.inicio,
            final: formData.final
          };
        }
      });
      Object.keys(next).forEach(k => {
        if (!cleanList.includes(k)) delete next[k];
      });
      return next;
    });

    roomPickerModalFade.requestClose(() => setIsRoomPickerOpen(false));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanAulas = getReservationRooms(formData);
    if (cleanAulas.length === 0) {
      alert('Por favor selecciona al menos un ambiente libre para reservar.');
      return;
    }

    const finalDocente = (formData.docente || '').toUpperCase().trim();
    if (!finalDocente) {
      alert('Por favor ingresa o selecciona el nombre del Docente Solicitante.');
      return;
    }

    const finalDetalle = (formData.detalle || formData.motivo || 'USO DE LABORATORIO').toUpperCase().trim();
    if (!finalDetalle) {
      alert('Por favor especifica la Actividad o Motivo de la reserva.');
      return;
    }

    // Validación de horas individuales o generales
    if (cleanAulas.length === 1) {
      if (formData.inicio && formData.final && formData.inicio >= formData.final) {
        alert('La hora de inicio debe ser anterior a la hora de fin.');
        return;
      }
    } else {
      for (const a of cleanAulas) {
        const sched = roomSchedules[a] || { fecha: formData.fecha, inicio: formData.inicio, final: formData.final };
        if (sched.inicio && sched.final && sched.inicio >= sched.final) {
          alert(`En el ambiente ${a}, la hora de inicio (${sched.inicio}) debe ser anterior a la hora de fin (${sched.final}).`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const finalUsuario = (isAdmin() ? (formData.usuario || getLoggedAssistantName()) : getLoggedAssistantName()).toUpperCase().trim();
      const finalPrioridad = (formData.prioridad || 'NORMAL').toUpperCase().trim();

      const cleanAula = cleanAulas.join(', ');
      const firstRm = roomMap[cleanAulas[0]];
      const dt = new Date((formData.fecha || new Date().toISOString().split('T')[0]) + 'T12:00:00');
      const computedDia = DAYS_OF_WEEK[dt.getDay()] || formData.dia || 'LUNES';
      const computedMes = MONTHS_UPPER[dt.getMonth()] || formData.mes || 'OCTUBRE';
      const userUbicacion = (formData.ubicacion || '').trim();
      const fallbackUbicacion = cleanAulas.map(a => {
        const rm = roomMap[a];
        return rm ? `${rm.piso} - ${rm.pabellon}` : (deducePisoFromAula(a) || 'SEDE');
      }).filter((v, i, arr) => arr.indexOf(v) === i).join(', ');
      const finalUbicacion = (userUbicacion || fallbackUbicacion || (firstRm ? `${firstRm.piso} - ${firstRm.pabellon}` : 'SEDE')).toUpperCase();

      // Verificar si las aulas tienen horarios o fechas individuales diferentes
      const hasDifferentSchedules = cleanAulas.length > 1 && cleanAulas.some(a => {
        const s = roomSchedules[a] || { fecha: formData.fecha, inicio: formData.inicio, final: formData.final };
        return s.fecha !== formData.fecha || s.inicio !== formData.inicio || s.final !== formData.final;
      });

      // Generar ID de lote/grupo para vincular todas las aulas de la reserva múltiple
      const groupId = 'grp_' + Date.now();
      const schedulesPack = {};
      cleanAulas.forEach(a => {
        schedulesPack[a] = roomSchedules[a] || { fecha: formData.fecha, inicio: formData.inicio, final: formData.final };
      });
      const obsPayload = JSON.stringify({
        group_id: groupId,
        schedules: schedulesPack,
        note: formData.obs || ''
      });

      // Se guarda como UNA SOLA RESERVA (una sola tarjeta en la app y una fila maestra en Excel)
      const payload = {
        fecha: formData.fecha,
        mes: computedMes,
        dia: computedDia,
        inicio: formData.inicio,
        final: formData.final,
        aulas: cleanAulas,
        aula: cleanAula,
        ubicacion: finalUbicacion,
        docente: finalDocente,
        detalle: finalDetalle,
        motivo: finalDetalle,
        usuario: finalUsuario,
        prioridad: finalPrioridad,
        obs: obsPayload,
        schedules: hasDifferentSchedules ? roomSchedules : null,
        hoja: 'RESERVAS'
      };

      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || json.message || 'Error al guardar reserva');
      }

      const createdReserva = {
        ...json.data,
        aulas: cleanAulas,
        schedules: hasDifferentSchedules ? roomSchedules : null
      };

      setReservas(prev => [createdReserva, ...prev.filter(r => r.id !== createdReserva.id)]);
      const toastDesc = cleanAulas.length > 1
        ? `✅ Reserva múltiple guardada en una sola tarjeta (${cleanAulas.length} Aulas: ${cleanAula})`
        : `✅ Guardado en Excel: Hoja "RESERVAS" (Aula ${cleanAula})`;
      setToastMessage(toastDesc);
      setTimeout(() => setToastMessage(''), 3500);
      closeModal();
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Error al registrar reserva: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    const target = activeDayInfo || upcomingDays[0];
    const blockObj = REAL_BLOCKS.find(b => b.start === selectedHoraBlock) || REAL_BLOCKS[4];
    setFormData({
      fecha: target.fecha,
      mes: target.mesName,
      dia: target.diaName,
      inicio: blockObj.start,
      final: blockObj.end,
      aulas: [],
      aula: '',
      ubicacion: '',
      docente: '',
      detalle: '',
      motivo: '',
      usuario: getLoggedAssistantName(),
      prioridad: 'NORMAL'
    });
    setSelectedAulas([]);
    setRoomSchedules({});
    setIsMultiRoomMode(false);
    setDocenteSuggestionsOpen(false);
  };

  const handleOpenReserveForFreeRoom = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleDelete = async (idOrCard) => {
    const card = typeof idOrCard === 'object' && idOrCard !== null ? idOrCard : { id: idOrCard, ids: [idOrCard], aulas: [] };
    const idsToDelete = card.ids || [card.id];
    const count = idsToDelete.length;
    const roomsLabel = card.aulas && card.aulas.length > 0 ? ` (${card.aulas.join(', ')})` : '';
    const confirmMsg = count > 1
      ? `¿Seguro que deseas cancelar esta reserva múltiple de ${card.aulas?.length || count} aulas${roomsLabel}? Se eliminará de la app y del Excel en OneDrive.`
      : '¿Seguro que deseas cancelar esta reserva? Se eliminará de la app y del Excel en OneDrive.';
    if (!confirm(confirmMsg)) return;

    setReservas(prev => prev.filter(r => !idsToDelete.includes(r.id)));
    const toastDesc = count > 1 ? `✅ Reserva múltiple cancelada y filas limpiadas en Excel` : `✅ Reserva cancelada y fila limpiada en Excel`;
    setToastMessage(toastDesc);
    setTimeout(() => setToastMessage(''), 3500);

    for (const singleId of idsToDelete) {
      await fetch(`/api/reservations/${singleId}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  const [copiedId, setCopiedId] = useState(null);

  const formatExcelDate = (val) => {
    if (!val) return '';
    const s = String(val).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      const y = m[1];
      const mo = m[2].padStart(2, '0');
      const d = m[3].padStart(2, '0');
      return `${d}/${mo}/${y}`;
    }
    return s;
  };

  // Copia la fila o tabla exacta de la reserva con el modelo solicitado:
  // FECHA | DIA | INICIO | FINAL | AULA | UBICACIÓN | DOCENTE | DETALLE
  // Si la tarjeta cuenta con múltiples aulas reservadas en simultáneo, genera todas las filas correspondientes en la tabla
  const handleCopyReservation = async (r, onlyData = false) => {
    const formattedFecha = formatExcelDate(r.fecha);

    let dia = (r.dia || '').trim().toUpperCase();
    if (!dia && r.fecha) {
      const dt = new Date(r.fecha + 'T12:00:00');
      if (!Number.isNaN(dt.getTime())) {
        const daysMap = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
        dia = daysMap[dt.getDay()] || '';
      }
    } else if (dia === 'SABADO') {
      dia = 'SÁBADO';
    } else if (dia === 'MIERCOLES') {
      dia = 'MIÉRCOLES';
    }

    const inicio = (r.inicio || r.hora_inicio || '').trim();
    const final = (r.final || r.hora_fin || '').trim();
    const docente = (r.docente || '').trim().toUpperCase();
    const detalle = (r.detalle || r.motivo || '').trim().toUpperCase();

    // Modelo exacto: FECHA | DIA | INICIO | FINAL | AULA | UBICACIÓN | DOCENTE | DETALLE
    const headers = ['FECHA', 'DIA', 'INICIO', 'FINAL', 'AULA', 'UBICACIÓN', 'DOCENTE', 'DETALLE'];

    // Extraer todas las aulas reservadas en esta tarjeta
    const cardAulas = getReservationRooms(r);
    const finalAulas = cardAulas.length > 0 ? cardAulas : [(r.aula || 'S/A').trim().toUpperCase()];

    // Generar fila para cada aula en simultáneo con sus respectivos horarios
    const rows = finalAulas.map(a => {
      const sched = getRoomSchedule(r, a);
      const roomFechaFormatted = formatExcelDate(sched.fecha || r.fecha);
      let roomDia = dia;
      if (sched.fecha && sched.fecha !== r.fecha) {
        const dt = new Date(sched.fecha + 'T12:00:00');
        if (!Number.isNaN(dt.getTime())) {
          const daysMap = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
          roomDia = daysMap[dt.getDay()] || '';
        }
      }
      const roomInicio = (sched.inicio || inicio).trim();
      const roomFinal = (sched.final || final).trim();

      const rm = roomMap[a];
      let ubicacion = (rm ? `${rm.piso} - ${rm.pabellon}` : (deducePisoFromAula(a) || r.ubicacion || 'SEDE')).trim().toUpperCase();
      if (rm && !ubicacion.includes('-') && rm.pabellon) {
        ubicacion = `${rm.piso} - ${rm.pabellon}`;
      }
      return [roomFechaFormatted, roomDia, roomInicio, roomFinal, a, ubicacion, docente, detalle];
    });

    // Formato delimitado por tabulaciones (TSV) - estándar universal para pegar en celdas de Excel
    const tsvText = onlyData
      ? rows.map(row => row.join('\t')).join('\n')
      : `${headers.join('\t')}\n${rows.map(row => row.join('\t')).join('\n')}`;

    // Tabla HTML formateada para pegar directamente en correos y Excel con encabezados gold oficiales
    const htmlTable = `
<meta http-equiv="content-type" content="text/html; charset=utf-8">
<!--StartFragment-->
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:10pt;border:1px solid #000000;text-align:center;">
  ${!onlyData ? `<thead>
    <tr>
      ${headers.map(h => `<th style="padding:6px 10px;border:1px solid #000000;background-color:#FFC000;color:#000000;font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;text-align:center;white-space:nowrap;">${h}</th>`).join('')}
    </tr>
  </thead>` : ''}
  <tbody>
    ${rows.map(values => `
    <tr style="background-color:#ffffff;color:#000000;">
      ${values.map((v, idx) => {
        const isLeft = idx === 6 || idx === 7;
        const isBold = idx === 0 || idx === 2 || idx === 3 || idx === 4;
        return `<td style="padding:6px 8px;border:1px solid #000000;background-color:#FFFFFF;color:#000000;font-family:Calibri,Arial,sans-serif;font-size:10pt;text-align:${isLeft ? 'left' : 'center'};${isBold ? 'font-weight:bold;' : ''};white-space:nowrap;">${v || ''}</td>`;
      }).join('')}
    </tr>`).join('')}
  </tbody>
</table>
<!--EndFragment-->`.trim();

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const textBlob = new Blob([tsvText], { type: 'text/plain' });
        const htmlBlob = new Blob([htmlTable], { type: 'text/html' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': textBlob,
            'text/html': htmlBlob
          })
        ]);
      } else {
        await navigator.clipboard.writeText(tsvText);
      }
      setCopiedId(r.id);
      const copyMsg = finalAulas.length > 1
        ? `📋 Copiada tabla de ${finalAulas.length} aulas: ${finalAulas.join(', ')} (${formattedFecha})`
        : (onlyData ? `📋 Copiada fila de reserva: ${finalAulas[0]}` : `📋 Fila copiada con encabezados: ${finalAulas[0]} (${formattedFecha})`);
      setToastMessage(copyMsg);
      setTimeout(() => setCopiedId(null), 2500);
      setTimeout(() => setToastMessage(''), 3500);
    } catch (err) {
      console.error('Error al copiar:', err);
      try {
        await navigator.clipboard.writeText(tsvText);
        setCopiedId(r.id);
        setToastMessage(`📋 Tabla copiada: ${finalAulas.join(', ')}`);
        setTimeout(() => setCopiedId(null), 2500);
        setTimeout(() => setToastMessage(''), 3500);
      } catch (e2) {
        alert('No se pudo copiar al portapapeles.');
      }
    }
  };

  // Copiar historial completo de un docente / usuario
  const handleCopyAllHistory = async (items, name) => {
    if (!Array.isArray(items) || items.length === 0) return;
    const headers = ['FECHA', 'DIA', 'INICIO', 'FINAL', 'AULA', 'UBICACIÓN', 'DOCENTE', 'DETALLE', 'REGISTRADO POR'];
    const rows = [];

    items.forEach(r => {
      const rooms = getReservationRooms(r);
      const finalAulas = rooms.length > 0 ? rooms : [(r.aula || 'S/A').trim().toUpperCase()];
      finalAulas.forEach(a => {
        const sched = getRoomSchedule(r, a);
        const fFecha = formatExcelDate(sched.fecha || r.fecha);
        let dia = (r.dia || '').trim().toUpperCase();
        if (sched.fecha && sched.fecha !== r.fecha) {
          const dt = new Date(sched.fecha + 'T12:00:00');
          if (!Number.isNaN(dt.getTime())) {
            const daysMap = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
            dia = daysMap[dt.getDay()] || '';
          }
        }
        const inicio = sched.inicio || r.inicio || r.hora_inicio || '';
        const final = sched.final || r.final || r.hora_fin || '';
        const rm = roomMap[a];
        let ubicacion = (rm ? `${rm.piso} - ${rm.pabellon}` : (deducePisoFromAula(a) || r.ubicacion || 'SEDE')).trim().toUpperCase();
        const docente = (r.docente || '').trim().toUpperCase();
        const detalle = (r.detalle || r.motivo || '').trim().toUpperCase();
        const usuario = (r.usuario || '').trim().toUpperCase();
        rows.push([fFecha, dia, inicio, final, a, ubicacion, docente, detalle, usuario]);
      });
    });

    const tsvText = `${headers.join('\t')}\n${rows.map(row => row.join('\t')).join('\n')}`;
    const htmlTable = `
<meta http-equiv="content-type" content="text/html; charset=utf-8">
<!--StartFragment-->
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:10pt;border:1px solid #000000;text-align:center;">
  <thead>
    <tr>
      ${headers.map(h => `<th style="padding:6px 10px;border:1px solid #000000;background-color:#FFC000;color:#000000;font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;text-align:center;white-space:nowrap;">${h}</th>`).join('')}
    </tr>
  </thead>
  <tbody>
    ${rows.map(values => `
    <tr style="background-color:#ffffff;color:#000000;">
      ${values.map((v, idx) => {
        const isLeft = idx === 6 || idx === 7 || idx === 8;
        const isBold = idx === 0 || idx === 2 || idx === 3 || idx === 4;
        return `<td style="padding:6px 8px;border:1px solid #000000;background-color:#FFFFFF;color:#000000;font-family:Calibri,Arial,sans-serif;font-size:10pt;text-align:${isLeft ? 'left' : 'center'};${isBold ? 'font-weight:bold;' : ''};white-space:nowrap;">${v || ''}</td>`;
      }).join('')}
    </tr>`).join('')}
  </tbody>
</table>
<!--EndFragment-->`.trim();

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const textBlob = new Blob([tsvText], { type: 'text/plain' });
        const htmlBlob = new Blob([htmlTable], { type: 'text/html' });
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/plain': textBlob, 'text/html': htmlBlob })
        ]);
      } else {
        await navigator.clipboard.writeText(tsvText);
      }
      setToastMessage(`📋 Historial anual copiado (${rows.length} registros para Excel)`);
      setTimeout(() => setToastMessage(''), 3500);
    } catch (err) {
      try {
        await navigator.clipboard.writeText(tsvText);
        setToastMessage(`📋 Historial anual copiado: ${name}`);
        setTimeout(() => setToastMessage(''), 3500);
      } catch (e2) {
        alert('No se pudo copiar el historial al portapapeles.');
      }
    }
  };

  // Consolidación inteligente de reservas: agrupa reservas de una misma reserva múltiple en UNA SOLA TARJETA
  const consolidatedReservas = useMemo(() => {
    const map = new Map();
    const order = [];

    reservas.forEach(r => {
      // 1. Clave de agrupación
      let groupKey = null;
      if (r.group_id) {
        groupKey = `grp_${r.group_id}`;
      } else if (r.obs && typeof r.obs === 'string' && r.obs.includes('"group_id"')) {
        try {
          const p = JSON.parse(r.obs);
          if (p.group_id) groupKey = `grp_${p.group_id}`;
        } catch (e) {}
      }

      // Agrupación heurística: mismo docente + misma actividad + mismo asistente en el mismo mes
      if (!groupKey) {
        const doc = cleanDocenteName(r.docente);
        const det = String(r.detalle || r.motivo || '').trim().toUpperCase();
        const user = String(r.usuario || '').trim().toUpperCase();
        const mes = String(r.mes || '').trim().toUpperCase();

        if (doc && det) {
          let createdDay = '';
          if (r.created_at) {
            try { createdDay = String(r.created_at).slice(0, 10); } catch (e) {}
          }
          groupKey = `auto_${doc}_${det}_${user}_${mes}${createdDay ? `_${createdDay}` : ''}`;
        } else {
          groupKey = `single_${r.id}`;
        }
      }

      const rooms = getReservationRooms(r);
      const firstRm = roomMap[rooms[0]];
      const itemUbicacion = r.ubicacion || (firstRm ? `${firstRm.piso} - ${firstRm.pabellon}` : (deducePisoFromAula(rooms[0]) || 'SEDE'));

      if (!map.has(groupKey)) {
        const card = {
          key: groupKey,
          id: r.id,
          ids: [r.id],
          items: [r],
          docente: r.docente,
          detalle: r.detalle || r.motivo || 'USO DE LABORATORIO',
          motivo: r.motivo || r.detalle || 'USO DE LABORATORIO',
          usuario: r.usuario,
          prioridad: r.prioridad || 'NORMAL',
          mes: r.mes || (r.fecha ? MONTHS_UPPER[new Date(r.fecha + 'T12:00:00').getMonth()] : 'NOVIEMBRE'),
          hoja: r.hoja || 'RESERVAS',
          created_at: r.created_at,
          obs: r.obs || '',
          fecha: r.fecha,
          dia: r.dia,
          inicio: r.inicio || r.hora_inicio,
          final: r.final || r.hora_fin,
          aulas: [...rooms],
          ubicacion: itemUbicacion,
          schedules: {}
        };
        rooms.forEach(a => {
          card.schedules[a] = getRoomSchedule(r, a);
        });
        map.set(groupKey, card);
        order.push(groupKey);
      } else {
        const card = map.get(groupKey);
        if (!card.ids.includes(r.id)) card.ids.push(r.id);
        card.items.push(r);
        if (r.prioridad === 'IMPORTANTE') card.prioridad = 'IMPORTANTE';
        rooms.forEach(a => {
          if (!card.aulas.includes(a)) card.aulas.push(a);
          card.schedules[a] = getRoomSchedule(r, a);
        });
        if (itemUbicacion && !card.ubicacion.includes(itemUbicacion)) {
          card.ubicacion = `${card.ubicacion}, ${itemUbicacion}`;
        }
        if (r.created_at && (!card.created_at || r.created_at > card.created_at)) {
          card.created_at = r.created_at;
        }
      }
    });

    order.forEach(k => {
      const c = map.get(k);
      if (c && Array.isArray(c.aulas)) {
        c.aulas.sort();
      }
    });

    return order.map(k => map.get(k));
  }, [reservas, roomMap]);

  // Filtrado de Tarjetas Consolidadas (por Mes, Día/Fecha, Pabellón, Piso, Hora y Texto)
  const filtered = useMemo(() => {
    const list = consolidatedReservas.filter(card => {
      const codeList = card.aulas;
      const code = codeList[0] || '';
      const rm = roomMap[code];

      // Filtro por Mes
      if (selectedMes) {
        const targetMes = selectedMes.trim().toUpperCase();
        const rowMes = (card.mes || '').trim().toUpperCase();
        let deducedMes = '';
        if (card.fecha) {
          const dt = new Date(card.fecha + 'T12:00:00');
          if (!Number.isNaN(dt.getTime())) deducedMes = MONTHS_UPPER[dt.getMonth()];
        }
        const hasMesMatch = rowMes === targetMes || deducedMes === targetMes ||
          card.items.some(item => {
            const iMes = (item.mes || '').trim().toUpperCase();
            let dMes = '';
            if (item.fecha) {
              const dt = new Date(item.fecha + 'T12:00:00');
              if (!Number.isNaN(dt.getTime())) dMes = MONTHS_UPPER[dt.getMonth()];
            }
            return iMes === targetMes || dMes === targetMes;
          });
        if (!hasMesMatch) return false;
      }

      // Filtro por Pabellón
      if (selectedPabellon) {
        const matchPab = codeList.some(c => {
          const roomObj = roomMap[c];
          const p = roomObj?.pabellon || (c.startsWith('B') ? 'B' : (c.startsWith('A') ? 'A' : ''));
          return p === selectedPabellon;
        });
        if (!matchPab) return false;
      }

      // Filtro por Piso
      if (selectedPisos.length > 0) {
        const matchPiso = codeList.some(c => {
          const roomObj = roomMap[c];
          const pStr = roomObj?.piso || card.ubicacion || deducePisoFromAula(c);
          return selectedPisos.some(p => matchesPiso(pStr, p));
        });
        if (!matchPiso) return false;
      }

      // Filtro por Día / Fecha
      if (selectedDayOffset !== null) {
        const target = upcomingDays[selectedDayOffset];
        if (target) {
          const tDateNorm = normalizeDateStr(target.fecha);
          const rDateNorm = normalizeDateStr(card.fecha);
          const hasDateMatch = (rDateNorm && tDateNorm && rDateNorm === tDateNorm) ||
            (!rDateNorm && normalizeDay(card.dia) === target.diaName) ||
            codeList.some(codeItem => {
              const sched = card.schedules[codeItem];
              const schedNorm = normalizeDateStr(sched?.fecha);
              return schedNorm && tDateNorm && schedNorm === tDateNorm;
            }) ||
            card.items.some(item => {
              const iDateNorm = normalizeDateStr(item.fecha);
              return (iDateNorm && tDateNorm && iDateNorm === tDateNorm) || (!iDateNorm && normalizeDay(item.dia) === target.diaName);
            });
          if (!hasDateMatch) return false;
        }
      }

      // Filtro por Búsqueda de Texto
      if (search) {
        const q = search.toLowerCase();
        const roomsStr = codeList.join(' ').toLowerCase();
        const docStr = (card.docente || '').toLowerCase();
        const detStr = (card.detalle || card.motivo || '').toLowerCase();
        const userStr = (card.usuario || '').toLowerCase();
        const obsStr = (card.obs || '').toLowerCase();
        return (
          roomsStr.includes(q) ||
          docStr.includes(q) ||
          detStr.includes(q) ||
          userStr.includes(q) ||
          obsStr.includes(q)
        );
      }
      return true;
    });

    const sorted = [...list];
    if (selectedDayOffset !== null) {
      return sorted.sort((a, b) => timeToMins(a.inicio || a.hora_inicio) - timeToMins(b.inicio || b.hora_inicio));
    }
    return sorted.sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at.includes('Z') ? a.created_at : a.created_at.replace(' ', 'T') + 'Z').getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at.includes('Z') ? b.created_at : b.created_at.replace(' ', 'T') + 'Z').getTime() : 0;
      if (aTime && bTime && aTime !== bTime) return bTime - aTime;
      return String(b.fecha || '').localeCompare(String(a.fecha || '')) || (timeToMins(a.inicio || a.hora_inicio) - timeToMins(b.inicio || b.hora_inicio));
    });
  }, [consolidatedReservas, selectedMes, roomMap, selectedPabellon, selectedPisos, selectedDayOffset, upcomingDays, search]);

  // Cálculo de Aulas Libres para Hoy y los Próximos Días
  const freeRooms = useMemo(() => {
    const target = activeDayInfo;
    const blockObj = REAL_BLOCKS.find(b => b.start === selectedHoraBlock);

    return allRooms
      .filter(room => {
        if (selectedPabellon && room.pabellon !== selectedPabellon) return false;
        if (selectedPisos.length > 0) {
          const matchesAny = selectedPisos.some(p => matchesPiso(room.piso, p));
          if (!matchesAny) return false;
        }
        if (search) {
          const q = search.toLowerCase();
          const matchRoom =
            (room.abrv && room.abrv.toLowerCase().includes(q)) ||
            (room.nombre && room.nombre.toLowerCase().includes(q)) ||
            (room.tipo && room.tipo.toLowerCase().includes(q));
          if (!matchRoom) return false;
        }
        return true;
      })
      .map(room => {
        const code = (room.abrv || '').toUpperCase().trim();

        // Clases programadas en esta aula en ese día de la semana
        const classesInRoom = dayClasses.filter(
          c => (c.aula || '').toUpperCase().trim() === code
        );

        // Reservas registradas en esta aula para esa fecha (comparación exacta de fecha)
        const reservasInRoom = reservas.filter(r => {
          if (!getReservationRooms(r).includes(code)) return false;
          const rDateNorm = normalizeDateStr(r.fecha);
          const tDateNorm = normalizeDateStr(target.fecha);
          if (rDateNorm && tDateNorm) return rDateNorm === tDateNorm;
          return normalizeDay(r.dia) === target.diaName;
        });

        // Verificar si está ocupada en el bloque horario seleccionado
        let isBusyInSelectedBlock = false;
        if (blockObj) {
          const bStart = blockObj.startM;
          const bEnd = blockObj.endM;

          const classConflict = classesInRoom.some(c => {
            const cStart = timeToMins(c.horaInicioProg);
            const cEnd = timeToMins(c.horaFinalProg);
            return cStart < bEnd && cEnd > bStart;
          });

          const resConflict = reservasInRoom.some(r => {
            const rStart = timeToMins(r.inicio || r.hora_inicio);
            const rEnd = timeToMins(r.final || r.hora_fin);
            return rStart < bEnd && rEnd > bStart;
          });

          isBusyInSelectedBlock = classConflict || resConflict;
        }

        // Calcular cuántos bloques de los 9 totales están libres ese día
        const freeBlocksList = REAL_BLOCKS.filter(b => {
          const cConflict = classesInRoom.some(c => {
            const cStart = timeToMins(c.horaInicioProg);
            const cEnd = timeToMins(c.horaFinalProg);
            return cStart < b.endM && cEnd > b.startM;
          });
          const rConflict = reservasInRoom.some(r => {
            const rStart = timeToMins(r.inicio || r.hora_inicio);
            const rEnd = timeToMins(r.final || r.hora_fin);
            return rStart < b.endM && rEnd > b.startM;
          });
          return !cConflict && !rConflict;
        });

        return {
          ...room,
          isBusyInSelectedBlock,
          freeBlocksCount: freeBlocksList.length,
          freeBlocksList,
          classesCount: classesInRoom.length,
          reservasCount: reservasInRoom.length
        };
      })
      .filter(room => {
        // Si hay un bloque horario activo, mostrar solo las aulas 100% libres en ese bloque
        if (selectedHoraBlock) {
          return !room.isBusyInSelectedBlock;
        }
        // Si seleccionó "Todo el día", mostrar aulas que tengan al menos 1 bloque libre
        return room.freeBlocksCount > 0;
      });
  }, [allRooms, dayClasses, reservas, activeDayInfo, selectedHoraBlock, selectedPabellon, selectedPisos, search]);

  return (
    <div className="space-y-4 pb-36 md:pb-12">
      {/* Toast Alert */}
      {toastMessage && (
        <ToastBanner
          message={toastMessage}
          onClose={() => setToastMessage('')}
        />
      )}

      {/* Panel Controlador Principal con Filtros por Día (Hoy / Próximos Días), Pabellones, Pisos y Aulas Libres */}
      <div className="bg-white dark:bg-[#0a0a0c] border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3">
        {/* Cabecera + Conmutador Reservas / Aulas Libres + Botón Nueva Reserva */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 truncate">
                Espacios, Talleres & Disponibilidad
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              Reservas de Ambientes
            </h1>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto shrink-0">
            {/* Conmutador entre Reservas Programadas y Aulas Libres */}
            <div
              ref={viewModeSlide.containerRef}
              className="relative flex items-center bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800"
            >
              <span
                aria-hidden="true"
                style={viewModeSlide.pillStyle}
                className={`pointer-events-none absolute top-0 left-0 z-0 rounded-lg shadow-2xs transition-[transform,width,height,background-color] duration-300 ${
                  viewMode === 'FREE_ROOMS' ? 'bg-emerald-600' : 'bg-white dark:bg-zinc-800'
                }`}
              />
              <button
                type="button"
                data-slide-active={viewMode === 'RESERVAS' ? 'true' : undefined}
                onClick={() => setViewMode('RESERVAS')}
                className={`relative z-10 h-8 px-3 rounded-lg text-xs font-bold transition-colors duration-200 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                  viewMode === 'RESERVAS'
                    ? 'text-slate-950 dark:text-white font-black'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-amber-500 stroke-[2.3]" />
                <span>Reservas ({filtered.length})</span>
              </button>

              <button
                type="button"
                data-slide-active={viewMode === 'FREE_ROOMS' ? 'true' : undefined}
                onClick={() => {
                  setViewMode('FREE_ROOMS');
                  if (selectedDayOffset === null) setSelectedDayOffset(0);
                }}
                className={`relative z-10 h-8 px-3 rounded-lg text-xs font-bold transition-colors duration-200 inline-flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                  viewMode === 'FREE_ROOMS'
                    ? 'text-white font-black'
                    : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200'
                }`}
              >
                <DoorOpen className="w-3.5 h-3.5 stroke-[2.3]" />
                <span>Aulas Libres ({freeRooms.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="h-9 px-3.5 rounded-xl text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition inline-flex items-center justify-center gap-1.5 active:scale-95 whitespace-nowrap shrink-0 ml-auto sm:ml-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
              <span>Nueva Reserva</span>
            </button>
          </div>
        </div>

        {/* Selector de Mes (Columna MES en CONTROL DOCENTE - TAY.xlsx) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 shrink-0 inline-flex items-center gap-1">
              <CalendarDays className="w-3.5 h-3.5 text-amber-500 stroke-[2.3]" />
              <span>Mes:</span>
            </span>
            <div className="flex-1 sm:w-80">
              <CustomSelect
                value={selectedMes}
                onChange={(val) => {
                  setSelectedMes(val);
                }}
                placeholder="Todos los meses"
                options={monthOptions}
                className="h-8.5 rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          {selectedMes && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-3 py-1 rounded-xl border border-amber-200 dark:border-amber-800/60 self-start sm:self-auto shrink-0">
              <span>Mes: <strong>{selectedMes}</strong></span>
              <button
                type="button"
                onClick={() => setSelectedMes('')}
                className="text-amber-700 dark:text-amber-400 hover:text-amber-950 dark:hover:text-white p-0.5"
                title="Limpiar filtro de mes"
              >
                <X className="w-3 h-3 stroke-[2.5]" />
              </button>
            </div>
          )}
        </div>

        {/* Fila 1: Selector de Hoy y Próximos Días (Incluye Lunes a Domingo, Sábado y Domingo destacados con navegación asistida) */}
        <div className="relative w-full flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollDates('left')}
            className="hidden sm:flex items-center justify-center w-7 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition shrink-0 active:scale-95"
            title="Desplazar fechas a la izquierda"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
          </button>

          <div
            ref={(el) => {
              dateScrollRef.current = el;
              dateSlide.containerRef(el);
            }}
            className="relative flex items-center gap-1.5 overflow-x-auto bg-slate-100/80 dark:bg-zinc-900/80 p-1 rounded-2xl border border-slate-200/60 dark:border-zinc-800 scroll-smooth scrollbar-none flex-1 min-w-0"
          >
            <span
              aria-hidden="true"
              style={dateSlide.pillStyle}
              className="pointer-events-none absolute top-0 left-0 z-0 rounded-xl bg-slate-900 dark:bg-[#FDBA30] shadow-2xs"
            />
            {viewMode === 'RESERVAS' && (
              <button
                type="button"
                data-slide-active={selectedDayOffset === null ? 'true' : undefined}
                onClick={() => setSelectedDayOffset(null)}
                className={`relative z-10 h-8 px-3 rounded-xl text-xs font-bold transition-colors duration-200 whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                  selectedDayOffset === null
                    ? (dateSlide.pillStyle.opacity === 0
                        ? 'bg-slate-900 text-white dark:bg-[#FDBA30] dark:text-slate-950 font-black shadow-xs'
                        : 'text-white dark:text-slate-950 font-black')
                    : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Todas las fechas
              </button>
            )}

            {upcomingDays.map((d) => {
              const isSelected =
                viewMode === 'FREE_ROOMS'
                  ? (selectedDayOffset ?? 0) === d.offset
                  : selectedDayOffset === d.offset;

              return (
                <button
                  key={d.fecha}
                  type="button"
                  data-slide-active={isSelected ? 'true' : undefined}
                  onClick={() => setSelectedDayOffset(d.offset)}
                  className={`relative z-10 h-8 px-3 rounded-xl text-xs font-bold transition-colors duration-200 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                    isSelected
                      ? (dateSlide.pillStyle.opacity === 0
                          ? 'bg-slate-900 text-white dark:bg-[#FDBA30] dark:text-slate-950 font-black shadow-xs'
                          : 'text-white dark:text-slate-950 font-black')
                      : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{d.offset === 0 ? `Hoy (${d.diaShort})` : d.offset === 1 ? `Mañana (${d.diaShort})` : d.diaShort}</span>
                  <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                    isSelected
                      ? 'bg-white/20 dark:bg-black/15 text-white dark:text-slate-950 font-black'
                      : 'text-slate-400 dark:text-zinc-500'
                  }`}>
                    {d.shortDate}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => scrollDates('right')}
            className="hidden sm:flex items-center justify-center w-7 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition shrink-0 active:scale-95"
            title="Desplazar fechas a la derecha"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.2]" />
          </button>
        </div>

        {/* Fila 2: Buscador Principal + Boton Filtros Movil */}
        <div className="flex items-center gap-1.5 w-full">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 stroke-[2.2]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                viewMode === 'FREE_ROOMS'
                  ? 'Buscar aula libre por código (A201, B102) o laboratorio...'
                  : 'Buscar por aula (A201), docente solicitante o detalle...'
              }
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-[#16161b] focus:border-[#FDBA30] transition font-semibold"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-0.5"
              >
                <X className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            )}
          </div>

          {/* Boton Toggle Filtros Avanzados (Solo en movil para no saturar) */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className={`sm:hidden h-9 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 transition active:scale-95 ${
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

        {/* Fila 3: Filtro Pabellón + Pisos (Plegable en móvil, siempre visible en desktop) */}
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] sm:grid-rows-[1fr] sm:opacity-100 ${
            mobileFiltersOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none sm:pointer-events-auto'
          }`}
        >
          <div className="overflow-hidden sm:overflow-visible min-w-0">
            <div className="flex flex-col gap-2 pt-1 sm:pt-0.5 border-t border-slate-100 dark:border-zinc-800 sm:border-t-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2 w-full">
          {/* Pabellón Pills */}
          <div
            ref={pabSlide.containerRef}
            className="relative flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-slate-200/60 dark:border-zinc-800 shrink-0 w-full sm:w-auto"
          >
            <span
              aria-hidden="true"
              style={pabSlide.pillStyle}
              className="pointer-events-none absolute top-0 left-0 z-0 rounded-lg bg-white dark:bg-zinc-800 shadow-2xs"
            />
            {['', 'A', 'B'].map((pab) => (
              <button
                key={pab || 'ALL'}
                type="button"
                data-slide-active={selectedPabellon === pab ? 'true' : undefined}
                onClick={() => setSelectedPabellon(pab)}
                className={`relative z-10 flex-1 sm:flex-initial h-7 px-3 rounded-lg text-xs font-bold transition-colors duration-200 active:scale-95 whitespace-nowrap ${
                  selectedPabellon === pab
                    ? 'text-slate-950 dark:text-white font-black'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {pab ? `Pab. ${pab}` : 'Ambos'}
              </button>
            ))}
          </div>

          {/* Pisos Pills (Selección Múltiple + pill deslizante en selección única) */}
          <div className="flex items-center overflow-x-auto scrollbar-none py-0.5 w-full sm:w-auto">
            <div
              ref={pisoSlide.containerRef}
              className="relative inline-flex items-center gap-0.5 bg-slate-100/80 dark:bg-zinc-900/80 p-0.5 rounded-xl border border-slate-200/60 dark:border-zinc-800 shrink-0"
            >
              <span
                aria-hidden="true"
                style={pisoSlide.pillStyle}
                className="pointer-events-none absolute top-0 left-0 z-0 rounded-lg bg-[#FDBA30] shadow-2xs"
              />
              {PISOS_DISPONIBLES.map((p) => {
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
                    className={`relative z-10 h-7 px-2.5 rounded-lg text-[11px] font-bold transition-colors duration-200 active:scale-95 shrink-0 inline-flex items-center gap-1 whitespace-nowrap ${
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

        {/* Fila 3 (En modo Aulas Libres): Selector de Bloque Horario para ver qué aulas están libres en esa hora */}
        {viewMode === 'FREE_ROOMS' && (
          <div
            ref={horaSlide.containerRef}
            className="relative flex items-center gap-1 overflow-x-auto bg-slate-100/80 dark:bg-zinc-900/80 p-1 rounded-xl border border-slate-200/60 dark:border-zinc-800 scrollbar-none text-[11px]"
          >
            <span
              aria-hidden="true"
              style={horaSlide.pillStyle}
              className={`pointer-events-none absolute top-0 left-0 z-0 rounded-md shadow-2xs transition-[transform,width,height,background-color] duration-300 ${
                selectedHoraBlock === currentHoraRef
                  ? 'bg-emerald-600'
                  : !selectedHoraBlock
                    ? 'bg-slate-900 dark:bg-zinc-800'
                    : 'bg-[#FDBA30]'
              }`}
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mr-1 ml-1 shrink-0 relative z-10">
              Horario:
            </span>
            <button
              type="button"
              data-slide-active={selectedHoraBlock === currentHoraRef ? 'true' : undefined}
              onClick={() => setSelectedHoraBlock(currentHoraRef)}
              className={`relative z-10 h-6 px-2.5 rounded-md font-bold transition-colors duration-200 whitespace-nowrap shrink-0 inline-flex items-center gap-1 active:scale-95 ${
                selectedHoraBlock === currentHoraRef
                  ? 'text-white font-black'
                  : 'text-emerald-700 dark:text-emerald-300 hover:bg-white/60 dark:hover:bg-zinc-800/70'
              }`}
            >
              <Clock className="w-3 h-3 stroke-[2.4]" />
              <span>Actual ({currentHoraRef})</span>
            </button>

            <button
              type="button"
              data-slide-active={!selectedHoraBlock ? 'true' : undefined}
              onClick={() => setSelectedHoraBlock('')}
              className={`relative z-10 h-6 px-2.5 rounded-md font-bold transition-colors duration-200 whitespace-nowrap shrink-0 active:scale-95 ${
                !selectedHoraBlock
                  ? 'text-white font-black'
                  : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              Cualquier hora
            </button>

            {REAL_BLOCKS.map((b) => {
              const isSelected = selectedHoraBlock === b.start && b.start !== currentHoraRef;
              return (
                <button
                  key={b.start}
                  type="button"
                  data-slide-active={isSelected ? 'true' : undefined}
                  onClick={() => setSelectedHoraBlock(b.start)}
                  className={`relative z-10 h-6 px-2 rounded-md font-mono font-bold transition-colors duration-200 whitespace-nowrap shrink-0 active:scale-95 ${
                    isSelected
                      ? 'text-slate-950 font-black'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {b.start} - {b.end}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* CONTENIDO SEGÚN MODO: AULAS LIBRES (HOY Y PRÓXIMOS DÍAS) vs RESERVAS PROGRAMADAS */}
      {viewMode === 'FREE_ROOMS' ? (
        <div className="space-y-3">
          {/* Banner informativo de disponibilidad */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/70 p-3.5 rounded-2xl">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <DoorOpen className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-black text-emerald-950 dark:text-emerald-200 leading-tight">
                  {freeRooms.length} Aulas Libres para {activeDayInfo.offset === 0 ? 'Hoy' : activeDayInfo.offset === 1 ? 'Mañana' : activeDayInfo.diaName} ({activeDayInfo.fecha})
                  {selectedHoraBlock ? ` · Bloque ${selectedHoraBlock}` : ' · Durante el día'}
                </h3>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Sin clases programadas ni reservas activas en el horario seleccionado. Haz clic en cualquier aula para reservarla.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViewMode('RESERVAS')}
              className="text-xs font-bold bg-white dark:bg-zinc-800 text-emerald-900 dark:text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 shadow-2xs whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              Ver Reservas ({filtered.length})
            </button>
          </div>

          {loading || loadingClasses ? (
            <div className="text-center py-16 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Verificando disponibilidad de aulas para {activeDayInfo.diaName}...</p>
            </div>
          ) : freeRooms.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs px-4">
              <DoorOpen className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2 stroke-[1.8]" />
              <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">No hay aulas libres con estos filtros</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Prueba seleccionando otro bloque horario, piso o pabellón.</p>
            </div>
          ) : (
            <div key={`free-${selectedDayOffset}-${selectedHoraBlock}`} className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-3.5 ${contentAnimClass}`}>
              {freeRooms.map((room) => {
                const blockObj = REAL_BLOCKS.find(b => b.start === selectedHoraBlock);
                return (
                  <div
                    key={room.abrv}
                    className="bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between transition-all duration-150 group"
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

                      <div className="flex flex-wrap items-center gap-1 mb-2.5">
                        <span className="inline-block text-[10px] font-semibold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                          {room.tipo} · Pab. {room.pabellon} ({room.piso})
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs bg-slate-50 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                        <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>Aforo: <strong className="text-slate-900 dark:text-white">{room.aforo} pers.</strong></span>
                          </span>
                          <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {room.freeBlocksCount}/9 bloques libres
                          </span>
                        </div>

                        <div className="text-[10px] font-mono font-semibold text-slate-500 dark:text-zinc-400 pt-1 border-t border-slate-200/60 dark:border-zinc-800 flex items-center justify-between">
                          <span>{activeDayInfo.diaShort} {activeDayInfo.shortDate}</span>
                          <span className="text-slate-800 dark:text-zinc-200 font-bold">
                            {blockObj ? `${blockObj.start} - ${blockObj.end}` : 'Varios horarios'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenReserveForFreeRoom()}
                      className="w-full mt-2.5 h-8 bg-amber-400 hover:bg-[#FDBA30] active:bg-amber-500 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <CalendarPlus className="w-3.5 h-3.5 stroke-[2.4]" />
                      <span>Reservar {activeDayInfo.offset === 0 ? 'Hoy' : activeDayInfo.diaShort}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Grid of Reservation Cards */
        loading ? (
          <div className="text-center py-16 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Cargando reservas programadas...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#0c0c0f] rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs px-4 space-y-2">
            <Calendar className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2 stroke-[1.8]" />
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-200">No se encontraron reservas para este filtro</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500">
              Puedes revisar qué ambientes están libres o limpiar los filtros de piso/pabellón.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              {(selectedDayOffset !== null || selectedPabellon || selectedPisos.length > 0 || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDayOffset(null);
                    setSelectedPabellon('');
                    setSelectedPisos([]);
                    setSearch('');
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 dark:hover:text-white transition"
                >
                  Ver todas las reservas
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setViewMode('FREE_ROOMS');
                  if (selectedDayOffset === null) setSelectedDayOffset(0);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 transition inline-flex items-center gap-1.5"
              >
                <DoorOpen className="w-3.5 h-3.5" />
                <span>Ver Aulas Libres ({freeRooms.length})</span>
              </button>
            </div>
          </div>
        ) : (
          <div key={`reservas-${selectedDayOffset}-${selectedPabellon}`} className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5 sm:gap-4 ${contentAnimClass}`}>
            {filtered.map(r => {
              const isImportante = r.prioridad === 'IMPORTANTE';
              const cardAulas = getReservationRooms(r);
              const firstRm = roomMap[cardAulas[0]];
              const displayUbicacion = r.ubicacion || (firstRm ? `${firstRm.piso} - ${firstRm.pabellon}` : 'UPN Comas');

              return (
                <div
                  key={r.id}
                  className={`rounded-2xl p-4 border transition-all shadow-xs flex flex-col justify-between ${
                    isImportante 
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60' 
                      : 'bg-white dark:bg-[#0c0c0f] border border-slate-200/90 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        {cardAulas.map(a => (
                          <span
                            key={a}
                            className="text-sm sm:text-base font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-2.5 py-0.5 rounded-xl font-mono tracking-tight shrink-0 shadow-2xs"
                          >
                            {a}
                          </span>
                        ))}
                        {cardAulas.length > 1 && (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                            {cardAulas.length} Aulas
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 truncate">
                          {displayUbicacion}
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 px-2 py-0.5 rounded-lg shrink-0">
                          🗓️ {r.mes || (r.fecha ? MONTHS_UPPER[new Date(r.fecha + 'T12:00:00').getMonth()] : 'RESERVA')}
                        </span>
                      </div>

                      <span className={`inline-flex items-center justify-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                        isImportante 
                          ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800/80' 
                          : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                      }`}>
                        {isImportante && <Flame className="w-3 h-3 text-amber-600 dark:text-amber-400 stroke-[2.2]" />}
                        <span>{r.prioridad || 'NORMAL'}</span>
                      </span>
                    </div>

                    {/* Horarios: Desglose individual por aula si difieren fecha/hora, o bloque único consolidado si comparten el mismo horario */}
                    {hasMultipleDifferentSchedules(r) ? (
                      <div className="space-y-1.5 mb-3">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-0.5 flex items-center justify-between">
                          <span>Horario Individual por Aula</span>
                          <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{cardAulas.length} ambientes</span>
                        </div>
                        <div className="space-y-1">
                          {cardAulas.map(a => {
                            const sched = getRoomSchedule(r, a);
                            const dtRoom = sched.fecha ? new Date(sched.fecha + 'T12:00:00') : null;
                            const diaRoom = dtRoom && !Number.isNaN(dtRoom.getTime()) ? DAYS_SHORT[dtRoom.getDay()] : (r.dia || '');
                            return (
                              <div
                                key={a}
                                className="flex items-center justify-between text-xs font-mono bg-slate-50 dark:bg-[#121216] px-2.5 py-1.5 rounded-xl border border-slate-200/70 dark:border-zinc-800"
                              >
                                <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5 min-w-0">
                                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 font-mono text-[11px] font-extrabold shrink-0">
                                    {a}
                                  </span>
                                  <span className="text-slate-600 dark:text-zinc-300 font-semibold text-[11px] truncate">
                                    {diaRoom} {sched.fecha}
                                  </span>
                                </span>
                                <span className="text-slate-900 dark:text-white font-bold inline-flex items-center gap-1 text-[11px] shrink-0">
                                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 stroke-[2.2]" />
                                  <span>{sched.inicio} - {sched.final}</span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs font-mono bg-slate-50 dark:bg-[#121216] px-3 py-1.5 rounded-xl border border-slate-200/70 dark:border-zinc-800 mb-3">
                        <span className="text-slate-600 dark:text-zinc-300 font-semibold">
                          {r.dia} · {r.fecha}
                        </span>
                        <span className="text-slate-900 dark:text-white font-bold inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 stroke-[2.2]" />
                          <span>{r.inicio || r.hora_inicio} - {r.final || r.hora_fin}</span>
                        </span>
                      </div>
                    )}

                    <div className="space-y-1 mb-3">
                      <div className="text-xs font-bold text-slate-900 dark:text-white inline-flex items-start gap-1.5 w-full">
                        <User className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 stroke-[2.2] shrink-0 mt-0.5" />
                        <PressableNameTrigger
                          name={r.docente || 'Solicitante no especificado'}
                          type="docente"
                          onOpen={openHistoryModal}
                        />
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-zinc-400 pl-5 font-semibold leading-relaxed break-words" title={r.motivo || r.detalle}>
                        {r.motivo || r.detalle || 'Sin detalle de actividad.'}
                      </p>
                      {getCleanObsText(r.obs) && (
                        <div className="text-[11px] text-amber-900 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200/60 dark:border-amber-800/40 ml-5 font-medium">
                          <strong className="font-bold">OBS:</strong> {getCleanObsText(r.obs)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-zinc-500">
                    <span className="truncate">
                      Por: <span className="font-semibold text-slate-600 dark:text-zinc-300">{r.usuario || 'Operaciones'}</span>
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Botón de Copiar Fila o Tabla de Reserva con Encabezados Oficiales */}
                      <button
                        type="button"
                        onClick={() => handleCopyReservation(r, false)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 hover:text-slate-950 dark:text-zinc-300 dark:hover:text-white transition active:scale-95 border border-slate-200/80 dark:border-zinc-700 cursor-pointer"
                        title={cardAulas.length > 1 ? `Copiar tabla de ${cardAulas.length} aulas simultáneas con encabezados oficiales (formato Excel / correo)` : "Copiar fila con encabezados (formato oficial Excel / correo)"}
                      >
                        {copiedId === r.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-amber-500 stroke-[2.2]" />
                            <span>{cardAulas.length > 1 ? `Copiar Tabla (${cardAulas.length})` : 'Copiar'}</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition inline-flex items-center justify-center cursor-pointer"
                        title="Cancelar Reserva"
                      >
                        <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Modal: New Reservation - 100% Symmetrical con Fade In y Fade Out */}
      {reservationModalFade.shouldRender && typeof document !== 'undefined' && createPortal(
        <div 
          className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 ${reservationModalFade.backdropClass}`}
          onClick={() => closeModal()}
        >
          <div 
            className={`bg-white dark:bg-[#0c0c10] rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200/90 dark:border-zinc-800 max-h-[90vh] flex flex-col overflow-hidden ${reservationModalFade.modalClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal - Fijo */}
            <div className="p-5 sm:p-6 pb-3.5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 flex items-center justify-center shadow-xs shrink-0">
                  <Calendar className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-950 dark:text-white tracking-tight leading-tight">
                    Nueva Reserva de Ambiente
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    Préstamo de aula o laboratorio con horario definido
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => closeModal()}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center active:scale-90 shrink-0 cursor-pointer"
                title="Cerrar ventana"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-5 sm:p-6 space-y-3.5 flex-1">
              {/* Fila 1: FECHA (Calcula Día y Mes automáticamente para Excel) */}
              <div>
                <label className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  <span>{getReservationRooms(formData).length > 1 ? 'Fecha Base (Predeterminada)' : 'Fecha de Reserva'}</span>
                  {getReservationRooms(formData).length > 1 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      Horario predeterminado
                    </span>
                  )}
                </label>
                <CustomDatePicker
                  value={formData.fecha}
                  onChange={(val) => {
                    if (!val) return;
                    const dt = new Date(val + 'T12:00:00');
                    const computedDia = DAYS_OF_WEEK[dt.getDay()] || formData.dia;
                    const computedMes = MONTHS_UPPER[dt.getMonth()] || formData.mes;
                    setFormData(prev => ({
                      ...prev,
                      fecha: val,
                      dia: computedDia,
                      mes: computedMes
                    }));
                  }}
                  required
                />
              </div>

              {/* Fila 2: HORARIO (Columnas INICIO y FINAL) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    {getReservationRooms(formData).length > 1 ? 'Hora Inicio Base' : 'Hora Inicio'}
                  </label>
                  <CustomSelect
                    value={formData.inicio}
                    onChange={(val) => setFormData({ ...formData, inicio: val })}
                    options={TIME_OPTIONS}
                    placeholder="Hora Inicio"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    {getReservationRooms(formData).length > 1 ? 'Hora Fin Base' : 'Hora Fin'}
                  </label>
                  <CustomSelect
                    value={formData.final}
                    onChange={(val) => setFormData({ ...formData, final: val })}
                    options={TIME_OPTIONS}
                    placeholder="Hora Final"
                  />
                </div>
              </div>

              {/* Fila 3: AULA Y UBICACIÓN INTEGRADA (Columnas AULA y UBICACIÓN) */}
              <div>
                <label className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  <span>Ambiente / Aulas a Reservar *</span>
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                    {freeRoomsForModalTime.length} libres en este horario
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const currentRooms = getReservationRooms(formData);
                    setSelectedAulas(currentRooms);
                    setIsMultiRoomMode(currentRooms.length > 1);
                    setPickerSearch('');
                    setIsRoomPickerOpen(true);
                  }}
                  className="w-full min-h-11 py-2 px-3 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                    {(() => {
                      const rooms = getReservationRooms(formData);
                      if (rooms.length === 0) {
                        return (
                          <span className="text-xs font-bold text-slate-400 dark:text-zinc-500">
                            Seleccionar aulas o laboratorios...
                          </span>
                        );
                      }
                      if (rooms.length === 1) {
                        const code = rooms[0];
                        const rm = roomMap[code];
                        return (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-[#FDBA30] text-slate-950 font-mono font-black text-xs shrink-0">
                              {code}
                            </span>
                            <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">
                              {rm?.tipo || rm?.nombre || 'Aula seleccionada'}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {rooms.map(a => (
                            <span key={a} className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-[#FDBA30] text-slate-950 font-mono font-black text-xs shadow-2xs shrink-0">
                              {a}
                            </span>
                          ))}
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/80 shrink-0">
                            {rooms.length} aulas simultáneas
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getReservationRooms(formData).length > 0 && (
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData(prev => ({
                            ...prev,
                            aulas: [],
                            aula: '',
                            ubicacion: ''
                          }));
                          setSelectedAulas([]);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Quitar aula seleccionada"
                      >
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Elegir
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0 stroke-[2.5]" />
                  </div>
                </button>
              </div>

              {/* Horarios Individuales para cada Ambiente en Reserva Múltiple */}
              {(() => {
                const rooms = getReservationRooms(formData);
                if (rooms.length <= 1) return null;
                return (
                  <div className="space-y-2.5 p-3 sm:p-3.5 rounded-2xl bg-amber-50/70 dark:bg-zinc-900/90 border border-amber-200 dark:border-zinc-800 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#d99000] dark:text-[#FDBA30]" />
                        <span className="text-xs font-black uppercase text-slate-900 dark:text-white">
                          Fecha y Horario Individual ({rooms.length} ambientes)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={applyBaseScheduleToAll}
                        className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-zinc-700 transition flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                        title="Copiar la fecha y horario base a todos los ambientes"
                      >
                        <Copy className="w-3 h-3 text-[#d99000] dark:text-[#FDBA30]" />
                        <span>Copiar horario base a todas</span>
                      </button>
                    </div>
                    <p className="text-[10.5px] text-slate-500 dark:text-zinc-400 leading-tight">
                      Cada ambiente seleccionado puede tener su propia fecha, hora de inicio y hora final de manera individual.
                    </p>

                    <div className="space-y-2 pt-1">
                      {rooms.map(aulaCode => {
                        const rm = roomMap[aulaCode];
                        const sched = roomSchedules[aulaCode] || { fecha: formData.fecha, inicio: formData.inicio, final: formData.final };
                        return (
                          <div
                            key={aulaCode}
                            className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200/90 dark:border-zinc-800 shadow-2xs space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="px-2 py-0.5 rounded-md bg-[#FDBA30] text-slate-950 font-mono font-black text-xs shrink-0 shadow-2xs">
                                  {aulaCode}
                                </span>
                                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">
                                  {rm?.tipo || rm?.nombre || 'Ambiente'} · <span className="font-medium text-slate-500 dark:text-zinc-400">{rm?.piso || deducePisoFromAula(aulaCode)}</span>
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveSelectedRoom(aulaCode)}
                                className="w-6 h-6 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center transition shrink-0 cursor-pointer"
                                title={`Quitar ${aulaCode}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                                  Fecha
                                </label>
                                <CustomDatePicker
                                  value={sched.fecha}
                                  onChange={(val) => updateRoomSchedule(aulaCode, 'fecha', val)}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                                  Hora Inicio
                                </label>
                                <CustomSelect
                                  value={sched.inicio}
                                  onChange={(val) => updateRoomSchedule(aulaCode, 'inicio', val)}
                                  options={TIME_OPTIONS}
                                  placeholder="Inicio"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                                  Hora Fin
                                </label>
                                <CustomSelect
                                  value={sched.final}
                                  onChange={(val) => updateRoomSchedule(aulaCode, 'final', val)}
                                  options={TIME_OPTIONS}
                                  placeholder="Fin"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Fila 4: DOCENTE SOLICITANTE CON AUTOCOMPLETADO DESDE EXCEL */}
              <div className="relative">
                <label className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  <span>Docente Solicitante *</span>
                  {allKnownDocentes.length > 0 && (
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                      {allKnownDocentes.length} docentes disponibles
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  value={formData.docente}
                  onChange={(e) => {
                    setFormData({ ...formData, docente: e.target.value.toUpperCase() });
                    setDocenteSuggestionsOpen(true);
                  }}
                  onFocus={() => setDocenteSuggestionsOpen(true)}
                  onBlur={() => setTimeout(() => setDocenteSuggestionsOpen(false), 200)}
                  placeholder="Apellidos y Nombres completos del docente"
                  className="w-full h-10 text-xs px-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition font-bold uppercase"
                />
                {docenteSuggestionsOpen && docenteSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-900/90 border-b border-slate-100 dark:border-zinc-800 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center justify-between">
                      <span>Docentes Sugeridos ({docenteSuggestions.length})</span>
                      <button
                        type="button"
                        onClick={() => setDocenteSuggestionsOpen(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    {docenteSuggestions.map((doc, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, docente: doc }));
                          setDocenteSuggestionsOpen(false);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition flex items-center justify-between group border-b border-slate-100 dark:border-zinc-800/50 last:border-b-0 cursor-pointer"
                      >
                        <span className="truncate">{doc}</span>
                        <span className="text-[10px] text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 shrink-0 font-black ml-2 uppercase">
                          Elegir
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fila 5: ACTIVIDAD / MOTIVO */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Actividad / Motivo de Reserva
                </label>
                <input
                  type="text"
                  required
                  value={formData.detalle || formData.motivo}
                  onChange={(e) => setFormData({ ...formData, detalle: e.target.value.toUpperCase(), motivo: e.target.value.toUpperCase() })}
                  placeholder="Ej: USO DE LABORATORIO, TALLER CULTURAL, CHARLA..."
                  className="w-full h-10 text-xs px-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition font-bold uppercase"
                />
              </div>

              {/* Fila 6: ASISTENTE RESPONSABLE Y PRIORIDAD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Responsable / Asistente
                  </label>
                  {isAdmin() ? (
                    <CustomSelect
                      value={formData.usuario}
                      onChange={(val) => setFormData({ ...formData, usuario: val })}
                      options={asistentes}
                      placeholder="Seleccionar asistente"
                    />
                  ) : (
                    <div className="h-10 sm:h-11 px-3.5 flex items-center bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400 select-none">
                      <span className="truncate">{getLoggedAssistantName()}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Prioridad
                  </label>
                  <CustomSelect
                    value={formData.prioridad}
                    onChange={(val) => setFormData({ ...formData, prioridad: val })}
                    options={[
                      { value: 'NORMAL', label: 'Normal' },
                      { value: 'IMPORTANTE', label: 'Importante / Evento' }
                    ]}
                  />
                </div>
              </div>

              </div>

              <div className="p-5 sm:p-6 pt-3.5 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-2 gap-3 shrink-0 bg-white/80 dark:bg-[#0c0c10]/80 backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => closeModal()}
                  className="h-11 sm:h-12 rounded-2xl text-xs font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200/90 dark:border-zinc-700 transition flex items-center justify-center text-center active:scale-95 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || getReservationRooms(formData).length === 0}
                  className="h-11 sm:h-12 rounded-2xl text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 shadow-xs transition flex items-center justify-center text-center active:scale-95 cursor-pointer"
                >
                  {isSubmitting
                    ? 'Guardando Reserva...'
                    : (getReservationRooms(formData).length > 1
                      ? `Confirmar ${getReservationRooms(formData).length} Reservas Individuales`
                      : 'Confirmar Reserva')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Menú Selector de Todas las Aulas, Laboratorios y Talleres con Fade In y Fade Out */}
      {roomPickerModalFade.shouldRender && typeof document !== 'undefined' && createPortal(
        <div
          className={`fixed inset-0 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center z-[999999] p-3 sm:p-4 ${roomPickerModalFade.backdropClass}`}
          onClick={() => roomPickerModalFade.requestClose()}
        >
          <div
            className={`bg-white dark:bg-[#0c0c10] rounded-3xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl border border-slate-200/90 dark:border-zinc-800 max-h-[88vh] flex flex-col overflow-hidden ${roomPickerModalFade.modalClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Menú de Aulas y Laboratorios */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 flex items-center justify-center shadow-xs shrink-0">
                  <DoorOpen className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-slate-950 dark:text-white tracking-tight leading-tight">
                    Aulas y Laboratorios Libres ({formData.inicio} - {formData.final})
                  </h3>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 truncate">
                    ✓ Selecciona una o varias aulas en simultáneo ({pickerFilteredRooms.length} disponibles)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => roomPickerModalFade.requestClose()}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center active:scale-90 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Buscador + Filtros Rápidos (Categoría, Pabellón y Piso) */}
            <div className="py-3 space-y-2.5 border-b border-slate-100 dark:border-zinc-800/80 shrink-0">
              {/* Buscador */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Buscar aula libre por código (A201, A505, B101, AS04) o nombre..."
                  className="w-full h-9 pl-9 pr-8 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition font-medium"
                />
                {pickerSearch && (
                  <button
                    type="button"
                    onClick={() => setPickerSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Pestañas por Tipo de Ambiente Libre: Todos | Aulas | Laboratorios | Talleres | Especiales */}
              <div
                ref={pickerCatSlide.containerRef}
                className="relative flex items-center gap-1 bg-slate-100/80 dark:bg-zinc-900/80 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800 overflow-x-auto no-scrollbar"
              >
                <span
                  aria-hidden="true"
                  style={pickerCatSlide.pillStyle}
                  className="pointer-events-none absolute top-0 left-0 z-0 rounded-lg bg-[#FDBA30] shadow-2xs"
                />
                {[
                  { id: 'ALL', label: 'Todos Libres', count: freeRoomsForModalTime.length },
                  { id: 'AULA', label: '🏫 Aulas', count: freeRoomsForModalTime.filter(r => r.categoria === 'AULA').length },
                  { id: 'LABORATORIO', label: '🔬 Laboratorios', count: freeRoomsForModalTime.filter(r => r.categoria === 'LABORATORIO').length },
                  { id: 'TALLER', label: '📐 Talleres', count: freeRoomsForModalTime.filter(r => r.categoria === 'TALLER').length },
                  { id: 'ESPECIAL', label: '🎙️ Conferencias / Litigación', count: freeRoomsForModalTime.filter(r => r.categoria === 'ESPECIAL').length }
                ].map(cat => {
                  const active = pickerCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      data-slide-active={active ? 'true' : undefined}
                      onClick={() => setPickerCategory(cat.id)}
                      className={`relative z-10 h-7 px-2.5 rounded-lg text-[11px] font-bold transition-colors duration-200 whitespace-nowrap inline-flex items-center gap-1.5 shrink-0 active:scale-95 ${
                        active
                          ? 'text-slate-950 font-black'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>{cat.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-black ${
                        active ? 'bg-slate-950/15 text-slate-950' : 'bg-slate-200/70 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                      }`}>
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Filtros de Pabellón y Piso */}
              <div className="flex flex-wrap items-center gap-2">
                <div
                  ref={pickerPabSlide.containerRef}
                  className="relative flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-slate-200/80 dark:border-zinc-800"
                >
                  <span
                    aria-hidden="true"
                    style={pickerPabSlide.pillStyle}
                    className="pointer-events-none absolute top-0 left-0 z-0 rounded-lg bg-slate-900 dark:bg-[#FDBA30] shadow-2xs"
                  />
                  {[
                    { label: 'Ambos Pab.', val: '' },
                    { label: 'Pab. A', val: 'A' },
                    { label: 'Pab. B', val: 'B' }
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      data-slide-active={pickerPabellon === p.val ? 'true' : undefined}
                      onClick={() => setPickerPabellon(p.val)}
                      className={`relative z-10 h-6 px-2.5 rounded-lg text-[10px] font-bold transition-colors duration-200 whitespace-nowrap cursor-pointer ${
                        pickerPabellon === p.val
                          ? (pickerPabSlide.pillStyle.opacity === 0
                              ? 'bg-slate-900 text-white dark:bg-[#FDBA30] dark:text-slate-950 font-black'
                              : 'text-white dark:text-slate-950 font-black')
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div
                  ref={pickerPisoSlide.containerRef}
                  className="relative flex items-center gap-1 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 overflow-x-auto no-scrollbar"
                >
                  <span
                    aria-hidden="true"
                    style={pickerPisoSlide.pillStyle}
                    className="pointer-events-none absolute top-0 left-0 z-0 rounded-lg bg-amber-500 shadow-2xs"
                  />
                  {PISOS_DISPONIBLES.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      data-slide-active={pickerPiso === p.val ? 'true' : undefined}
                      onClick={() => setPickerPiso(p.val)}
                      className={`relative z-10 h-6 px-2 rounded-lg text-[10px] font-bold transition-colors duration-200 whitespace-nowrap ${
                        pickerPiso === p.val
                          ? 'text-slate-950 font-black'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {p.short}
                    </button>
                  ))}
                </div>
              </div>

              {/* Barra de Acciones Rápidas con Selector de Modo Única / Múltiple */}
              <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Selector de Modo: Aula Única (default) vs Múltiples */}
                  <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMultiRoomMode(false);
                        if (selectedAulas.length > 1) {
                          setSelectedAulas(selectedAulas.slice(0, 1));
                        }
                      }}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        !isMultiRoomMode
                          ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-2xs font-black'
                          : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
                      }`}
                    >
                      Aula Única
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMultiRoomMode(true)}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        isMultiRoomMode
                          ? 'bg-amber-400 text-slate-950 shadow-2xs font-black'
                          : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800'
                      }`}
                    >
                      Múltiples
                    </button>
                  </div>

                  {isMultiRoomMode && (
                    <button
                      type="button"
                      onClick={() => {
                        const allVisible = pickerFilteredRooms.map(rm => rm.abrv);
                        setSelectedAulas(prev => Array.from(new Set([...prev, ...allVisible])));
                      }}
                      className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline px-1.5 py-0.5 rounded-md hover:bg-amber-500/10 transition cursor-pointer"
                    >
                      + Todas ({pickerFilteredRooms.length})
                    </button>
                  )}

                  {selectedAulas.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedAulas([])}
                      className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline px-1.5 py-0.5 rounded-md hover:bg-rose-500/10 transition cursor-pointer"
                    >
                      Desmarcar todas
                    </button>
                  )}
                </div>
                <div className="text-[10px] font-mono font-black text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-md shrink-0">
                  {selectedAulas.length} seleccionada{selectedAulas.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            {/* Grilla de Aulas y Laboratorios con Selección Múltiple */}
            <div className="overflow-y-auto py-3 pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 max-h-[46vh]">
              {pickerFilteredRooms.length === 0 ? (
                <div className="col-span-full py-10 text-center">
                  <p className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                    No se encontraron aulas o laboratorios con ese filtro
                  </p>
                </div>
              ) : (
                pickerFilteredRooms.map(rm => {
                  const isSelected = selectedAulas.includes(rm.abrv);
                  const catBadge =
                    rm.categoria === 'LABORATORIO'
                      ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800/60'
                      : rm.categoria === 'TALLER'
                      ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
                      : rm.categoria === 'ESPECIAL'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';

                  return (
                    <button
                      key={rm.abrv}
                      type="button"
                      onClick={() => handleToggleRoomInPicker(rm.abrv)}
                      className={`p-3 rounded-2xl border text-left transition flex items-start justify-between gap-2.5 active:scale-[0.98] cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50/90 dark:bg-amber-950/30 border-amber-400 dark:border-amber-500/80 ring-2 ring-amber-400/40'
                          : 'bg-slate-50/70 dark:bg-zinc-900/70 hover:bg-slate-100 dark:hover:bg-zinc-800/80 border-slate-200/80 dark:border-zinc-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`px-2 py-0.5 rounded-lg font-mono text-xs font-black tracking-tight border ${
                            isSelected
                              ? 'bg-[#FDBA30] text-slate-950 border-amber-400'
                              : 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white border-slate-200 dark:border-zinc-700'
                          }`}>
                            {rm.abrv}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${catBadge}`}>
                            {rm.categoria === 'LABORATORIO'
                              ? '🔬 Laboratorio'
                              : rm.categoria === 'TALLER'
                              ? '📐 Taller'
                              : rm.categoria === 'ESPECIAL'
                              ? '🎙️ Especial'
                              : '🏫 Aula'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {rm.nombre}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                          <span>{rm.piso} · Pab. {rm.pabellon}</span>
                          {rm.aforo && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-0.5">
                                <Users className="w-3 h-3" /> {rm.aforo} pers.
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                        isSelected
                          ? 'bg-[#FDBA30] text-slate-950 shadow-xs ring-2 ring-amber-400/40'
                          : 'bg-slate-200/70 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600'
                      }`}>
                        <Check className="w-3.5 h-3.5 stroke-[2.8]" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Fijo de Selección Múltiple */}
            <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-zinc-900/80 backdrop-blur-xs shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    {selectedAulas.length} {selectedAulas.length === 1 ? 'aula' : 'aulas'} seleccionada{selectedAulas.length === 1 ? '' : 's'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">
                    {selectedAulas.length > 1 ? 'Podrás definir fecha y horario individual para cada una' : 'Selecciona una o más aulas'}
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[200px] pl-2 border-l border-slate-200 dark:border-zinc-700">
                  {selectedAulas.map(a => (
                    <span key={a} className="px-2 py-0.5 rounded-md font-mono text-[10px] font-black bg-[#FDBA30] text-slate-950 shrink-0 shadow-2xs">
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => roomPickerModalFade.requestClose(() => setIsRoomPickerOpen(false))}
                  className="h-10 px-3.5 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRoomPicker}
                  className="h-10 px-4 sm:px-5 rounded-2xl text-xs font-black bg-[#FDBA30] hover:bg-[#ffc642] text-slate-950 shadow-xs transition active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[2.8]" />
                  <span>{selectedAulas.length === 0 ? 'Listo (sin aula)' : `Confirmar (${selectedAulas.length})`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Historial Anual de Reservas por Docente / Usuario / Solicitante (Último Año) */}
      {historyModalFade.shouldRender && typeof document !== 'undefined' && createPortal(
        <div 
          className={`fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center z-[9999] p-3 sm:p-4 ${historyModalFade.backdropClass}`}
          onClick={() => historyModalFade.requestClose()}
        >
          <div 
            className={`bg-white dark:bg-[#0c0c10] rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-zinc-800 ${historyModalFade.modalClass} flex flex-col max-h-[90vh] overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 dark:border-zinc-800 shrink-0">
              <div className="flex items-start gap-3 min-w-0 pr-2">
                <div className="p-2.5 bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0 mt-0.5 border border-amber-300 dark:border-amber-700/60 shadow-xs">
                  {historyData?.type === 'usuario' ? (
                    <UserCheck className="w-5 h-5 stroke-[2.2]" />
                  ) : (
                    <GraduationCap className="w-5 h-5 stroke-[2.2]" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      {historyData?.type === 'usuario' ? 'Asistente de Operaciones' : 'Docente / Solicitante'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                      Último año
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight break-words mt-0.5">
                    {historyData?.name}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => historyModalFade.requestClose()}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen y Métricas del Último Año */}
            {historyData && !historyData.loading && (
              <div className="grid grid-cols-3 gap-2.5 py-3 border-b border-slate-100 dark:border-zinc-800/80 shrink-0">
                <div className="bg-slate-50 dark:bg-zinc-900/60 p-2.5 rounded-2xl border border-slate-200/70 dark:border-zinc-800/80 text-center">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Total Reservas
                  </div>
                  <div className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
                    {historyData.items.length}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-zinc-900/60 p-2.5 rounded-2xl border border-slate-200/70 dark:border-zinc-800/80 text-center">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Horas Totales
                  </div>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                    {calculateTotalHours(historyData.items)} h
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-zinc-900/60 p-2.5 rounded-2xl border border-slate-200/70 dark:border-zinc-800/80 text-center">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Ambientes Distintos
                  </div>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    {getUniqueRoomsCount(historyData.items)}
                  </div>
                </div>
              </div>
            )}

            {/* Barra de Búsqueda y Filtro Rápido */}
            <div className="pt-3 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Buscar por aula, fecha, motivo o mes en su historial..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-amber-500 transition"
                />
              </div>
            </div>

            {/* Listado de Reservas con Scroll */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-2.5 pr-1 py-1">
              {historyData?.loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                  <span className="text-xs font-bold">Cargando historial del último año...</span>
                </div>
              ) : filteredHistoryItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
                  <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold">No se encontraron reservas registradas en el último año.</p>
                </div>
              ) : (
                filteredHistoryItems.map((item, idx) => {
                  const rooms = getReservationRooms(item);
                  const isUpcoming = isDateUpcoming(item.fecha);
                  const isToday = isDateToday(item.fecha);

                  return (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200/80 dark:border-zinc-800/80 hover:border-amber-300/80 dark:hover:border-amber-700/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          {rooms.map(a => (
                            <span
                              key={a}
                              className="text-xs font-mono font-black px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/25"
                            >
                              {a}
                            </span>
                          ))}
                          <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-300">
                            {item.dia || ''} · {formatExcelDate(item.fecha)}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                            ({item.mes || ''})
                          </span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ml-auto shrink-0 ${
                            isToday
                              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                              : isUpcoming
                                ? 'bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700'
                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                          }`}>
                            {isToday ? 'Hoy' : isUpcoming ? 'Próxima' : 'Completada'}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.detalle || item.motivo || 'Uso de Ambiente'}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-700 dark:text-zinc-300">
                            <Clock className="w-3 h-3 text-amber-500 stroke-[2.2]" />
                            {item.inicio || item.hora_inicio} - {item.final || item.hora_fin}
                          </span>
                          <span className="truncate">
                            Por: <strong className="text-slate-700 dark:text-zinc-300">{item.usuario || 'Operaciones'}</strong>
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyReservation(item, false)}
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold border border-slate-200 dark:border-zinc-700 transition active:scale-95 shrink-0 cursor-pointer shadow-2xs"
                        title="Copiar datos de esta reserva para Excel"
                      >
                        <Copy className="w-3.5 h-3.5 text-amber-500" />
                        <span>Copiar</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer del Modal */}
            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopyAllHistory(filteredHistoryItems, historyData?.name)}
                disabled={filteredHistoryItems.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition active:scale-95 disabled:opacity-40 cursor-pointer shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Todo el Historial ({filteredHistoryItems.length})</span>
              </button>

              <button
                type="button"
                onClick={() => historyModalFade.requestClose()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
